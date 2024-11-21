import type { Socket } from 'net';

export enum RequestType {
	callFunc = 'callFunc',
	cancelOnFieldChangeRepeat = 'cancelOnFieldChangeRepeat',
	createDirectory = 'createDirectory',
	createChild = 'createChild',
	deleteFile = 'deleteFile',
	deleteNodeReferences = 'deleteNodeReferences',
	deleteRegistrySections = 'deleteRegistrySections',
	deleteEntireRegistry = 'deleteEntireRegistry',
	disableScreenSaver = 'disableScreenSaver',
	findNodesAtLocation = 'findNodesAtLocation',
	focusNode = 'focusNode',
	getAllCount = 'getAllCount',
	getApplicationStartTime = 'getApplicationStartTime',
	getDirectoryListing = 'getDirectoryListing',
	getFocusedNode = 'getFocusedNode',
	getNodesInfo = 'getNodesInfo',
	getNodesWithProperties = 'getNodesWithProperties',
	getRootsCount = 'getRootsCount',
	getServerHost = 'getServerHost',
	getValue = 'getValue',
	getValues = 'getValues',
	getVolumeList = 'getVolumeList',
	hasFocus = 'hasFocus',
	isInFocusChain = 'isInFocusChain',
	isSubtype = 'isSubtype',
	isShowingOnScreen = 'isShowingOnScreen',
	onFieldChangeOnce = 'onFieldChangeOnce',
	onFieldChangeRepeat = 'onFieldChangeRepeat',
	readFile = 'readFile',
	readRegistry = 'readRegistry',
	removeNode = 'removeNode',
	removeNodeChildren = 'removeNodeChildren',
	renameFile = 'renameFile',
	setSettings = 'setSettings',
	setValue = 'setValue',
	startResponsivenessTesting = 'startResponsivenessTesting',
	getResponsivenessTestingData = 'getResponsivenessTestingData',
	stopResponsivenessTesting = 'stopResponsivenessTesting',
	statPath = 'statPath',
	storeNodeReferences = 'storeNodeReferences',
	writeFile = 'writeFile',
	writeRegistry = 'writeRegistry',
}

export type RequestArgs = CallFuncArgs | CreateChildArgs | GetFocusedNodeArgs | GetValueArgs | GetValuesArgs | HasFocusArgs | IsInFocusChainArgs | OnFieldChangeOnceArgs | CancelOnFieldChangeRepeatArgs | SetValueArgs | ReadRegistryArgs | WriteRegistryArgs | DeleteRegistrySectionsArgs | DeleteEntireRegistrySectionsArgs | StoreNodeReferencesArgs | GetNodesInfoArgs | FindNodesAtLocationArgs | CreateDirectoryArgs | DeleteEntireRegistrySectionsArgs | DeleteFileArgs | DeleteNodeReferencesArgs | DisableScreensaverArgs | FocusNodeArgs | GetAllCountArgs | GetDirectoryListingArgs | GetNodesWithPropertiesArgs | GetRootsCountArgs | GetServerHostArgs | GetVolumeListArgs | IsShowingOnScreenArgs | IsSubtypeArgs | ReadFileArgs | RenameFileArgs | SetSettingsArgs | StartResponsivenessTestingArgs | StatPathArgs | WriteFileArgs | RemoveNodeArgs |RemoveNodeChildrenArgs | DisableScreensaverArgs;

export enum BaseType {
	global = 'global',
	scene = 'scene',
	nodeRef = 'nodeRef',
	focusedNode = 'focusedNode'
}

export declare type LogLevels = 'off' | 'error' | 'warn' | 'info' | 'debug' | 'verbose';

interface NodeRefKey {
	/** If base is 'nodeRef' this is the key that we used to store the node references on. If one isn't provided we use the automatically generated one */
	nodeRefKey?: string;
}

export interface BaseArgs extends NodeRefKey {
	/** Specifies what the entry point is for this key path. Defaults to 'global' if not specified */
	base?: BaseType |  keyof typeof BaseType;
}

