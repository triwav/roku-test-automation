import * as http from 'http';
import * as udp from 'dgram';
import * as express from 'express';
import * as portfinder from 'portfinder';

import { getStackTrace } from 'get-stack-trace';

import { RokuDevice } from './RokuDevice';
import { ConfigOptions } from './types/ConfigOptions';
import { utils } from './utils';
import { ODCRequest, ODCCallFuncArgs, ODCRequestOptions, ODCGetValueAtKeyPathArgs, ODCGetValuesAtKeyPathsArgs, ODCObserveFieldArgs, ODCSetValueAtKeyPathArgs, ODCRequestTypes, ODCRequestArgs, ODCIsInFocusChainArgs, ODCHasFocusArgs, ODCNodeRepresentation, ODCGetFocusedNodeArgs } from '.';

export class OnDeviceComponent {
	private debugLog = false;
	private static readonly version = '1.0.0';
	private callbackListenPort?: number;
	private device: RokuDevice;
	private config?: ConfigOptions;
	private sentRequests: { [key: string]: ODCRequest } = {};
	private app = this.setupExpress();
	private server?: http.Server;

	constructor(config?: ConfigOptions) {
		this.config = config;
		this.device = new RokuDevice(config);
	}

	public getConfig() {
		const section = 'OnDeviceComponent';
		if (!this.config) {
			const config = utils.getOptionalConfigFromEnvironment();
			utils.validateRTAConfigSchema(config, [section]);
			this.config = config;
		}
		return this.config?.[section];
	}

	public async callFunc(args: ODCCallFuncArgs, options: ODCRequestOptions = {}): Promise<{
		value: any;
	}> {
		const result = await this.sendRequest('callFunc', args, options);
		return result.body;
	}

	public async getFocusedNode(args?: ODCGetFocusedNodeArgs, options: ODCRequestOptions = {}): Promise<ODCNodeRepresentation> {
		const result = await this.sendRequest('getFocusedNode', args ?? {}, options);
		return result.body.node;
	}

	public async getValueAtKeyPath(args: ODCGetValueAtKeyPathArgs, options: ODCRequestOptions = {}): Promise<{
		found: boolean;
		value: any;
	}> {
		const result = await this.sendRequest('getValueAtKeyPath', args, options);
		return result.body;
	}

	public async getValuesAtKeyPaths(args: ODCGetValuesAtKeyPathsArgs, options: ODCRequestOptions = {}): Promise<{
		[key: string]: any;
		found: boolean;
	}> {
		const result = await this.sendRequest('getValuesAtKeyPaths', args, options);
		return result.body;
	}

	public async hasFocus(args: ODCHasFocusArgs, options: ODCRequestOptions = {}): Promise<boolean> {
		const result = await this.sendRequest('hasFocus', args, options);
		return result.body.hasFocus;
	}

	public async isInFocusChain(args: ODCIsInFocusChainArgs, options: ODCRequestOptions = {}): Promise<boolean> {
		const result = await this.sendRequest('isInFocusChain', args, options);
		return result.body.isInFocusChain;
	}

	public async observeField(args: ODCObserveFieldArgs, options: ODCRequestOptions = {}): Promise<{
		/** If a match value was provided and already equaled the requested value the observer won't get fired. This lets you be able to check if that occurred or not  */
		observerFired: boolean
		value: any
	}> {
		let match = args.match;
		if (match !== undefined) {
			// Check if it's an object. Also have to check constructor as array is also an instanceof Object, make sure it has the keyPath key
			if (!((match instanceof Object) && (match.constructor.name === 'Object') && ('keyPath' in match))) {
				args.match = {
					base: args.base,
					keyPath: args.keyPath,
					value: (match as any)
				};
			}
		}

		if (!args.retryInterval) args.retryInterval = 100;

		const deviceConfig = this.device.getConfig();
		let retryTimeout: number;

		if (args.retryTimeout !== undefined) {
			retryTimeout = args.retryTimeout;
			// Adding a reasonable amount of time so that we get a more specific error message instead of the generic timeout
			options.timeout = retryTimeout + 200;
		} else {
			retryTimeout = options.timeout ?? deviceConfig.defaultTimeout ?? 10000;
			retryTimeout -= 200;
		}

		const multiplier = deviceConfig.timeoutMultiplier ?? 1;
		retryTimeout *= multiplier;

		args.retryTimeout = retryTimeout;

		const result = await this.sendRequest('observeField', this.breakOutFieldFromKeyPath(args), options);
		return result.body;
	}

