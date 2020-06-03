import * as express from 'express';

export enum ODCRequestEnum {
	callFunc,
	hasFocus,
	isInFocusChain,
	getRoots,
	getValueAtKeyPath,
	getValuesAtKeyPaths,
	handshake,
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

export type ODCRequestArgs = ODCCallFuncArgs | ODCGetValueAtKeyPathArgs | ODCGetValuesAtKeyPathsArgs | ODCObserveFieldArgs | ODCSetValueAtKeyPathArgs | ODCHandshakeArgs;

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
