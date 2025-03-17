import * as net from 'net';

import type { RokuDevice } from './RokuDevice';
import type { ConfigOptions } from './types/ConfigOptions';
import { utils } from './utils';
import * as ODC from './types/OnDeviceComponent';

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
	private clientSocketPromise?: Promise<net.Socket>;
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

	/**
	 * Get the full RTA config
	 */
	public getRtaConfig() {
		if (!this.config) {
			this.config = utils.getConfigFromEnvironmentOrConfigFile();
		}
		return this.config;
	}

	/**
	 * Get the OnDeviceComponent config from the full RTA config.
	 */
	public getConfig() {
		return this.getRtaConfig()?.OnDeviceComponent;
	}

	//#region requests run on render thread
	public async callFunc(args: ODC.CallFuncArgs, options: ODC.RequestOptions = {}) {
		this.conditionallyAddDefaultBase(args);
		this.conditionallyAddDefaultNodeReferenceKey(args);

		const result = await this.sendRequest(ODC.RequestType.callFunc, args, options);
		return result.json as {
			value: any
		} & ODC.ReturnTimeTaken;
	}

	public async getComponentGlobalAAKeyPath(args: ODC.GetComponentGlobalAAKeyPath, options: ODC.RequestOptions = {}) {
		const callFuncArgs: ODC.CallFuncArgs = {
			...args,
			funcName: 'RTA_componentOperation',
			funcParams: ['getComponentGlobalAAKeyPath', {
				componentGlobalAAKeyPath: args.componentGlobalAAKeyPath
			}]
		};
		delete callFuncArgs['componentGlobalAAKeyPath'];

		const output = await this.callFunc(callFuncArgs, options);

		if (!output) {
			throw new Error('Could not handle getComponentGlobalAAKeyPath request. Make sure you have added the current component xml path to injectFunctionsIntoComponents in your config');
		} else if (output.value.error) {
			throw new Error(output.value.error);
		} else {
			output.value = output.value.result;
		}
		return output;
	}

	public async setComponentGlobalAAKeyPath(args: ODC.SetComponentGlobalAAKeyPath, options: ODC.RequestOptions = {}) {
		const callFuncArgs: ODC.CallFuncArgs = {
			...args,
			funcName: 'RTA_componentOperation',
			funcParams: ['setComponentGlobalAAKeyPath', {
				componentGlobalAAKeyPath: args.componentGlobalAAKeyPath,
				componentGlobalAAKeyPathValue: args.componentGlobalAAKeyPathValue
			}]
		};
		delete callFuncArgs['componentGlobalAAKeyPath'];
		delete callFuncArgs['componentGlobalAAKeyPathValue'];

		const output = await this.callFunc(callFuncArgs, options);
		if (!output) {
			throw new Error('Could not handle setComponentGlobalAAKeyPath request. Make sure you have added the current component xml path to injectFunctionsIntoComponents in your config');
		} else if (output.value.error) {
			throw new Error(output.value.error);
		} else {
			output.value = output.value.result;
		}
		return output;
	}

	public async getValue(args: ODC.GetValueArgs, options: ODC.RequestOptions = {}) {
		this.conditionallyAddDefaultBase(args);
		this.conditionallyAddDefaultNodeReferenceKey(args);

		const result = await this.sendRequest(ODC.RequestType.getValue, args, options);
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

		const result = await this.sendRequest(ODC.RequestType.getValues, args, options);
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

		const result = await this.sendRequest(ODC.RequestType.getNodesInfo, args, options);
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

		const result = await this.sendRequest(ODC.RequestType.getFocusedNode, args, options);
		return result.json as {
			node?: ODC.NodeRepresentation;
			ref?: number;
			keyPath?: string;
		};
	}

	public async hasFocus(args: ODC.HasFocusArgs, options: ODC.RequestOptions = {}) {
		this.conditionallyAddDefaultBase(args);
		this.conditionallyAddDefaultNodeReferenceKey(args);

		const result = await this.sendRequest(ODC.RequestType.hasFocus, {...args, convertResponseToJsonCompatible: false}, options);
		return result.json.hasFocus as boolean;
	}

	public async isInFocusChain(args: ODC.IsInFocusChainArgs, options: ODC.RequestOptions = {}) {
		this.conditionallyAddDefaultBase(args);
		this.conditionallyAddDefaultNodeReferenceKey(args);

		const result = await this.sendRequest(ODC.RequestType.isInFocusChain, {...args, convertResponseToJsonCompatible: false}, options);
		return result.json.isInFocusChain as boolean;
	}

	public async onFieldChangeOnce(args: ODC.OnFieldChangeOnceArgs, options: ODC.RequestOptions = {}) {
		this.conditionallyAddDefaultBase(args);
		this.conditionallyAddDefaultNodeReferenceKey(args);
		args = this.breakOutFieldFromKeyPath(args);

		const match = args.match;
		if (match !== undefined) {
			// Check if it's an object. Also have to check constructor as array is also an instanceof Object, make sure it has the keyPath key
			if (((match instanceof Object) && (match.constructor.name === 'Object') && ('keyPath' in match))) {
				this.conditionallyAddDefaultBase(match);
			} else {
				// If it's not we take base and keyPath from the base, keyPath and field args
				args.match = {
					base: args.base,
					keyPath: args.keyPath,
					field: args.field,
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

		const result = await this.sendRequest(ODC.RequestType.onFieldChangeOnce, args, options);
		return result.json as {
			/** If a match value was provided and already equaled the requested value the observer won't get fired. This lets you be able to check if that occurred or not */
			observerFired: boolean;
			value: any;
		} & ODC.ReturnTimeTaken;
	}

	//This function onFieldChangeRepeat have a lot of repeated code, we may could create a common function to handle the common thing and just change the output based on if it has callback or not
	public async onFieldChangeRepeat(args: ODC.OnFieldChangeOnceArgs, options: ODC.RequestOptions = {}, callback: (response) => void) {
		this.conditionallyAddDefaultBase(args);
		this.conditionallyAddDefaultNodeReferenceKey(args);
		args = this.breakOutFieldFromKeyPath(args);

		const match = args.match;
		if (match !== undefined) {
			// Check if it's an object. Also have to check constructor as array is also an instanceof Object, make sure it has the keyPath key
			if (((match instanceof Object) && (match.constructor.name === 'Object') && ('keyPath' in match))) {
				this.conditionallyAddDefaultBase(match);
			} else {
				// If it's not we take base and keyPath from the base, keyPath and field args
				args.match = {
					base: args.base,
					keyPath: args.keyPath,
					field: args.field,
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

		//We wait because we need the result of the sendRequest to create the cancelObserverCallback
		const result = await this.sendRequest(ODC.RequestType.onFieldChangeRepeat, args, options, callback);
		//We return the cancel Observer Function to easily cancel the continous observer 
		const cancelObserverFunc = async () => {
			//Is json.id the correct place to extract the request ID?
			//const requestID = result.json.id
			const cancelStatus = await this.sendRequest(ODC.RequestType.cancelOnFieldChangeRepeat, {cancelRequestId: result.json.id});
			return cancelStatus;
		}
		
		return cancelObserverFunc;
	}

	public async setValue(args: ODC.SetValueArgs, options: ODC.RequestOptions = {}) {
		this.conditionallyAddDefaultBase(args);
		this.conditionallyAddDefaultNodeReferenceKey(args);

		args.convertResponseToJsonCompatible = false;

		const result = await this.sendRequest(ODC.RequestType.setValue, this.breakOutFieldFromKeyPath(args), options);

		return result.json as ODC.ReturnTimeTaken;
	}

	private conditionallyAddDefaultBase(args: ODC.BaseArgs) {
		if (!args.base) {
			args.base = (this.getConfig()?.defaultBase) ?? ODC.BaseType.scene;
		}
	}

	private conditionallyAddDefaultNodeReferenceKey(args: ODC.BaseArgs) {
		if (!args.nodeRefKey) {
			if (!args.base || args.base === 'nodeRef') {
				args.nodeRefKey = this.defaultNodeReferencesKey;
			}
		}
	}

	public async getAllCount(args: ODC.GetRootsCountArgs = {}, options: ODC.RequestOptions = {}) {
		const result = await this.sendRequest(ODC.RequestType.getAllCount, {...args, convertResponseToJsonCompatible: false}, options);
		return result.json as {
			totalNodes: number;
			nodeCountByType: {[key: string]: number}
		} & ODC.ReturnTimeTaken;
	}

	public async getRootsCount(args: ODC.GetRootsCountArgs = {}, options: ODC.RequestOptions = {}) {
		const result = await this.sendRequest(ODC.RequestType.getRootsCount, {...args, convertResponseToJsonCompatible: false}, options);
		return result.json as {
			totalNodes: number;
			nodeCountByType: {[key: string]: number}
		} & ODC.ReturnTimeTaken;
	}

	public async storeNodeReferences(args: ODC.StoreNodeReferencesArgs = {}, options: ODC.RequestOptions = {}) {
		this.conditionallyAddDefaultNodeReferenceKey(args);
		const result = await this.sendRequest(ODC.RequestType.storeNodeReferences, {...args, convertResponseToJsonCompatible: false}, options);
		const output = result.json as ODC.StoreNodeReferencesResponse;

		const rootTree = [] as ODC.TreeNode[];
		for (const tree of output.flatTree) {
			if (!tree.children) {
				tree.children = [];
			}

			if (tree.parentRef === -1) {
				rootTree.push(tree);
				continue;
			}

			const parentTree = output.flatTree[tree.parentRef];
			if (!parentTree.children) {
				parentTree.children = [];
			}

			parentTree.children.push(tree);
		}
		output.rootTree = rootTree;

		this.buildKeyPathsRecursively(rootTree);

		// sort children by position to make output more logical and add our keyPath on
		for (const tree of output.flatTree) {
			tree.children.sort((a, b) => a.position - b.position);
		}

		const designResolution = output.currentDesignResolution;
		if (designResolution) {
			let width = 1920;
			let height = 1080;
			if (this.getConfig()?.uiResolution === 'hd') {
				width = 1280;
				height = 720;
			}
			// We convert all the rects to the user's specified resolution so we don't have to mess with it in the future
			const xMultiplier = width / designResolution.width;
			const yMultiplier = height / designResolution.height;
			const flatTree = output.flatTree;
			for (const nodeTree of flatTree) {
				if (!nodeTree.sceneRect && nodeTree.rect) {
					// If we don't have a sceneRect then calculate it based off our parent sceneRect and our rect. Currently only used for ArrayGrid item component children
					const parentSceneRect = flatTree[nodeTree.parentRef]?.sceneRect;
					if (parentSceneRect) {
						const rect = nodeTree.rect;
						nodeTree.sceneRect = {
							width: rect.width,
							height: rect.height,
							x: parentSceneRect.x + rect.x,
							y: parentSceneRect.y + rect.y
						};
					}
				}

				const sceneRect = nodeTree.sceneRect;
				if (!sceneRect) {
					continue;
				}

				// For debugging if needed
				// nodeTree['originalSceneRect'] = {...sceneRect};

				sceneRect.x *= xMultiplier;
				sceneRect.y *= yMultiplier;
				sceneRect.width *= xMultiplier;
				sceneRect.height *= yMultiplier;
			}
		}
		return output;
	}

	private buildKeyPathsRecursively(nodeTrees: ODC.TreeNode[], keyPathParts = [] as string[], parentIsRowlistItem = false, parentIsTitleGroup = false) {
		for (const nodeTree of nodeTrees) {
			let keyPathPostfix = '';
			const currentNodeTreeKeyPathParts = [...keyPathParts];
			let isRowlistItem = false;
			let isTitleGroup = false;
			if (nodeTree.subtype === 'RowListItem') {
				currentNodeTreeKeyPathParts.push(nodeTree.position.toString());
				isRowlistItem = true;

				// We are supplying a keyPath for the Roku ArrayGrid internal components although they likely aren't needed
				keyPathPostfix = '.items.0.getParent().getParent()';
			} else if (parentIsRowlistItem) {
				if (nodeTree.subtype === 'MarkupGrid') {
					currentNodeTreeKeyPathParts.push('items');
					// We are supplying a keyPath for the Roku ArrayGrid internal components although they likely aren't needed
					keyPathPostfix = '.0.getParent()';
				} else if (nodeTree.subtype === 'Group') {
					currentNodeTreeKeyPathParts.push('title');
					isTitleGroup = true;

					// We are supplying a keyPath for the Roku ArrayGrid internal components although they likely aren't needed
					keyPathPostfix = '.getParent()';
				} else if (nodeTree.subtype === 'Label') {
					// This is a Roku generated label. We do our best effort to get a keyPath that will work with it
					currentNodeTreeKeyPathParts.push(`items.0.getParent().getParent().${nodeTree.position}`);
				} else {
					console.log('Encountered unexpected subtype ' + nodeTree.subtype);
				}
			} else if(parentIsTitleGroup) {
				// We don't want to append to currentNodeTreeKeyPathParts in this case
			} else if (nodeTree.id) {
				currentNodeTreeKeyPathParts.push('#' + nodeTree.id);
			} else if (nodeTree.position >= 0) {
				currentNodeTreeKeyPathParts.push(nodeTree.position.toString());
			}

			nodeTree.keyPath = currentNodeTreeKeyPathParts.join('.') + keyPathPostfix;

			this.buildKeyPathsRecursively(nodeTree.children, currentNodeTreeKeyPathParts, isRowlistItem, isTitleGroup);
		}
	}

	public async deleteNodeReferences(args: ODC.DeleteNodeReferencesArgs = {}, options: ODC.RequestOptions = {}) {
		this.conditionallyAddDefaultNodeReferenceKey(args);

		const result = await this.sendRequest(ODC.RequestType.deleteNodeReferences, {...args, convertResponseToJsonCompatible: false}, options);
		return result.json as ODC.ReturnTimeTaken;
	}

	public async getNodesWithProperties(args: ODC.GetNodesWithPropertiesArgs, options: ODC.RequestOptions = {}) {
		this.conditionallyAddDefaultNodeReferenceKey(args);

		// We allow short symbol operators but want to convert to a common format for simpler code on the Roku side
		const operatorConversion: {
			[key: string]: ODC.ComparisonOperators
		} = {
			'=': 'equal',
			'!=': 'notEqual',
			'>': 'greaterThan',
			'>=': 'greaterThanEqualTo',
			'<': 'lessThan',
			'<=': 'lessThanEqualTo'
		};

		for (const property of args.properties) {
			if (!property.operator) {
				// Default to equal if none was provided
				property.operator = 'equal';
			} else if (operatorConversion[property.operator]) {
				// Go ahead and see if need to convert the operator
				property.operator = operatorConversion[property.operator];
			}

			// Convert to standard fields input for the Roku's side
			if (property.field !== undefined) {
				if (property.fields !== undefined) {
					throw new Error('field and fields are mutually exclusive');
				}
				property.fields = [property.field];
				delete property.field;
			}

			if (property.fields === undefined) {
				// Convert to standard keyPaths input for the Roku's side
				if (property.keyPath !== undefined) {
					if (property.keyPaths !== undefined) {
						throw new Error('keyPath and keyPaths are mutually exclusive');
					}
					property.keyPaths = [property.keyPath];
					delete property.keyPath;
				}

				if (property.keyPaths === undefined) {
					throw new Error('No fields or keyPaths provided');
				}
			}
		}

		const result = await this.sendRequest(ODC.RequestType.getNodesWithProperties, args, options);
		return result.json as {
			nodes: ODC.NodeRepresentation[]
			nodeRefs: number[]
		} & ODC.ReturnTimeTaken;
	}

	private calculateRectCenterPoint(rect: ODC.BoundingRect) {
		return {
			x: (rect.x - rect.width) / 2,
			y: (rect.y - rect.height) / 2
		};
	}

	private calculateRectCenterPointOffsetFromLocation(x: number, y: number, rect: ODC.BoundingRect) {
		const centerPoint = this.calculateRectCenterPoint(rect);
		return {
			x: x - centerPoint.x,
			y: y - centerPoint.y
		};
	}

	public async findNodesAtLocation(args: ODC.FindNodesAtLocationArgs, options: ODC.RequestOptions = {}) {
		let nodeTreeResponse = args.nodeTreeResponse;
		if (!nodeTreeResponse) {
			args.includeBoundingRectInfo = true;
			nodeTreeResponse = await this.storeNodeReferences(args, options);
		}

		const matches = [] as ODC.TreeNode[];
		this.findNodesAtLocationCore(args.x, args.y, nodeTreeResponse.rootTree, matches);

		// We now want to sort our matches to try and return the best one first
		matches.sort((a, b) => {
			const aOffest = this.calculateRectCenterPointOffsetFromLocation(args.x, args.y, a.sceneRect as ODC.BoundingRect);
			const bOffset = this.calculateRectCenterPointOffsetFromLocation(args.x, args.y, b.sceneRect as ODC.BoundingRect);
			return (Math.abs(aOffest.x) + Math.abs(aOffest.y)) - (Math.abs(bOffset.x) + Math.abs(bOffset.y));
		});

		return {
			matches
		};
	}

	private findNodesAtLocationCore(x: number, y: number, nodeTrees: ODC.TreeNode[], matches: ODC.TreeNode[]) {
		let nodeFound = false;
		for (const nodeTree of nodeTrees) {
			// If we hit a sequestered item dig into its children immediately
			if (nodeTree['sequestered']) {
				nodeFound = this.findNodesAtLocationCore(x, y, nodeTree.children, matches);
			}

			const rect = nodeTree.sceneRect;
			if (!rect) {
				continue;
			}

			const isLocationWithinNodeDimensions = (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height);
			const isVisible = (nodeTree.visible && !!nodeTree.opacity);

			if (isLocationWithinNodeDimensions && isVisible) {
				if (!nodeTree.children.length) {
					matches.push(nodeTree);
					nodeFound = true;
				} else {
					nodeFound = this.findNodesAtLocationCore(x, y, nodeTree.children, matches);
				}

				// If we didn't find any children that were both visible and have x and y within the nodes dimensions then we add the current node to the list of matches. May eventually want to exclude some types like Group or LayoutGroup
				if (!nodeFound) {
					matches.push(nodeTree);
					nodeFound = true;
				}
			}
		}
		return nodeFound;
	}

	public async startResponsivenessTesting(args: ODC.StartResponsivenessTestingArgs = {}, options: ODC.RequestOptions = {}) {
		const result = await this.sendRequest(ODC.RequestType.startResponsivenessTesting, args, options);
		return result.json as ODC.ReturnTimeTaken;
	}

	public async getResponsivenessTestingData(args = {}, options: ODC.RequestOptions = {}) {
		const result = await this.sendRequest(ODC.RequestType.getResponsivenessTestingData, args, options);
		return result.json as ODC.ReturnTimeTaken & {
			periods: {
				/** Duration of this period in milliseconds */
				duration: number;

				/** What percent of the time during the period the render thread was responsive. Value is from 0-100 */
				percent: number;

				/** How many ticks there were in this period */
				tickCount: number;
			}[];
			periodsTrackCount: number;
			periodTickCount: number;
			testingTotals: {
				/** Total duration since testing started in milliseconds */
				duration: number;

				/** What percent of the time since testing started the render thread was responsive. Value is from 0-100 */
				percent: number;

				/** Total number of ticks since testing started */
				tickCount: number;
			}
			tickDuration: number;
		};
	}

	public async stopResponsivenessTesting(args = {}, options: ODC.RequestOptions = {}) {
		const result = await this.sendRequest(ODC.RequestType.stopResponsivenessTesting, args, options);
		return result.json as ODC.ReturnTimeTaken;
	}

	public async disableScreenSaver(args: ODC.DisableScreensaverArgs, options: ODC.RequestOptions = {}) {
		const result = await this.sendRequest(ODC.RequestType.disableScreenSaver, args, options);
		return result.json as ODC.ReturnTimeTaken;
	}

	public async focusNode(args: ODC.FocusNodeArgs, options: ODC.RequestOptions = {}) {
		this.conditionallyAddDefaultBase(args);
		this.conditionallyAddDefaultNodeReferenceKey(args);
		const result = await this.sendRequest(ODC.RequestType.focusNode, args, options);
		return result.json as ODC.ReturnTimeTaken;
	}

	public async createChild(args: ODC.CreateChildArgs, options: ODC.RequestOptions = {}) {
		this.conditionallyAddDefaultBase(args);
		this.conditionallyAddDefaultNodeReferenceKey(args);
		const result = await this.sendRequest(ODC.RequestType.createChild, args, options);
		return result.json as ODC.ReturnTimeTaken;
	}

	public async removeNode(args: ODC.RemoveNodeArgs, options: ODC.RequestOptions = {}) {
		this.conditionallyAddDefaultBase(args);
		this.conditionallyAddDefaultNodeReferenceKey(args);
		const result = await this.sendRequest(ODC.RequestType.removeNode, args, options);
		return result.json as ODC.ReturnTimeTaken;
	}

	public async removeNodeChildren(args: ODC.RemoveNodeChildrenArgs, options: ODC.RequestOptions = {}) {
		this.conditionallyAddDefaultBase(args);
		this.conditionallyAddDefaultNodeReferenceKey(args);
		const result = await this.sendRequest(ODC.RequestType.removeNodeChildren, args, options);
		return result.json as ODC.ReturnTimeTaken;
	}

	public async isShowingOnScreen(args: ODC.IsShowingOnScreenArgs, options: ODC.RequestOptions = {}) {
		this.conditionallyAddDefaultBase(args);
		this.conditionallyAddDefaultNodeReferenceKey(args);
		const result = await this.sendRequest(ODC.RequestType.isShowingOnScreen, args, options);
		return result.json as ODC.ReturnTimeTaken & {
			isShowing: boolean;
			isFullyShowing: boolean;
		};
	}

	public async isSubtype(args: ODC.IsSubtypeArgs, options: ODC.RequestOptions = {}) {
		this.conditionallyAddDefaultBase(args);
		const result = await this.sendRequest(ODC.RequestType.isSubtype, {...args, convertResponseToJsonCompatible: false}, options);
		return result.json.isSubtype as boolean;
	}
	//#endregion

	//#region requests run on task thread
	public async readRegistry(args: ODC.ReadRegistryArgs = {}, options: ODC.RequestOptions = {}) {
		const result = await this.sendRequest(ODC.RequestType.readRegistry, {...args, convertResponseToJsonCompatible: false}, options);
		return result.json as {
			values: {
				[section: string]: {[sectionItemKey: string]: string}
			}
		} & ODC.ReturnTimeTaken;
	}

	public async writeRegistry(args: ODC.WriteRegistryArgs, options: ODC.RequestOptions = {}) {
		const result = await this.sendRequest(ODC.RequestType.writeRegistry, args, options);
		return result.json;
	}

	public async deleteRegistrySections(args: ODC.DeleteRegistrySectionsArgs, options: ODC.RequestOptions = {}) {
		const result = await this.sendRequest(ODC.RequestType.deleteRegistrySections, args, options);
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
		const result = await this.sendRequest(ODC.RequestType.getVolumeList, args, options);
		return result.json as {
			list: string[]
		} & ODC.ReturnTimeTaken;
	}

	public async getDirectoryListing(args: ODC.GetDirectoryListingArgs, options: ODC.RequestOptions = {}) {
		const result = await this.sendRequest(ODC.RequestType.getDirectoryListing, args, options);
		return result.json as {
			list: string[]
		} & ODC.ReturnTimeTaken;
	}

	public async statPath(args: ODC.StatPathArgs, options: ODC.RequestOptions = {}) {
		const result = await this.sendRequest(ODC.RequestType.statPath, args, options);
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
		const result = await this.sendRequest(ODC.RequestType.createDirectory, args, options);
		return result.json as ODC.ReturnTimeTaken;
	}

	public async deleteFile(args: ODC.DeleteFileArgs, options: ODC.RequestOptions = {}) {
		const result = await this.sendRequest(ODC.RequestType.deleteFile, args, options);
		return result.json as ODC.ReturnTimeTaken;
	}

	public async renameFile(args: ODC.RenameFileArgs, options: ODC.RequestOptions = {}) {
		const result = await this.sendRequest(ODC.RequestType.renameFile, args, options);
		return result.json as ODC.ReturnTimeTaken;
	}

	public async readFile(args: ODC.ReadFileArgs, options: ODC.RequestOptions = {}) {
		const result = await this.sendRequest(ODC.RequestType.readFile, args, options);
		return result as {
			json: ODC.ReturnTimeTaken;
			binaryPayload: Buffer;
		};
	}

	public async writeFile(args: ODC.WriteFileArgs, options: ODC.RequestOptions = {}) {
		const result = await this.sendRequest(ODC.RequestType.writeFile, args, options);
		return result.json as ODC.ReturnTimeTaken;
	}

	public async getApplicationStartTime(args: ODC.GetApplicationStartTimeArgs = {}, options: ODC.RequestOptions = {}) {
		const result = await this.sendRequest(ODC.RequestType.getApplicationStartTime, args, options);
		return result.json as {
			startTime: number
		};
	}

	public async getServerHost(args: ODC.GetServerHostArgs = {}, options: ODC.RequestOptions = {}) {
		const result = await this.sendRequest(ODC.RequestType.getServerHost, args, options);
		return result.json as {
			host: string
		};
	}
	//#endregion

	//#region requests run on both
	public async setSettings(args: ODC.GetServerHostArgs = {}, options: ODC.RequestOptions = {}) {
		const result = await this.sendRequest(ODC.RequestType.setSettings, args, options);
		return result.json as ODC.ReturnTimeTaken;
	}
	//#endregion


	// In some cases it makes sense to break out the last key path part as `field` to simplify code on the device
	private breakOutFieldFromKeyPath(args: ODC.OnFieldChangeOnceArgs | ODC.SetValueArgs) {
		if (!args.keyPath) {
			args.keyPath = '';
		}

		if (args.field === undefined) {
			const keyPathParts = args.keyPath.split('.');
			return {...args, field: keyPathParts.pop(), keyPath: keyPathParts.join('.')};
		}

		return args;
	}

	private setupClientSocket(options: ODC.RequestOptions) {
		if (this.clientSocket) {
			return Promise.resolve(this.clientSocket);
		}

		if (this.clientSocketPromise) {
			return this.clientSocketPromise;
		}

		this.clientSocketPromise = new Promise<net.Socket>((resolve, reject) => {
			const port = 9000;
			const host = this.device.getCurrentDeviceConfig().host;
			const timeout = this.getTimeOut(options);
			const startTime = Date.now();
			const socket = new net.Socket();

			const socketConnect = () => {
				this.debugLog(`Attempting to connect to Roku at ${host} on port ${port}`);
				socket.connect(port, host);
			};

			socket.on('connect', () => {
				this.debugLog(`Connected to Roku at ${host} on port ${port}`);
				this.setSettings({
					logLevel: this.getConfig()?.logLevel ?? 'info'
				}, {
					socket: socket
				}).then(() => {
					resolve(socket);
				}, (e) => {
					this.debugLog('Could not set settings', e);
				});
			});

			socket.on('error', async (e) => {
				const errorCode: string = (e as any).code;
				if (errorCode === 'ECONNREFUSED' || errorCode === 'EPIPE') {
					if (Date.now() - startTime > timeout) {
						const error = new Error(`Failed to connect to Roku at ${host} on port ${port}. Make sure you have the on device component running on your Roku.`);
						reject(error);
						return;
					}

					this.clientSocket = undefined;
					await utils.sleep(1000);
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
				while (offset < data.length) {
					if (!this.receivingRequestResponse) {
						this.receivingRequestResponse = {
							json: {},
							stringLength: data.readInt32LE(0 + offset),
							binaryLength: data.readInt32LE(4 + offset),
							stringPayload: '',
							binaryPayload: Buffer.alloc(0)
						};
						offset += this.requestHeaderSize;
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
							offset += remainingBinaryPayload;
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

						//Delete active requests as usual if it is not of type onFieldChangeRepeat
						if (request.type != 'onFieldChangeRepeat'){
							delete this.activeRequests[json.id];
						}

						// On the case of request.type onFieldChangeRepeat we just proceed for deletion if it has request.args.cancelRequestId
						if (request.type == 'cancelOnFieldChangeRepeat'){
							if((request["args"] != null && request.args["cancelRequestId"] != null && this.activeRequests[request.args["cancelRequestId"]] != null)){
								delete this.activeRequests[request.args["cancelRequestId"]];
							}
						}
						
					}
				}
			});

			socketConnect();
		});

		this.clientSocketPromise.finally(() => {
			this.clientSocketPromise = undefined;
		});

		return this.clientSocketPromise;
	}

	private async sendRequest(type: ODC.RequestType, args: ODC.RequestArgs, options: ODC.RequestOptions = {}, callback?) {
		const requestId = utils.randomStringGenerator();
		const request: ODC.Request = {
			id: requestId,
			type: type,
			args: args
		};

		let stackTraceError: Error | undefined;
		if (!this.getConfig()?.disableCallOriginationLine) {
			stackTraceError = new Error();
		}

		this.activeRequests[requestId] = request;

		// Have to move our binaryPayload out of the args that will be encoded into JSON
		let binaryBuffer: Buffer | undefined;
		if (utils.isObjectWithProperty(request.args, 'binaryPayload')) {
			binaryBuffer = request.args.binaryPayload as Buffer;
			delete request.args.binaryPayload;
		}

		// We have to remove any non ascii character or else the device will stack overflow due to it only counting the multibyte character as one byte
		const stringPayload = JSON.stringify(request).replace(/[\x00-\x08\x0E-\x1F\x7F-\uFFFF]/g, ''); // eslint-disable-line no-control-regex

		// Build our header buffer with the lengths so we know on the receiving how much data we're expecting for the message before it is considered complete
		const headerBuffer = Buffer.alloc(8);
		headerBuffer.writeInt32LE(stringPayload.length, 0); // Write string payload length

		if (binaryBuffer) {
			headerBuffer.writeInt32LE(binaryBuffer.length, 4); // Write binary payload length
		}

		const requestBuffers = [headerBuffer, Buffer.from(stringPayload, 'utf-8')];
		if (binaryBuffer) {
			requestBuffers.push(binaryBuffer);
		}

		let clientSocket: net.Socket;
		if (options.socket) {
			clientSocket = options.socket;
		} else {
			clientSocket = await this.setupClientSocket(options);
			this.clientSocket = clientSocket;
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
		clientSocket.write(Buffer.concat(requestBuffers));

		const promise = new Promise<ODC.RequestResponse>((resolve, reject) => {
				request.callback = (response) => {
					try {
						const json = response.json;
						this.debugLog('Received response:', response.json);
						if (json?.error === undefined) {
							resolve(response);
							//Important to send response to the callback when onFieldChangeRepeat is used 
							if (callback){
								callback(response);
							};
						} else {
							let error: Error;
							if (stackTraceError) {
								error = stackTraceError;
								this.removeOnDeviceComponentFromErrorStack(error);
							} else {
								error = new Error();
							}
							error.message = `${json?.error?.message}`;
							reject(error);
						}
					} catch(e) {
						reject(e);
					}
				};
		});

		const timeout = this.getTimeOut(options);
		try {
			return await utils.promiseTimeout(promise, timeout);
		} catch(e) {
			if ((e as Error).name === 'Timeout') {
				let message = `${request.type} request timed out after ${timeout}ms`;

				if (!this.getConfig()?.disableTelnet) {
					const logs = await this.device.getTelnetLog();
					message += `Log contents:\n${logs}`;
				}
				e.message = message;
			}

			if (stackTraceError) {
				stackTraceError.message = e.message;
				e = stackTraceError;
				this.removeOnDeviceComponentFromErrorStack(e);
			}

			throw e;
		}
	}

	private removeOnDeviceComponentFromErrorStack(error: Error) {
		if (error.stack) {
			const stackParts = error.stack.split('\n');
			const modifiedStackParts = [] as string[];
			for (const stackPart of stackParts) {
				if (stackPart.indexOf('at OnDeviceComponent') === -1) {
					modifiedStackParts.push(stackPart);
				}
			}
			error.stack = modifiedStackParts.join('\n');
		}
		return error;
	}

	private getTimeOut(options: ODC.RequestOptions) {
		const deviceConfig = this.device.getCurrentDeviceConfig();
		let timeout = options?.timeout ?? deviceConfig.defaultTimeout ?? this.defaultTimeout;
		const multiplier = deviceConfig.timeoutMultiplier ?? 1;
		timeout *= multiplier;
		return timeout;
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

	private debugLog(message: string, ...args) {
		if (this.getConfig()?.clientDebugLogging) {
			const date = new Date;
			const formattedDate = `${utils.lpad(date.getMonth() + 1)}-${utils.lpad(date.getDate())} ${utils.lpad(date.getHours())}:${utils.lpad(date.getMinutes())}:${utils.lpad(date.getSeconds())}:${utils.lpad(date.getMilliseconds(), 3)}`;
			console.log(`${formattedDate} [ODC][${this.device.getCurrentDeviceConfig().host}] ${message}`, ...args);
		}
	}
}
