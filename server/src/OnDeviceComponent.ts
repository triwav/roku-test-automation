import * as http from 'http';
import * as udp from 'dgram';
import * as express from 'express';
import * as portfinder from 'portfinder';

import { getStackTrace } from 'get-stack-trace';

import { RokuDevice } from './RokuDevice';
import { ConfigOptions } from './types/ConfigOptions';
import { utils } from './utils';
import { ODC } from '.';

export class OnDeviceComponent {
	public device: RokuDevice;
	// TODO pull from package.json
	private static readonly version = '1.0.0';
	private defaultTimeout = 10000;
	private callbackListenPort?: number;
	private storedDeviceRegistry?: {
		[section: string]: {[sectionItemKey: string]: string}
	};
	private config?: ConfigOptions;
	private sentRequests: { [key: string]: ODC.Request } = {};
	private app = this.setupExpress();
	private callbackListenPortSetupPromise?: Promise<number>;
	private server?: http.Server;
	private defaultNodeReferencesKey = '';

	constructor(device: RokuDevice, config?: ConfigOptions) {
		if (config) {
			this.setConfig(config);
		}
		this.device = device;
	}

	public setConfig(config: ConfigOptions) {
		utils.validateRTAConfigSchema(config);
		this.config = config;
		this.device.setConfig(config);
	}

	public getConfig() {
		if (!this.config) {
			const config = utils.getOptionalConfigFromEnvironment();
			utils.validateRTAConfigSchema(config);
			this.config = config;
		}
		return this.config?.OnDeviceComponent;
	}

	//#region requests run on render thread
	public async callFunc(args: ODC.CallFuncArgs, options: ODC.RequestOptions = {}) {
		this.conditionallyAddDefaultBase(args);
		this.conditionallyAddDefaultNodeReferenceKey(args);

		const result = await this.sendRequest('callFunc', args, options);
		return result.body as {
			value: any
		} & ODC.ReturnTimeTaken;
	}

	public async getFocusedNode(args: ODC.GetFocusedNodeArgs = {}, options: ODC.RequestOptions = {}) {
		this.conditionallyAddDefaultNodeReferenceKey(args);

		const result = await this.sendRequest('getFocusedNode', args, options);
		return result.body as {
			node: ODC.NodeRepresentation;
			ref?: number;
		};
	}

	public async getValueAtKeyPath(args: ODC.GetValueAtKeyPathArgs, options: ODC.RequestOptions = {}) {
		this.conditionallyAddDefaultBase(args);
		this.conditionallyAddDefaultNodeReferenceKey(args);

		const result = await this.sendRequest('getValueAtKeyPath', args, options);
		return result.body as {
			found: boolean;
			value?: any;
		} & ODC.ReturnTimeTaken;
	}

	public async getValuesAtKeyPaths(args: ODC.GetValuesAtKeyPathsArgs, options: ODC.RequestOptions = {}) {
		for (const key in args.requests) {
			const requestArgs = args.requests[key];
			this.conditionallyAddDefaultBase(requestArgs);
			this.conditionallyAddDefaultNodeReferenceKey(requestArgs);
		}

		const result = await this.sendRequest('getValuesAtKeyPaths', args, options);
		return result.body as {
			results: {
				[key: string]: {
					found: boolean;
					value?: any;
				}
			}
		} & ODC.ReturnTimeTaken;
	}

	public async getNodesInfoAtKeyPaths(args: ODC.GetNodesInfoAtKeyPathsArgs, options: ODC.RequestOptions = {}) {
		for (const key in args.requests) {
			const requestArgs = args.requests[key];
			this.conditionallyAddDefaultBase(requestArgs);
			this.conditionallyAddDefaultNodeReferenceKey(requestArgs);
		}

		const result = await this.sendRequest('getNodesInfoAtKeyPaths', args, options);
		return result.body as {
			results: {
				[key: string]: {
					subtype: string;
					fields: {
						[key: string]: {
							fieldType: string;
							type: string;
							value: any;
						}
					};
					children: {
						subtype: string;
					}[]
				}
			}
		} & ODC.ReturnTimeTaken;
	}