	public async setValueAtKeyPath(args: ODCSetValueAtKeyPathArgs, options: ODCRequestOptions = {}): Promise<{}> {
		const result = await this.sendRequest('setValueAtKeyPath', this.breakOutFieldFromKeyPath(args), options);
		return result.body;
	}

	// In some cases it makes sense to break out the last key path part as `field` to simplify code on the device
	private breakOutFieldFromKeyPath(args: ODCCallFuncArgs | ODCObserveFieldArgs | ODCSetValueAtKeyPathArgs) {
		const keyPathParts = args.keyPath.split('.');
		return {...args, field: keyPathParts.pop(), keyPath: keyPathParts.join('.')};
	}

	private async sendRequest(type: ODCRequestTypes, args: ODCRequestArgs, options: ODCRequestOptions = {}) {
		const stackTrace = await getStackTrace();
		await this.startServer();

		const requestId = utils.randomStringGenerator();
		const request: ODCRequest = {
			id: requestId,
			callbackPort: this.callbackListenPort!,
			type: type,
			args: args,
			settings: { logLevel: this.getConfig()?.logLevel ?? 'info' },
			version: OnDeviceComponent.version
		};
		const body = JSON.stringify(request);

		let retryInterval;
		const promise = new Promise<express.Request>((resolve, reject) => {
			request.callback = (req) => {
				const json = req.body;
				if (json?.success) {
					resolve(req);
				} else {
					const errorMessage = `${json?.error?.message} ${this.getCaller(stackTrace)}`;
					reject(new Error(errorMessage));
				}
			};

			const client = udp.createSocket('udp4');
			const host = this.device.getConfig().host;
			if (this.debugLog) console.log(`Sending request to ${host} with body: ${body}`);

			client.on('message', function (message, remote) {
				const json = JSON.parse(message.toString());
				let receivedId = json.id;
				if (receivedId !== requestId) {
					reject(`Received id '${receivedId}' did not match request id '${requestId}'`);
				}
				clearInterval(retryInterval);
				client.close();
			});

			this.sentRequests[requestId] = request;
			const sendRequest = () => {
				client.send(body, 9000, host, async (err) => {
					if (err) reject(err);
				});
			};
			retryInterval = setInterval(sendRequest, 300);
			sendRequest();
		});

		const deviceConfig = this.device.getConfig();
		let timeout = options?.timeout ?? deviceConfig.defaultTimeout ?? 10000;
		const multiplier = deviceConfig.timeoutMultiplier ?? 1;
		timeout *= multiplier;
		try {
			return await utils.promiseTimeout(promise, timeout, `${request.type} request timed out after ${timeout}ms ${this.getCaller(stackTrace)}`);
		} finally {
			clearInterval(retryInterval);
		}
	}

	// Starts up express server
	private async startServer() {
		if (this.server) {
			return;
		}
		const callbackListenPort = await portfinder.getPortPromise();

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
		if (this.debugLog) console.log(`Shutting down ODC`);
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

	private getCaller(stackTrace?: any[]) {
		if (stackTrace) {
			let previousFrame;
			for (const frame of stackTrace.reverse()) {
				if (frame.typeName === 'OnDeviceComponent') {
					if (previousFrame) {
						return `(${previousFrame.fileName}:${previousFrame.lineNumber}:${previousFrame.columnNumber})`;
					}
				}
				previousFrame = frame;
			}
		}
		return '';
	}
}
