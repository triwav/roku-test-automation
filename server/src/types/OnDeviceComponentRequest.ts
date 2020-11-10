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

export interface ODCCallFuncArgs {
	base?: ODCKeyPathBaseTypes;
	keyPath: string;
	funcName: string;
	funcParams?: any[];
}

// tslint:disable-next-line: no-empty-interface
export interface ODCGetFocusedNodeArgs {}

export interface ODCGetValueAtKeyPathArgs {
	base?: ODCKeyPathBaseTypes;
	keyPath: string;
	timeout?: number;
}

export interface ODCGetValuesAtKeyPathsArgs {
	requests: {
		[key: string]: ODCGetValueAtKeyPathArgs;
	};
}

export interface ODCHandshakeArgs {
	version: string;
	logLevel: ODCLogLevels;
}

export interface ODCHasFocusArgs {
	base?: ODCKeyPathBaseTypes;
	keyPath: string;
}

export interface ODCIsInFocusChainArgs {
	base?: ODCKeyPathBaseTypes;
	keyPath: string;
}

export interface ODCObserveFieldArgs {
	base?: ODCKeyPathBaseTypes;
	keyPath: string;
	retryInterval?: number; /** If the `keyPath` does not exist yet, this specifies how often to recheck to see if it now exists in milliseconds */
	retryTimeout?: number; /** If the `keyPath` does not exist yet, this specifies how long to wait before erroring out in milliseconds */
	match?: {
		/** Specifies what the entry point is for this key path. Defaults to 'global' if not specified  */
		base?: ODCKeyPathBaseTypes;
		keyPath: string;
		value: ODCObserveFieldMatchValueTypes;
	} | ODCObserveFieldMatchValueTypes;
}

// TODO build out to support more complicated types
export type ODCObserveFieldMatchValueTypes = string | number | boolean;

export interface ODCSetValueAtKeyPathArgs {
	base?: ODCKeyPathBaseTypes;
	keyPath: string;
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