	public async hasFocus(args: ODC.HasFocusArgs, options: ODC.RequestOptions = {}) {
		this.conditionallyAddDefaultBase(args);
		this.conditionallyAddDefaultNodeReferenceKey(args);

		const result = await this.sendRequest('hasFocus', {...args, convertResponseToJsonCompatible: false}, options);
		return result.body.hasFocus as boolean;
	}

	public async isInFocusChain(args: ODC.IsInFocusChainArgs, options: ODC.RequestOptions = {}) {
		this.conditionallyAddDefaultBase(args);
		this.conditionallyAddDefaultNodeReferenceKey(args);

		const result = await this.sendRequest('isInFocusChain', {...args, convertResponseToJsonCompatible: false}, options);
		return result.body.isInFocusChain as boolean;
	}

	public async observeField(args: ODC.ObserveFieldArgs, options: ODC.RequestOptions = {}) {
		this.conditionallyAddDefaultBase(args);
		this.conditionallyAddDefaultNodeReferenceKey(args);

		const match = args.match;
		if (match !== undefined) {
			// Check if it's an object. Also have to check constructor as array is also an instanceof Object, make sure it has the keyPath key
			if (((match instanceof Object) && (match.constructor.name === 'Object') && ('keyPath' in match))) {
				this.conditionallyAddDefaultBase(match);
			} else {
				// If it's not we take base and keyPath from the base and keyPath args
				args.match = {
					base: args.base,
					keyPath: args.keyPath,
					value: (match as any)
				};
			}
		}

		if (!args.retryInterval) args.retryInterval = 100;

		const deviceConfig = this.device.getCurrentDeviceConfig();
		let retryTimeout: number;

		if (args.retryTimeout !== undefined) {
			retryTimeout = args.retryTimeout;
			// Adding a reasonable amount of time so that we get a more specific error message instead of the generic timeout
			options.timeout = retryTimeout + 200;
		} else {
			retryTimeout = options.timeout ?? deviceConfig.defaultTimeout ?? this.defaultTimeout;
			retryTimeout -= 200;
		}

		const multiplier = deviceConfig.timeoutMultiplier ?? 1;
		retryTimeout *= multiplier;

		args.retryTimeout = retryTimeout;

		const result = await this.sendRequest('observeField', this.breakOutFieldFromKeyPath(args), options);
		return result.body as {
			/** If a match value was provided and already equaled the requested value the observer won't get fired. This lets you be able to check if that occurred or not */
			observerFired: boolean;
			value: any;
		} & ODC.ReturnTimeTaken;
	}

	public async setValueAtKeyPath(args: ODC.SetValueAtKeyPathArgs, options: ODC.RequestOptions = {}) {
		this.conditionallyAddDefaultBase(args);
		this.conditionallyAddDefaultNodeReferenceKey(args);

		args.convertResponseToJsonCompatible = false;
		const result = await this.sendRequest('setValueAtKeyPath', this.breakOutFieldFromKeyPath(args), options);
		return result.body as ODC.ReturnTimeTaken;
	}

	private conditionallyAddDefaultBase(args: ODC.BaseArgs) {
		if (!args.base) {
			// IMPROVEMENT: Could probably allow users to change this to a different default in their config
			args.base = 'global';
		}
	}

	private conditionallyAddDefaultNodeReferenceKey(args: ODC.BaseArgs) {
		if (!args.key) {
			if (!args.base || args.base === 'nodeRef') {
				if(!this.defaultNodeReferencesKey) {
					this.defaultNodeReferencesKey = utils.randomStringGenerator();
				}
				args.key = this.defaultNodeReferencesKey;
			}
		}
	}