export interface BaseKeyPath extends BaseArgs, MaxChildDepth {
	/** Holds the hierarchy value with each level separated by dot for ex: videoNode.title to what you are interested in getting the value from or written to. */
	keyPath?: string;

	/** We have to convert nodes before converting to json. If this isn't needed then it can be avoided using this param as this causes a fairly significant overhead */
	convertResponseToJsonCompatible?: boolean;
}

interface MaxChildDepth {
	/** Controls how deep we'll recurse into node's tree structure. Defaults to 0 */
	responseMaxChildDepth?: number;
}

export interface RequestOptions {
	/** How long to wait (in milliseconds) until the request is considered a failure. If not provided OnDeviceComponent.defaultTimeout is used  */
	timeout?: number;

	/** Allows for passing in a socket to allow sending a request before our socket promise has resolved */
	socket?: Socket;
}

export interface Request {
	id: string;
	args: RequestArgs;
	type: RequestType;
	callback?: (response: RequestResponse) => void;
}

export interface RequestResponse {
	json: any;
	stringLength: number;
	binaryLength: number;
	stringPayload: string;
	binaryPayload: Buffer;
}

export interface NodeRepresentation {
	// Allow other fields
	[key: string]: any;
	change: {
		Index1: number;
		Index2: number;
		Operation: string;
	};
	childRenderOrder?: 'renderFirst' | 'renderLast';
	children?: NodeRepresentation[];
	clippingRect?: [number, number, number, number];
	enableRenderTracking?: boolean;
	focusedChild: NodeRepresentation;
	focusable: boolean;
	id: string;
	inheritParentOpacity?: boolean;
	inheritParentTransform?: boolean;
	muteAudioGuide?: boolean;
	opacity?: number;
	renderPass?: number;
	renderTracking?: 'none' | 'partial' | 'full';
	rotation?: number;
	scale?: [number, number];
	scaleRotateCenter?: [number, number];
	subtype: string;
	translation?: [number, number];
	visible?: boolean;
}

export interface TreeNode {
	/** What type of node this as returned by node.subtype() */
	subtype: string;

	id: string;

	visible?: boolean;

	opacity?: number;

	translation?: number[];

	/** This is the reference to the index it was stored at that we can use in later calls. If -1 we don't have one. */
	ref: number;

	/** Same as ref but for the parent  */
	parentRef: number;

	/** Used to determine the position of this node in its parent if applicable */
	position: number;

	/** keyPath that can be used to access this node */
	keyPath: string;

	/** The boundingRect of this node if we needed to get it */
	rect?: BoundingRect

	/** The sceneBoundingRect of this node if we requested to get it */
	sceneRect?: BoundingRect

	children: TreeNode[];
}

export interface BoundingRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface ReturnTimeTaken {
	/** How long this request took to run on the device */
	timeTaken: number;
}

export interface CallFuncArgs extends BaseKeyPath {
	/** Name of the function that needs to be called. */
	funcName: string;

	/** List of input arguments that need to be passed to the function. */
	funcParams?: any[];
}

export interface GetComponentGlobalAAKeyPath extends BaseKeyPath {
	/** Key path for selecting what to pull from the component's `m` associative array  */
	componentGlobalAAKeyPath: string;
}

export interface SetComponentGlobalAAKeyPath extends BaseKeyPath {
	/** Key path for selecting what to set on the component's `m` associative array. */
	componentGlobalAAKeyPath: string;

	/** Value to set for the supplied `componentGlobalAAKeyPath` */
	componentGlobalAAKeyPathValue: any;
}

export interface GetFocusedNodeArgs extends MaxChildDepth, NodeRefKey {
	/** returns `ref` field in response that can be matched up with storeNodeReferences response for determining where we are in the node tree */
	includeRef?: boolean;

	/** If you only need access to the `ref` or `keyPath` in the output then you can speed up the request by choosing not to include the node in the response. Defaults to true */
	includeNode?: boolean;

