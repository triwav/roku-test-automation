import * as http from 'http';
import * as udp from 'dgram';
import * as express from 'express';

import { RokuDevice } from './RokuDevice';
import { ConfigOptions } from './types/ConfigOptions';
import { OnDeviceComponentRequest, RequestTypes, KeyPathBaseTypes, RequestEnum } from './types/OnDeviceComponentRequest';
import * as utils from './utils';

export class OnDeviceComponent {
	private debugLog = false;
	private static readonly version = '1.0.0';
	private callbackListenPort?: number;
	private device: RokuDevice;
	private config: ConfigOptions;
	private client = udp.createSocket('udp4');
	private sentRequests: { [key: string]: OnDeviceComponentRequest } = {};
	private app = this.setupExpress();
	private server?: http.Server;
	private handshakeStatus?: 'running' | 'complete' | 'failed';
	private handshakePromise?: Promise<any>;

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

	public async observeField(base: KeyPathBaseTypes, keyPath: string, matchValue?: any, matchBase?: KeyPathBaseTypes, matchKeyPath?: string) {
		// More efficient to split here than on device
		const keyPathParts = keyPath.split('.');
		const args: any = {
			base: base,
			field: keyPathParts.pop(),
			keyPath: keyPathParts.join('.')
		};

		if (matchValue !== undefined) {
			if (matchBase === undefined) {
				matchBase = base;
			}

			if (matchKeyPath === undefined) {
				matchKeyPath = keyPath;
			}
			const match = {
				value: matchValue,
				base: matchBase,
				keyPath: matchKeyPath
			}
			args.match = match;
		}

		const result = await this.sendRequest({
			type: 'observeField',
			args: args
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

	private sendHandShakeRequest() {
		if (!this.handshakePromise) {
			this.handshakePromise = Promise.resolve().then(async () => {
				this.handshakeStatus = 'running';
				let retryCount = 10;
				while (retryCount > 0) {
					try {
						let result = await this.sendRequestCore({
							type: 'handshake',
							args: {
								version: OnDeviceComponent.version,
								logLevel: this.config.device.odc?.logLevel ?? 'info'
							}
						}, 1000);
						this.handshakeStatus = 'complete';
						return result.body;
					} catch (e) {
						retryCount--;
						if (retryCount && this.debugLog) console.log('Send handshake failed. Retrying');
					}
				}
				this.handshakeStatus = 'failed';
				throw new Error('Handshake failed');
			});
		}
		return this.handshakePromise;
	}

	private async sendRequest(request: OnDeviceComponentRequest, timeoutMilliseconds: number = 5000) {
		if (this.handshakeStatus !== 'complete') {
			if (this.handshakeStatus === 'failed') {
				throw new Error('Can not continue as handshake was not successful');
			}
			await this.sendHandShakeRequest();
		}
		return await this.sendRequestCore(request, timeoutMilliseconds);
	}

	private async sendRequestCore(request: OnDeviceComponentRequest, timeoutMilliseconds: number = 5000) {
		await this.startServer();

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

		const body = JSON.stringify(formattedRequest);
		if (this.debugLog) console.log(`Sending request to ${this.device.ip} with body: ${body}`);
		this.client.send(body, 9000, this.device.ip, (err) => {
			if (err) {
				throw err;
			}
		});
		return await utils.promiseTimeout(promise, timeoutMilliseconds, `${request.type} request ${requestId} timed out after ${timeoutMilliseconds}ms`);
	}

	// Starts up express server
	private async startServer() {
		if (this.server) {
			return;
		}

		const callbackListenPort = this.config.server?.callbackListenPort;
		if (!callbackListenPort) throw new Error('Config did not have a callback listen port');

		if (this.debugLog) console.log(`Starting callback server`);
		this.server = this.app.listen(callbackListenPort, () => {
			if (this.debugLog) console.log(`Listening for callbacks on ${callbackListenPort}`);

		});
		this.callbackListenPort = callbackListenPort;
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
				if (this.debugLog) console.log(`Server received response`, req.body);
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