	public async storeNodeReferences(args: ODC.StoreNodeReferencesArgs = {}, options: ODC.RequestOptions = {}) {
		this.conditionallyAddDefaultNodeReferenceKey(args);
		const result = await this.sendRequest('storeNodeReferences', {...args, convertResponseToJsonCompatible: false}, options);
		const body = result.body as {
			flatTree: ODC.NodeTree[];
			rootTree: ODC.NodeTree[];
			totalNodes?: number;
			nodeCountByType?: {[key: string]: number}
		} & ODC.ReturnTimeTaken;

		const rootTree = [] as ODC.NodeTree[];
		for (const tree of body.flatTree) {
			if (!tree.children) {
				tree.children = [];
			}

			if (tree.parentRef === -1) {
				rootTree.push(tree);
				continue;
			}
			const parentTree = body.flatTree[tree.parentRef];
			parentTree.children.push(tree);
		}
		body.rootTree = rootTree;
		return body;
	}

	public async deleteNodeReferences(args: ODC.DeleteNodeReferencesArgs = {}, options: ODC.RequestOptions = {}) {
		this.conditionallyAddDefaultNodeReferenceKey(args);

		const result = await this.sendRequest('deleteNodeReferences', {...args, convertResponseToJsonCompatible: false}, options);
		return result.body as ODC.ReturnTimeTaken;
	}

	public async disableScreenSaver(args: ODC.DisableScreensaverArgs, options: ODC.RequestOptions = {}) {
		const result = await this.sendRequest('disableScreenSaver', args, options);
		return result.body as ODC.ReturnTimeTaken;
	}
	//#endregion

	//#region requests run on task thread
	public async readRegistry(args: ODC.ReadRegistryArgs = {}, options: ODC.RequestOptions = {}) {
		const result = await this.sendRequest('readRegistry', {...args, convertResponseToJsonCompatible: false}, options);
		return result.body as {
			values: {
				[section: string]: {[sectionItemKey: string]: string}
			}
		} & ODC.ReturnTimeTaken;
	}

	public async writeRegistry(args: ODC.WriteRegistryArgs, options: ODC.RequestOptions = {}) {
		const result = await this.sendRequest('writeRegistry', args, options);
		return result.body;
	}

	public async deleteRegistrySections(args: ODC.DeleteRegistrySectionsArgs, options: ODC.RequestOptions = {}) {
		const result = await this.sendRequest('deleteRegistrySections', args, options);
		return result.body;
	}

	public async deleteEntireRegistry(args: ODC.DeleteEntireRegistrySectionsArgs = {}, options: ODC.RequestOptions = {}) {
		const deleteSectionsArgs: ODC.DeleteRegistrySectionsArgs = {
			sections: [],
			allowEntireRegistryDelete: true
		};
		return await this.deleteRegistrySections(deleteSectionsArgs, options);
	}

	public async getServerHost(args: ODC.GetServerHostArgs = {}, options: ODC.RequestOptions = {}) {
		const result = await this.sendRequest('getServerHost', args, options);
		return result.body as {
			host: string
		};
	}
	//#endregion

	// In some cases it makes sense to break out the last key path part as `field` to simplify code on the device
	private breakOutFieldFromKeyPath(args: ODC.CallFuncArgs | ODC.ObserveFieldArgs | ODC.SetValueAtKeyPathArgs) {
		const keyPathParts = args.keyPath.split('.');
		return {...args, field: keyPathParts.pop(), keyPath: keyPathParts.join('.')};
	}