	/** If true, will try to return the actual ArrayGrid itemComponent that is currently focused */
	returnFocusedArrayGridChild?: boolean;
}

export interface GetValueArgs extends BaseKeyPath {
	/** Allows supplying a keypath to a node and the field fpr that node separately to allow for better integration with an elements library */
	field?: string;
}

export interface GetValuesArgs {
	/** Retrieve multiple values with a single request. A list of the individual getValue args */
	requests: {
		[key: string]: GetValueArgs;
	};
}

export interface GetNodesInfoArgs extends GetValuesArgs {}

export interface HasFocusArgs extends BaseKeyPath {}

export interface IsInFocusChainArgs extends BaseKeyPath {}

export interface StoreNodeReferencesArgs extends NodeRefKey {
	/** We can get ArrayGrid(RowList,MarkupGrid,etc) children but this has an extra overhead so is disabled by default */
	includeArrayGridChildren?: boolean;

	/** We can get total and type based count info but again this has some overhead so is disabled by default */
	includeNodeCountInfo?: boolean;

	/** We can get the boundingRect info for each stored node. Again this has a performance penalty so is turned off by default */
	includeBoundingRectInfo?: boolean;
}

export interface StoreNodeReferencesResponse extends ReturnTimeTaken {
	flatTree: TreeNode[];
	rootTree: TreeNode[];
	totalNodes?: number;
	nodeCountByType?: {[key: string]: number}
	currentDesignResolution?: {
		width: number;
		height: number;
		resolution: 'FHD' | 'HD';
	}
}

export interface DeleteNodeReferencesArgs extends NodeRefKey {}

export interface DisableScreensaverArgs {
	/** Set to true to disable screensaver from starting, false to allow screensaver to start at the appropriate time */
	disableScreensaver: boolean;
}

export interface StartResponsivenessTestingArgs {
	/** Sets how long a 'tick' is. Any render thread unresponsiveness shorter than this tick duration will not be captured. Number is in milliseconds and defaults to 17
	 */
	tickDuration?: number;

	/** Sets the number of ticks we are shooting for in each period and is multiplied by tickDuration to set our timer duration */
	periodTickCount?: number;

	/** Sets how many periods we will keep in the stored data before we start throwing out older periods. Defaults to 10 */
	periodsTrackCount?: number;
}

export interface FocusNodeArgs extends BaseKeyPath {
	/** Set to false to take away focus from the node. Defaults to true */
	on?: boolean;
}

export interface CreateChildArgs extends BaseKeyPath {
	subtype: string;
	fields?: Partial<NodeRepresentation>;
}

export interface RemoveNodeArgs extends BaseKeyPath {}

export interface RemoveNodeChildrenArgs extends BaseKeyPath {
	/** The first index of the node(s) that we want to remove */
	index: number;

	/** The total count of nodes we want to remove. -1 for all */
	count?: number;
}

export interface GetAllCountArgs {}

export interface GetRootsCountArgs {}

export interface GetVolumeListArgs {}

export interface Path {
	path: string;
}

export interface GetDirectoryListingArgs extends Path {}

export interface StatPathArgs extends Path {}

export interface CreateDirectoryArgs extends Path {}

export interface DeleteFileArgs extends Path {}

export interface RenameFileArgs {
	fromPath: string;
	toPath: string;
}

export interface ReadFileArgs extends Path {}

export interface WriteFileArgs extends Path {
	binaryPayload: Buffer
}

// IMPROVEMENT build out to support more complicated types
// rename to ComparableValueType in v3
export type ComparableValueTypes = string | number | boolean;

// rename to ComparisonOperator in v3
export type ComparisonOperators = '=' | '!=' | '>' | '>=' | '<' | '<=' | 'in' | '!in' | 'equal' | 'notEqual' | 'greaterThan' | 'greaterThanEqualTo' | 'lessThan' | 'lessThanEqualTo';

interface NodeComparison {
	/* defaults to equal if not provided */
	operator?: ComparisonOperators;

