import * as express from 'express';

export enum ODCRequestEnum {
	callFunc,
	getFocusedNode,
	getRoots,
	getValueAtKeyPath,
	getValuesAtKeyPaths,
	handshake,
	hasFocus,
	isInFocusChain,
	observeField,
	observeFocus,
	setFocus,
	setValueAtKeyPath
}
export type ODCRequestTypes = keyof typeof ODCRequestEnum;

export enum ODCKeyPathBaseEnum {
	global,
	scene
}
export type ODCKeyPathBaseTypes = keyof typeof ODCKeyPathBaseEnum;

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

export declare type ODCLogLevels = 'off' | 'error' | 'warn' | 'info' | 'debug' | 'verbose';

export interface ODCObserveFieldArgs {
	base?: ODCKeyPathBaseTypes;
	keyPath: string;
	match?: {
		/** Specifies what the entry point is for this key path. Defaults to 'global' if not specified  */
		base?: ODCKeyPathBaseTypes;
		keyPath: string;
		value: any;
	} | {
		value: any;
	};
}

export interface ODCSetValueAtKeyPathArgs {
	base?: ODCKeyPathBaseTypes;
	keyPath: string;
	value: any;
}

export type ODCRequestArgs = ODCCallFuncArgs | ODCGetFocusedNodeArgs | ODCGetValueAtKeyPathArgs | ODCGetValuesAtKeyPathsArgs | ODCHasFocusArgs | ODCIsInFocusChainArgs | ODCObserveFieldArgs | ODCSetValueAtKeyPathArgs | ODCHandshakeArgs;

export interface ODCRequestOptions {
	/** How long to wait (in milliseconds) until the request is considered a failure. If not provided OnDeviceComponent.defaultTimeout is used  */
	timeout?: number;
}

export interface ODCRequest {
	id: string;
	callbackPort: number;
	type: ODCRequestTypes;
	args: ODCRequestArgs;
	options?: ODCRequestOptions;
	callback?: (req: express.Request) => void;
}

export interface ODCNodeFields {
	id: string;
	focusedChild: ODCNodeFields;
	focusable: boolean;
	change: {
		Index1: number
		Index2: number
		Operation: string
	};

	// Group fields
	visible?: boolean;
	opacity?: number;
	translation?: [number, number];
	rotation?: number;
	scale?: [number, number];
	scaleRotateCenter?: [number, number];
	childRenderOrder?: 'renderFirst' | 'renderLast';
	inheritParentTransform?: boolean;
	inheritParentOpacity?: boolean;
	clippingRect?: [number, number, number, number];
	renderPass?: number;
	muteAudioGuide?: boolean;
	enableRenderTracking?: boolean;
	renderTracking?: 'none' | 'partial' | 'full';
}