	private async sendRequest(type: ODC.RequestTypes, args: ODC.RequestArgs, options: ODC.RequestOptions = {}) {
		let stackTrace;
		if (!this.getConfig()?.disableCallOriginationLine) {
			stackTrace = await getStackTrace();
		}
		await this.startServer();

		const requestId = utils.randomStringGenerator();
		const request: ODC.Request = {
			id: requestId,
			// Guaranteed to be there by startServer
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			callbackPort: this.callbackListenPort!,
			type: type,
			args: args,
			settings: { logLevel: this.getConfig()?.logLevel ?? 'info' },
			version: OnDeviceComponent.version
		};
		const body = JSON.stringify(request);

		let client: udp.Socket | undefined;
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

			client = udp.createSocket('udp4');
			const host = this.device.getCurrentDeviceConfig().host;
			this.debugLog(`Sending request to ${host} with body: ${body}`);

			client.on('message', (message) => {
				const json = JSON.parse(message.toString());
				const receivedId = json.id;
				if (receivedId !== requestId) {
					const rejectMessage = `Received id '${receivedId}' did not match request id '${requestId}'`;
					this.debugLog(rejectMessage);
					reject(rejectMessage);
				} else {
					this.debugLog(`Roku acknowledged requested id '${requestId}'`);
				}
				clearInterval(retryInterval);
				client?.close();
				client = undefined;
			});

			this.sentRequests[requestId] = request;
			const _sendRequest = () => {
				client?.send(body, 9000, host, async (err) => {
					if (err) reject(err);
				});
			};
			retryInterval = setInterval(_sendRequest, 300);
			_sendRequest();
		});

		const deviceConfig = this.device.getCurrentDeviceConfig();
		let timeout = options?.timeout ?? deviceConfig.defaultTimeout ?? this.defaultTimeout;
		const multiplier = deviceConfig.timeoutMultiplier ?? 1;
		timeout *= multiplier;
		try {
			return await utils.promiseTimeout(promise, timeout);
		} catch(e) {
			if ((e as Error).name === 'Timeout') {
				let message = `${request.type} request timed out after ${timeout}ms`;

				if (!this.getConfig()?.disableCallOriginationLine) {
					message += `${this.getCaller(stackTrace)}\n`;
				}

				if (!this.getConfig()?.disableTelnet) {
					const logs = await this.device.getTelnetLog();
					message += `Log contents:\n${logs}`;
				}
				e = new Error(message);
			}
			throw e;
		} finally {
			clearInterval(retryInterval);
			client?.close();
		}
	}

	// Starts up express server
	private async startServer() {
		// startServer can be called multiple times. Sometimes before server has even been set so have to wait until ready to proceed
		if (this.callbackListenPortSetupPromise) {
			await this.callbackListenPortSetupPromise;
		}

		if (this.server) {
			return;
		}

		let callbackListenPort = this.getConfig()?.callbackListenPort;
		if (!callbackListenPort) {
			this.callbackListenPortSetupPromise = portfinder.getPortPromise();
			callbackListenPort = await this.callbackListenPortSetupPromise;
		}

		this.debugLog('Starting callback server');
		this.server = this.app.listen(callbackListenPort, () => {
			this.debugLog(`Listening for callbacks on ${callbackListenPort}`);
		});
		this.callbackListenPort = callbackListenPort;

		if (this.getConfig()?.restoreRegistry) {
			this.debugLog('Storing original device registry state');
			const result = await this.readRegistry();
			this.storedDeviceRegistry = result.values;
		}
	}

	public async shutdown(waitForServerShutdown = false) {
		this.debugLog(`Shutting down`);

		// TODO need to investigate how to handle
		// eslint-disable-next-line no-async-promise-executor
		return new Promise(async (resolve) => {
			if (!this.server) {
				resolve(undefined);
				return;
			}

			if (this.storedDeviceRegistry) {
				this.debugLog(`Restoring device registry to original state`);
				await this.writeRegistry({
					values: this.storedDeviceRegistry
				});
			}

			this.server.close((e) => {
				this.debugLog(`Server shutdown`);
				if (waitForServerShutdown) {
					resolve(e);
				}
			});

			this.server = undefined;
			if (!waitForServerShutdown) {
				resolve(undefined);
			}
		});
	}

	private setupExpress() {
		const app = express();

		app.use(express.json({limit: '16MB'}));

		app.post('/callback/:id', (req, res) => {
			const id = req.params.id;
			const request = this.sentRequests[id];
			if (request) {
				this.debugLog(`Server received response`, req.body);
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
			for (let i = stackTrace.length - 1; i >= 0 ; i--) {
				const currentFrame = stackTrace[i];
				if (currentFrame.typeName === 'OnDeviceComponent') {
					// Go back one to get to the actual call that the user made if it exists
					let frame = stackTrace[i + 1];
					if (!frame) {
						frame = currentFrame;
					}
					return `(${frame.fileName}:${frame.lineNumber}:${frame.columnNumber})`;
				}
			}
		}
		return '';
	}

	private debugLog(message: string, ...args) {
		if (this.getConfig()?.serverDebugLogging) {
			console.log(`[ODC] ${message}`, ...args);
		}
	}
}
