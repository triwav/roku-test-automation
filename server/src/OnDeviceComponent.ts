import * as http from 'http';
import * as udp from 'dgram';
import * as express from 'express';

import { RokuDevice } from './RokuDevice';
import { ConfigOptions } from './types/ConfigOptions';
import { OnDeviceComponentRequest, RequestTypes, KeyPathBaseTypes, RequestEnum } from './types/OnDeviceComponentRequest';
import * as utils from './utils';

export class OnDeviceComponent {
	private static readonly version = '1.0.0';
	private callbackListenPort?: number;
	private device: RokuDevice;
	private config: ConfigOptions;
	private client = udp.createSocket('udp4');
	private handshakeComplete = false;
	private sentRequests: { [key: string]: OnDeviceComponentRequest } = {};
	private app = this.setupExpress();
	private server?: http.Server;

	constructor(device: RokuDevice, config: ConfigOptions) {
		this.device = device;
		this.config = config;
	}

	public async getValueAtKeyPath(base: KeyPathBaseTypes, keyPath: string) {
		const result = await this.sendRequest({
			type: 'getValueAtKeyPath',
			args: {
				base: base,
				keyPath: keyPath
			}
		});
		return result.body;
	}

	public async getValuesAtKeyPaths(requests: {[key: string]: {base: KeyPathBaseTypes, keyPath: string}}) {
		const result = await this.sendRequest({
			type: 'getValuesAtKeyPaths',
			args: {
				requests: requests
			}
		});
		return result.body;
	}

	public async setValueAtKeyPath(base: KeyPathBaseTypes, keyPath: string, value: any) {
		// More efficient to split here than on device
		const keyPathParts = keyPath.split('.');
		const args: any = {
			base: base,
			field: keyPathParts.pop(),
			keyPath: keyPathParts.join('.'),
			value: value
		};

		const result = await this.sendRequest({
			type: 'setValueAtKeyPath',
			args: args
		});
		return result.body;
	}

	private async sendHandShakeRequest() {
		let retryCount = 5;
		while (retryCount > 0) {
			try {
				let result = await this.sendRequest({
					type: 'handshake',
					args: {
						version: OnDeviceComponent.version,
						logLevel: this.config.device.odc?.logLevel ?? 'info'
					}
				}, 1000);
				return result.body;
			} catch (e) {
				retryCount--;
				if (retryCount) console.log('Send handshake failed. Retrying');
			}
		}
		throw new Error('Handshake failed');
	}

	private async sendRequest(request: OnDeviceComponentRequest, timeoutMilliseconds: number = 5000) {
		await this.setupConnections();
		if (request.type !== RequestEnum[RequestEnum.handshake] && !this.handshakeComplete) {
			throw new Error(`Handshake not complete. Can't continue`);
		}

		const requestId = utils.randomStringGenerator();
		const formattedRequest = {
			id: requestId,
			callbackPort: this.callbackListenPort,
			type: request.type,
			args: request.args
		};
		const promise = new Promise<express.Request>((resolve, reject) => {
			request.callback = (req) => {
				const json = req.body;
				if (json?.success) {
					resolve(req);
				} else {
					reject(json?.error?.message);
				}
			};
		});
		this.sentRequests[requestId] = request;
		this.client.send(JSON.stringify(formattedRequest), 9000, this.device.ip, (err) => {
			if (err) {
				throw err;
			}
		});
		return await utils.promiseTimeout(promise, timeoutMilliseconds);
	}

	// Starts up express server and our connection to the OnDeviceComponent
	public async setupConnections() {
		// If we already have everything we need then don't want to rerun
		if (this.server) return;

		const callbackListenPort = this.config.server?.callbackListenPort;
		if (!callbackListenPort) throw new Error('Config did not have a callback listen port');

		this.server = this.app.listen(callbackListenPort, function() {
			console.log(`Listening for callbacks on ${callbackListenPort}`);
		});
		this.callbackListenPort = callbackListenPort;
		await this.sendHandShakeRequest();
		this.handshakeComplete = true;
	}

	public shutdown() {
		if (this.server) {
			this.server.close();
			this.server = undefined;
		}
	}

	private setupExpress() {
		const app = express();

		app.use(express.json());

		app.post('/callback/:id', (req, res) => {
			const id = req.params.id;
			const request = this.sentRequests[id];
			if (request) {
				request.callback?.(req);
				res.send('OK');
				delete this.sentRequests[id];
			} else {
				res.statusCode = 404;
				res.send(`Request ${id} not found`);
			}
		});
		return app;
	}
}
