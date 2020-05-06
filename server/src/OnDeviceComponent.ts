import * as net from 'net';
import * as http from 'http';
import * as express from 'express';

import { RokuDevice } from './RokuDevice';
import { ConfigOptions } from './types/ConfigOptions';
import { OnDeviceComponentRequest, RequestType, KeyPathBaseTypes } from './types/OnDeviceComponentRequest';
import * as utils from './utils';

export class OnDeviceComponent {
	private callbackListenPort?: number;
	private static readonly version = '1.0.0';
	private device: RokuDevice;
	private config: ConfigOptions;
	private client = new net.Socket();
	private socketConnected = false;
	private handshakeComplete = false;
	private sentRequests: { [key: string]: OnDeviceComponentRequest } = {};
	private app: express.Express;
	private server?: http.Server;

	constructor(device: RokuDevice, config: ConfigOptions) {
		this.device = device;
		this.config = config;
		this.app = this.setupExpress();
	}

	public async getValueAtKeyPath(base: keyof typeof KeyPathBaseTypes, keyPath: string) {
		const result = await this.sendRequest({
			type: RequestType.getValueAtKeyPath,
			args: {
				base: base,
				keyPath: keyPath
			}
		});
		const json = result.body;
		if (!json.success) throw new Error(json.error.message);
		return json.value;
	}

	public async getValuesAtKeyPaths(requests: {[key: string]: {base: keyof typeof KeyPathBaseTypes, keyPath: string}}) {
		const result = await this.sendRequest({
			type: RequestType.getValuesAtKeyPaths,
			args: {
				requests: requests
			}
		});
		const json = result.body;
		if (!json.success) throw new Error(json.error.message);
		return json;
	}

	public async setValueAtKeyPath(keyPath: string, value: string | number | boolean | [string]) {
		console.log('Not implemented yet');
	}

	private async sendHandShakeRequest() {
		let result = await this.sendRequest({
			type: RequestType.handshake,
			args: {
				version: OnDeviceComponent.version
			}
		});
		return result;
	}

	private async sendRequest(request: OnDeviceComponentRequest, timeoutMilliseconds: number = 5000) {
		await this.setupConnections();
		if (request.type !== RequestType.handshake && !this.handshakeComplete) {
			throw new Error(`Handshake not complete. Can't continue`);
		}

		const requestId = utils.randomStringGenerator();
		const formattedRequest = {
			id: requestId,
			callbackPort: this.callbackListenPort,
			type: RequestType[request.type],
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
		this.client.write(JSON.stringify(formattedRequest));
		return await utils.promiseTimeout(promise, timeoutMilliseconds);
	}

	// Starts up express server and our connection to the OnDeviceComponent
	public async setupConnections() {
		// If we already have everything we need then don't want to rerun
		if (this.socketConnected && this.callbackListenPort) return;

		const callbackListenPort = this.config.server!.callbackListenPort;
		this.server = this.app.listen(callbackListenPort, function() {
			console.log(`Listening for callbacks on ${callbackListenPort}`);
		});
		this.callbackListenPort = callbackListenPort;

		return new Promise<void>((resolve, reject) => {
			this.client.connect(9000, this.device.ip, async () => {
				this.socketConnected = true;
				try {
					await this.sendHandShakeRequest();
					this.handshakeComplete = true;
					resolve();
				} catch (e) {
					this.shutdown();
					reject(e.message);
				}
			});
			this.client.once('error', function(e) {
				console.log(e);
			});
		});
	}
	
	public shutdown() {
		if (this.socketConnected) {
			this.callbackListenPort = undefined;
			this.socketConnected = false;
			this.client.end();
			this.server?.close();
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
			} else {
				res.statusCode = 404;
				res.send(`Request ${id} not found`);
			}
		});
		return app;
	}
}