	/* field acts a shorthand to specify fields. */
	field?: string;

	/* only fields will be used if both fields and keyPaths are provided */
	fields?: string[];

	/* keyPath acts a shorthand to specify keyPaths */
	keyPath?: string;

	/* only fields will be used if both fields and keyPaths are provided */
	keyPaths?: string[];

	value: ComparableValueTypes;
}

export interface GetNodesWithPropertiesArgs extends MaxChildDepth, NodeRefKey {
	properties: NodeComparison[];
}

export interface FindNodesAtLocationArgs extends StoreNodeReferencesArgs {
	/** horizontal pixel position you wish to find nodes at. Defaults to a resolution of 1920 but can be changed with OnDeviceComponent.uiResolution **/
	x: number;

	/** vertical pixel position you wish to find nodes at. Defaults to a resolution of 1080 but can be changed with OnDeviceComponent.uiResolution */
	y: number;

	/** If doing a single `findNodesAtLocation` request, it's not a big deal to call storeNodeReferences on the Roku to get our rect info. If you wish to call repeatedly you can make it much faster by providing an existing response from `storeNodeReferences` */
	nodeTreeResponse?: StoreNodeReferencesResponse;

	/** Will always be true no matter what is passed in */
	includeBoundingRectInfo?: true;
}

export interface IsShowingOnScreenArgs extends BaseKeyPath {}

export interface IsSubtypeArgs extends BaseKeyPath {
	/** The subtype we are checking against */
	subtype: string;

	/** isSubtype does not normally match the current node's subtype which is usually not the desired behavior.
	 *  Because of this we also will match on the node's own subtype by default.
	 *  Setting this to false will make it match on only a descendant subtype.  */
	matchOnSelfSubtype?: boolean;
}

interface MatchObject extends GetValueArgs {
	/** If the match value is passed in then the observer will be fired when the field value equals to the value in match */
	value: ComparableValueTypes;
}

export interface OnFieldChangeOnceArgs extends BaseKeyPath {
	/** If the `keyPath` does not exist yet, this specifies how often to recheck to see if it now exists in milliseconds */
	retryInterval?: number;

	/** If the `keyPath` does not exist yet, this specifies how long to wait before erroring out in milliseconds */
	retryTimeout?: number;

	/** The field that we want to observe for changes on. If not supplied, the last part of `keyPath` will be used  */
	field?: string;

	/** If provided will only return when this matches (including if it already equals that value) */
	match?: MatchObject | ComparableValueTypes;
}

//We may could use OnFieldChangeArgs to avoid more code but to keep the pattern we've created this
export interface CancelOnFieldChangeRepeatArgs extends BaseKeyPath {
	/** requestId that should be canceled */
	cancelRequestId: string;
}

export interface SetValueArgs extends BaseKeyPath {
	/** Value that needs to be set to the field. Field path is defined by key path. */
	value: any;

	/** Used to specify whether we are setting a field on a node or if we're updating the node structure itself. If not defined, we take the last part of the keyPath and use it as the field */
	field?: string;
}

export interface ReadRegistryArgs {
	/** List of Section keys of which we need data to be read, if empty then it will return entire contents of the registry */
	values?: {
		[section: string]: string[] | string;
	};
}

export interface WriteRegistryArgs {
	/** Contains data that will be written to registry. If null is passed for a sectionItemKey that key will be deleted. If null is passed for a section that entire section will be deleted. */
	values: {
		[section: string]: {[sectionItemKey: string]: string | null}
	};
}

export interface DeleteRegistrySectionsArgs {
	/** Contains list of section keys that needs to be deleted. */
	sections: string[] | string;

	/** If true deletes the entry registry. */
	allowEntireRegistryDelete?: boolean;
}

export interface DeleteEntireRegistrySectionsArgs {}

export interface GetApplicationStartTimeArgs {}

export interface GetServerHostArgs {}

export interface SetSettingsArgs {
	logLevel: LogLevels;
}
