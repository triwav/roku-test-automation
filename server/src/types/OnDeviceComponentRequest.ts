import * as express from 'express';

export enum ODCRequestEnum {
	callFunc,
	deleteRegistrySections,
	getFocusedNode,
	getRoots,
	getServerHost,
	getValueAtKeyPath,
	getValuesAtKeyPaths,
	handshake,
	hasFocus,
	isInFocusChain,
	observeField,
	observeFocus,
	readRegistry,
	setFocus,
	setValueAtKeyPath,
	writeRegistry,
}
export type ODCRequestTypes = keyof typeof ODCRequestEnum;

export enum ODCKeyPathBaseEnum {
	global,
	scene
}
export type ODCKeyPathBaseTypes = keyof typeof ODCKeyPathBaseEnum;

export declare type ODCLogLevels = 'off' | 'error' | 'warn' | 'info' | 'debug' | 'verbose';

interface ODCBaseKeyPath {
	/** Specifies what the entry point is for this key path. Defaults to 'global' if not specified  */
	base?: ODCKeyPathBaseTypes;
	keyPath: string;
}

interface ODCMaxChildDepth {
	/** Controls how deep we'll recurse into node's tree structure. Defaults to 0 */
	maxChildDepth?: number;
}

export interface ODCCallFuncArgs extends ODCBaseKeyPath {
	funcName: string;
	funcParams?: any[];
}

export interface ODCGetFocusedNodeArgs extends ODCMaxChildDepth {}

export interface ODCGetValueAtKeyPathArgs extends ODCBaseKeyPath, ODCMaxChildDepth {}

export interface ODCGetValuesAtKeyPathsArgs {
	requests: {
		[key: string]: ODCGetValueAtKeyPathArgs;
	};
}

export interface ODCHandshakeArgs {
	version: string;
	logLevel: ODCLogLevels;
}

export interface ODCHasFocusArgs extends ODCBaseKeyPath {}

export interface ODCIsInFocusChainArgs extends ODCBaseKeyPath {}

// TODO build out to support more complicated types
export type ODCObserveFieldMatchValueTypes = string | number | boolean;

interface ODCMatchObject extends ODCBaseKeyPath {
	value: ODCObserveFieldMatchValueTypes;
}

export interface ODCObserveFieldArgs extends ODCBaseKeyPath {
	retryInterval?: number; /** If the `keyPath` does not exist yet, this specifies how often to recheck to see if it now exists in milliseconds */
	retryTimeout?: number; /** If the `keyPath` does not exist yet, this specifies how long to wait before erroring out in milliseconds */
	match?: ODCMatchObject | ODCObserveFieldMatchValueTypes;
}

export interface ODCSetValueAtKeyPathArgs extends ODCBaseKeyPath {
	value: any;
}

export interface ODCReadRegistryArgs {
	values?: {
		[section: string]: string[] | string
	};
}

export interface ODCWriteRegistryArgs {
	values: {
		[section: string]: {[sectionItemKey: string]: string | null}
	};
}

export interface ODCDeleteRegistrySectionsArgs {
	sections: string[] | string;
	allowEntireRegistryDelete?: boolean;
}

// tslint:disable-next-line: no-empty-interface
export interface ODCDeleteEntireRegistrySectionsArgs {}

// tslint:disable-next-line: no-empty-interface
export interface ODCGetServerHostArgs {}

export type ODCRequestArgs = ODCCallFuncArgs | ODCGetFocusedNodeArgs | ODCGetValueAtKeyPathArgs | ODCGetValuesAtKeyPathsArgs | ODCHasFocusArgs | ODCIsInFocusChainArgs | ODCObserveFieldArgs | ODCSetValueAtKeyPathArgs | ODCHandshakeArgs | ODCReadRegistryArgs | ODCWriteRegistryArgs | ODCDeleteRegistrySectionsArgs | ODCDeleteEntireRegistrySectionsArgs;

export interface ODCRequestOptions {
	/** How long to wait (in milliseconds) until the request is considered a failure. If not provided OnDeviceComponent.defaultTimeout is used  */
	timeout?: number;
}

export interface ODCRequest {
	id: string;
	callbackPort: number;
	args: ODCRequestArgs;
	type: ODCRequestTypes;
	settings: {
		logLevel: ODCLogLevels
	};
	callback?: (req: express.Request) => void;
	version: string;
}

export interface ODCNodeRepresentation {
	// Allow other fields
	[key: string]: any;
	change: {
		Index1: number
		Index2: number
		Operation: string
	};
	childRenderOrder?: 'renderFirst' | 'renderLast';
	children: ODCNodeRepresentation[];
	clippingRect?: [number, number, number, number];
	enableRenderTracking?: boolean;
	focusedChild: ODCNodeRepresentation;
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
