import * as net from 'net';

import { getStackTrace } from 'get-stack-trace';

import { RokuDevice } from './RokuDevice';
import { ConfigOptions } from './types/ConfigOptions';
import { utils } from './utils';
import { ODC } from '.';

export class OnDeviceComponent {
	public device: RokuDevice;
	private defaultTimeout = 10000;
	private requestHeaderSize = 8;
	private storedDeviceRegistry?: {
		[section: string]: {[sectionItemKey: string]: string}
	};
	private config?: ConfigOptions;
	private activeRequests: { [key: string]: ODC.Request } = {};
	private receivingRequestResponse?: ODC.RequestResponse;
	private clientSocket?: net.Socket;
	private defaultNodeReferencesKey = utils.randomStringGenerator();

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
		return result.json as {
			value: any
		} & ODC.ReturnTimeTaken;
	}

	public async getValue(args: ODC.GetValueArgs, options: ODC.RequestOptions = {}) {
		this.conditionallyAddDefaultBase(args);
		this.conditionallyAddDefaultNodeReferenceKey(args);

		const result = await this.sendRequest('getValue', args, options);
		return result.json as {
			found: boolean;
			value?: any;
		} & ODC.ReturnTimeTaken;
	}

	public async getValues(args: ODC.GetValuesArgs, options: ODC.RequestOptions = {}) {
		for (const key in args.requests) {
			const requestArgs = args.requests[key];
			this.conditionallyAddDefaultBase(requestArgs);
			this.conditionallyAddDefaultNodeReferenceKey(requestArgs);
		}

		const result = await this.sendRequest('getValues', args, options);
		return result.json as {
			results: {
				[key: string]: {
					found: boolean;
					value?: any;
				}
			}
		} & ODC.ReturnTimeTaken;
	}

	public async getNodesInfo(args: ODC.GetNodesInfoArgs, options: ODC.RequestOptions = {}) {
		for (const key in args.requests) {
			const requestArgs = args.requests[key];
			this.conditionallyAddDefaultBase(requestArgs);
			this.conditionallyAddDefaultNodeReferenceKey(requestArgs);
		}

		const result = await this.sendRequest('getNodesInfo', args, options);
		return result.json as {
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

	public async getFocusedNode(args: ODC.GetFocusedNodeArgs = {}, options: ODC.RequestOptions = {}) {
		this.conditionallyAddDefaultNodeReferenceKey(args);

		const result = await this.sendRequest('getFocusedNode', args, options);
		return result.json as {
			node: ODC.NodeRepresentation;
			ref?: number;
		};
	}

	public async hasFocus(args: ODC.HasFocusArgs, options: ODC.RequestOptions = {}) {
		this.conditionallyAddDefaultBase(args);
		this.conditionallyAddDefaultNodeReferenceKey(args);

		const result = await this.sendRequest('hasFocus', {...args, convertResponseToJsonCompatible: false}, options);
		return result.json.hasFocus as boolean;
	}

	public async isInFocusChain(args: ODC.IsInFocusChainArgs, options: ODC.RequestOptions = {}) {
		this.conditionallyAddDefaultBase(args);
		this.conditionallyAddDefaultNodeReferenceKey(args);

		const result = await this.sendRequest('isInFocusChain', {...args, convertResponseToJsonCompatible: false}, options);
		return result.json.isInFocusChain as boolean;
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
		return result.json as {
			/** If a match value was provided and already equaled the requested value the observer won't get fired. This lets you be able to check if that occurred or not */
			observerFired: boolean;
			value: any;
		} & ODC.ReturnTimeTaken;
	}

	public async setValue(args: ODC.SetValueArgs, options: ODC.RequestOptions = {}) {
		this.conditionallyAddDefaultBase(args);
		this.conditionallyAddDefaultNodeReferenceKey(args);

		args.convertResponseToJsonCompatible = false;
		const result = await this.sendRequest('setValue', this.breakOutFieldFromKeyPath(args), options);
		return result.json as ODC.ReturnTimeTaken;
	}

	private conditionallyAddDefaultBase(args: ODC.BaseArgs) {
		if (!args.base) {
			// IMPROVEMENT: Could probably allow users to change this to a different default in their config
			args.base = 'global';
		}
	}

	private conditionallyAddDefaultNodeReferenceKey(args: ODC.BaseArgs) {
		if (!args.key) {
			// TODO test if we need to add if no base provided
			if (!args.base || args.base === 'nodeRef') {
				args.key = this.defaultNodeReferencesKey;
			}
		}
	}

	public async storeNodeReferences(args: ODC.StoreNodeReferencesArgs = {}, options: ODC.RequestOptions = {}) {
		this.conditionallyAddDefaultNodeReferenceKey(args);
		const result = await this.sendRequest('storeNodeReferences', {...args, convertResponseToJsonCompatible: false}, options);
		const body = result.json as {
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
			if (!parentTree.children) {
				parentTree.children = [];
			}

			parentTree.children.push(tree);
		}
		body.rootTree = rootTree;

		// sort children by position to make output more logical
		for (const tree of body.flatTree) {
			tree.children.sort((a, b) => a.position - b.position);
		}
		return body;
	}

	public async deleteNodeReferences(args: ODC.DeleteNodeReferencesArgs = {}, options: ODC.RequestOptions = {}) {
		this.conditionallyAddDefaultNodeReferenceKey(args);

		const result = await this.sendRequest('deleteNodeReferences', {...args, convertResponseToJsonCompatible: false}, options);
		return result.json as ODC.ReturnTimeTaken;
	}

	public async disableScreenSaver(args: ODC.DisableScreensaverArgs, options: ODC.RequestOptions = {}) {
		const result = await this.sendRequest('disableScreenSaver', args, options);
		return result.json as ODC.ReturnTimeTaken;
	}

	public async focusNode(args: ODC.FocusNodeArgs, options: ODC.RequestOptions = {}) {
		const result = await this.sendRequest('focusNode', args, options);
		return result.json as ODC.ReturnTimeTaken;
	}
	//#endregion

	//#region requests run on task thread
	public async readRegistry(args: ODC.ReadRegistryArgs = {}, options: ODC.RequestOptions = {}) {
		const result = await this.sendRequest('readRegistry', {...args, convertResponseToJsonCompatible: false}, options);
		return result.json as {
			values: {
				[section: string]: {[sectionItemKey: string]: string}
			}
		} & ODC.ReturnTimeTaken;
	}

	public async writeRegistry(args: ODC.WriteRegistryArgs, options: ODC.RequestOptions = {}) {
		const result = await this.sendRequest('writeRegistry', args, options);
		return result.json;
	}

	public async deleteRegistrySections(args: ODC.DeleteRegistrySectionsArgs, options: ODC.RequestOptions = {}) {
		const result = await this.sendRequest('deleteRegistrySections', args, options);
		return result.json;
	}

	public async deleteEntireRegistry(args: ODC.DeleteEntireRegistrySectionsArgs = {}, options: ODC.RequestOptions = {}) {
		const deleteSectionsArgs: ODC.DeleteRegistrySectionsArgs = {
			sections: [],
			allowEntireRegistryDelete: true
		};
		return await this.deleteRegistrySections(deleteSectionsArgs, options);
	}

	public async getVolumeList(args: ODC.GetVolumeListArgs = {}, options: ODC.RequestOptions = {}) {
		const result = await this.sendRequest('getVolumeList', args, options);
		return result.json as {
			list: string[]
		} & ODC.ReturnTimeTaken;
	}

	public async getDirectoryListing(args: ODC.GetDirectoryListingArgs, options: ODC.RequestOptions = {}) {
		const result = await this.sendRequest('getDirectoryListing', args, options);
		return result.json as {
			list: string[]
		} & ODC.ReturnTimeTaken;
	}

	public async statPath(args: ODC.StatPathArgs, options: ODC.RequestOptions = {}) {
		const result = await this.sendRequest('statPath', args, options);
		const body = result.json;
		// Convert timestamps for easier usage
		body.ctime = new Date(body.ctime * 1000);
		body.mtime = new Date(body.mtime * 1000);
		return body as {
			ctime: Date
			hidden: boolean
			mtime: Date
			permissions: 'rw' | 'r'
			size: number
			sizeex: number
			type: 'file' | 'directory'
		} & ODC.ReturnTimeTaken;
	}

	public async createDirectory(args: ODC.CreateDirectoryArgs, options: ODC.RequestOptions = {}) {
		const result = await this.sendRequest('createDirectory', args, options);
		return result.json as ODC.ReturnTimeTaken;
	}

	public async deleteFile(args: ODC.DeleteFileArgs, options: ODC.RequestOptions = {}) {
		const result = await this.sendRequest('deleteFile', args, options);
		return result.json as ODC.ReturnTimeTaken;
	}

	public async renameFile(args: ODC.RenameFileArgs, options: ODC.RequestOptions = {}) {
		const result = await this.sendRequest('renameFile', args, options);
		return result.json as ODC.ReturnTimeTaken;
	}

	public async readFile(args: ODC.ReadFileArgs, options: ODC.RequestOptions = {}) {
		const result = await this.sendRequest('readFile', args, options);
		return result as {
			json: ODC.ReturnTimeTaken;
			binaryPayload: Buffer;
		};
	}

	public async writeFile(args: ODC.WriteFileArgs, options: ODC.RequestOptions = {}) {
		const result = await this.sendRequest('writeFile', args, options);
		return result.json as ODC.ReturnTimeTaken;
	}

	public async getServerHost(args: ODC.GetServerHostArgs = {}, options: ODC.RequestOptions = {}) {
		const result = await this.sendRequest('getServerHost', args, options);
		return result.json as {
			host: string
		};
	}
	//#endregion

	// In some cases it makes sense to break out the last key path part as `field` to simplify code on the device
	private breakOutFieldFromKeyPath(args: ODC.CallFuncArgs | ODC.ObserveFieldArgs | ODC.SetValueArgs) {
		const keyPathParts = args.keyPath.split('.');
		return {...args, field: keyPathParts.pop(), keyPath: keyPathParts.join('.')};
	}

	private setupClientSocket() {
		return new Promise<net.Socket>((resolve, reject) => {
			const socket = new net.Socket();

			const port = 9000;
			const host = this.device.getCurrentDeviceConfig().host;
			const socketConnect = () => {
				this.debugLog(`Attempting to connect to Roku at ${host} on port ${port}`);
				socket.connect(9000, host);
			};

			socket.on('connect', () => {
				this.debugLog(`Connected to Roku at ${host} on port ${port}`);
				resolve(socket);
			});

			socket.on('error', async (e) => {
				const errorCode: string = (e as any).code;
				if (errorCode === 'ECONNREFUSED' || errorCode === 'EPIPE') {
					this.clientSocket = undefined;
					await utils.sleep(50);
					this.debugLog('Retrying connection due to: ' + errorCode);
					socketConnect();
				} else {
					if (errorCode === 'ETIMEDOUT') {
						this.debugLog(`Failed to connect to Roku at ${host} on port ${port}`);
					}
					reject(e);
				}
			});

			socket.on('timeout', () => {
				console.log('socket time out');
			});

			socket.on('drop', () => {
				console.log('socket drop');
			});

			socket.on('close', () => {
				this.clientSocket = undefined;
			});

			socket.on('data', (data) => {
				let offset = 0;
				if (!this.receivingRequestResponse) {
					offset = this.requestHeaderSize;
					this.receivingRequestResponse = {
						json: {},
						stringLength: data.readInt32LE(0),
						binaryLength: data.readInt32LE(4),
						stringPayload: '',
						binaryPayload: Buffer.alloc(0)
					};
				}

				// Check if we're still receiving the string payload
				const remainingStringPayload = this.receivingRequestResponse.stringLength - this.receivingRequestResponse.stringPayload.length;
				if (remainingStringPayload > 0) {
					const remainingBufferBytes = data.length - offset;
					if (remainingBufferBytes < remainingStringPayload) {
						this.receivingRequestResponse.stringPayload += data.toString('utf-8', offset, remainingBufferBytes + offset);
						return;
					} else {
						this.receivingRequestResponse.stringPayload += data.toString('utf-8', offset, remainingStringPayload + offset);
						offset += remainingStringPayload;
					}
				}

				const binaryPayload = this.receivingRequestResponse.binaryPayload;
				const remainingBinaryPayload = this.receivingRequestResponse.binaryLength - binaryPayload.length;
				if (remainingBinaryPayload > 0) {
					const remainingBufferBytes = data.length - offset;
					if (remainingBufferBytes < remainingBinaryPayload) {
						const additionalBinaryPayload = data.slice(offset, remainingBufferBytes + offset);
						this.receivingRequestResponse.binaryPayload = Buffer.concat([binaryPayload, additionalBinaryPayload]);
						return;
					} else {
						const additionalBinaryPayload = data.slice(offset, remainingBinaryPayload + offset);
						this.receivingRequestResponse.binaryPayload = Buffer.concat([binaryPayload, additionalBinaryPayload]);
					}
				}

				const receivingRequestResponse = this.receivingRequestResponse;
				this.receivingRequestResponse = undefined;
				const json = JSON.parse(receivingRequestResponse.stringPayload);
				receivingRequestResponse.json = json;
				if (json.id && this.activeRequests[json.id]) {
					const request = this.activeRequests[json.id];
					const callback = request.callback;
					if (callback) {
						callback(receivingRequestResponse);
					}
					delete this.activeRequests[json.id];
				}
			});

			socketConnect();
		});
	}

	private async sendRequest(type: ODC.RequestTypes, args: ODC.RequestArgs, options: ODC.RequestOptions = {}) {
		const requestId = utils.randomStringGenerator();
		const request: ODC.Request = {
			id: requestId,
			type: type,
			args: args,
			settings: { logLevel: this.getConfig()?.logLevel ?? 'info' },
		};

		let stackTracePromise;
		if (!this.getConfig()?.disableCallOriginationLine) {
			stackTracePromise = getStackTrace();
		}

		this.activeRequests[requestId] = request;

		// Have to move our binaryPayload out of the args that will be encoded into JSON
		let binaryBuffer: Buffer | undefined;
		if (utils.isObjectWithProperty(request.args, 'binaryPayload')) {
			binaryBuffer = request.args.binaryPayload as Buffer;
			delete request.args.binaryPayload;
		}

		const stringPayload = JSON.stringify(request);

		// Build our header buffer with the lengths so we know on the receiving how much data we're expecting for the message before it is considered complete
		const headerBuffer = Buffer.alloc(8);
		headerBuffer.writeInt32LE(stringPayload.length, 0); // Write string payload length

		const requestBuffers = [headerBuffer, Buffer.from(stringPayload, 'utf-8')];
		if (binaryBuffer) {
			headerBuffer.writeInt32LE(binaryBuffer.length, 4); // Write binary payload length
			requestBuffers.push(binaryBuffer);
		}

		if (!this.clientSocket) {
			this.clientSocket = await this.setupClientSocket();
		}

		if (this.getConfig()?.restoreRegistry && !this.storedDeviceRegistry) {
			this.debugLog('Storing original device registry state');
			// Have to set a temporary value or else it will loop indefinitely
			this.storedDeviceRegistry = {};
			const result = await this.readRegistry();
			this.storedDeviceRegistry = result.values;
		}

		this.debugLog('Sending request:', stringPayload);
		// Combining into one buffer as it sends separately if we do multiple writes which with TCP could potentially introduce extra latency
		this.clientSocket.write(Buffer.concat(requestBuffers));

		// eslint-disable-next-line no-async-promise-executor
		const promise = new Promise<ODC.RequestResponse>(async (resolve, reject) => {
			request.callback = async (response) => {
				const json = response.json;
				this.debugLog('Received response:', response.json);
				if (json?.success) {
					resolve(response);
				} else {
					const errorMessage = `${json?.error?.message} ${this.getCaller(await stackTracePromise)}`;
					reject(new Error(errorMessage));
				}
			};
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
					message += `${this.getCaller(await stackTracePromise)}\n`;
				}

				if (!this.getConfig()?.disableTelnet) {
					const logs = await this.device.getTelnetLog();
					message += `Log contents:\n${logs}`;
				}
				e = new Error(message);
			}
			throw e;
		}
	}

	public async shutdown() {
		this.debugLog(`Shutting down`);

		if (this.storedDeviceRegistry) {
			this.debugLog(`Restoring device registry to original state`);
			await this.writeRegistry({
				values: this.storedDeviceRegistry
			});
		}
		this.clientSocket?.destroy();
		this.clientSocket = undefined;
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
		if (this.getConfig()?.clientDebugLogging) {
			console.log(`[ODC] ${message}`, ...args);
		}
	}
}
