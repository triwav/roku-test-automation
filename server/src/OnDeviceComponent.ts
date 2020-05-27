import * as http from 'http';
import * as udp from 'dgram';
import * as express from 'express';

import { RokuDevice } from './RokuDevice';
import { ConfigOptions } from './types/ConfigOptions';
import * as utils from './utils';
import { ODCRequest, ODCCallFuncArgs, ODCRequestOptions, ODCBaseResponse, ODCGetValueAtKeyPathArgs, ODCGetValuesAtKeyPathsArgs, ODCObserveFieldArgs, ODCSetValueAtKeyPathArgs, ODCRequestTypes, ODCRequestArgs } from '.';

export class OnDeviceComponent {
	public defaultTimeout = 5000;
	private debugLog = false;
	private static readonly version = '1.0.0';
	private callbackListenPort?: number;
	private device: RokuDevice;
	private config: ConfigOptions;
	private client = udp.createSocket('udp4');
	private sentRequests: { [key: string]: ODCRequest } = {};
	private app = this.setupExpress();
	private server?: http.Server;
	private handshakeStatus?: 'running' | 'complete' | 'failed';
	private handshakePromise?: Promise<any>;

	constructor(device: RokuDevice, config: ConfigOptions) {
		this.device = device;
		this.config = config;
	}

	public async callFunc(args: ODCCallFuncArgs, options?: ODCRequestOptions): Promise<{
		value: any
	} & ODCBaseResponse> {
		const result = await this.sendRequest('callFunc', args, options);
		return result.body;
	}

	public async getValueAtKeyPath(args: ODCGetValueAtKeyPathArgs, options?: ODCRequestOptions): Promise<{
		found: boolean
		value: any
	} & ODCBaseResponse> {
		const result = await this.sendRequest('getValueAtKeyPath', args, options);
		return result.body;
	}

	public async getValuesAtKeyPaths(args: ODCGetValuesAtKeyPathsArgs, options?: ODCRequestOptions): Promise<{
		[key: string]: any
		found: boolean
		value: any
	} & ODCBaseResponse> {
		const result = await this.sendRequest('getValuesAtKeyPaths', args, options);
		return result.body;
	}

	public async observeField(args: ODCObserveFieldArgs, options?: ODCRequestOptions): Promise<{
		value: any
	} & ODCBaseResponse> {
		const match = args.match;
		if (match) {
			if (!('keyPath' in match)) {
				args.match = {
					base: args.base,
					keyPath: args.keyPath,
					value: match.value
				};
			}
		}

		const result = await this.sendRequest('observeField', this.breakOutFieldFromKeyPath(args), options);
		return result.body;
	}

	public async setValueAtKeyPath(args: ODCSetValueAtKeyPathArgs, options?: ODCRequestOptions): Promise<ODCBaseResponse> {
		const result = await this.sendRequest('setValueAtKeyPath', this.breakOutFieldFromKeyPath(args), options);
		return result.body;
	}

	private sendHandShakeRequest() {
		if (!this.handshakePromise) {
			this.handshakePromise = Promise.resolve().then(async () => {
				this.handshakeStatus = 'running';
				let retryCount = 10;
				while (retryCount > 0) {
					try {
						const args = {
							version: OnDeviceComponent.version,
							logLevel: this.config.device.odc?.logLevel ?? 'info'
						};
						let result = await this.sendRequestCore('handshake', args, {
							timeout: 1000
						});
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

	// In some cases it makes sense to break out the last key path part as `field` to simplify code on the device
	private breakOutFieldFromKeyPath(args: ODCCallFuncArgs | ODCObserveFieldArgs | ODCSetValueAtKeyPathArgs) {
		const keyPathParts = args.keyPath.split('.');
		return {...args, field: keyPathParts.pop(), keyPath: keyPathParts.join('.')};
	}

	private async sendRequest(type: ODCRequestTypes, args: ODCRequestArgs, options?: ODCRequestOptions) {
		if (this.handshakeStatus !== 'complete') {
			if (this.handshakeStatus === 'failed') {
				throw new Error('Can not continue as handshake was not successful');
			}
			await this.sendHandShakeRequest();
		}
		return await this.sendRequestCore(type, args, options);
	}

	private async sendRequestCore(type: ODCRequestTypes, args: ODCRequestArgs, options?: ODCRequestOptions) {
		await this.startServer();

		const requestId = utils.randomStringGenerator();
		const request: ODCRequest = {
			id: requestId,
			callbackPort: this.callbackListenPort!,
			type: type,
			args: args
		};
		const body = JSON.stringify(request);

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

		if (this.debugLog) console.log(`Sending request to ${this.device.ip} with body: ${body}`);
		this.client.send(body, 9000, this.device.ip, (err) => {
			if (err) {
				throw err;
			}
		});
		const timeout = options?.timeout ?? this.defaultTimeout;
		return await utils.promiseTimeout(promise, timeout, `${request.type} request ${requestId} timed out after ${timeout}ms`);
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
