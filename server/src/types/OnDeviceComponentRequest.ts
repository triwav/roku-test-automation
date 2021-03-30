import * as express from 'express';

export namespace ODC {
	export enum RequestEnum {
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
		readRegistry,
		setValueAtKeyPath,
		writeRegistry,
	}
	export type RequestTypes = keyof typeof RequestEnum;

	export enum KeyPathBaseEnum {
		global,
		scene
	}
	export type KeyPathBaseTypes = keyof typeof KeyPathBaseEnum;

	export declare type LogLevels = 'off' | 'error' | 'warn' | 'info' | 'debug' | 'verbose';

	interface BaseKeyPath {
		/** Specifies what the entry point is for this key path. Defaults to 'global' if not specified  */
		base?: KeyPathBaseTypes;
		keyPath: string;
	}

	interface MaxChildDepth {
		/** Controls how deep we'll recurse into node's tree structure. Defaults to 0 */
		maxChildDepth?: number;
	}

	export interface CallFuncArgs extends BaseKeyPath {
		funcName: string;
		funcParams?: any[];
	}

	export interface GetFocusedNodeArgs extends MaxChildDepth {}

	export interface GetValueAtKeyPathArgs extends BaseKeyPath, MaxChildDepth {}

	export interface GetValuesAtKeyPathsArgs {
		requests: {
			[key: string]: GetValueAtKeyPathArgs;
		};
	}

	export interface HandshakeArgs {
		version: string;
		logLevel: LogLevels;
	}

	export interface HasFocusArgs extends BaseKeyPath {}

	export interface IsInFocusChainArgs extends BaseKeyPath {}

	// TODO build out to support more complicated types
	export type ObserveFieldMatchValueTypes = string | number | boolean;

	interface MatchObject extends BaseKeyPath {
		value: ObserveFieldMatchValueTypes;
	}

	export interface ObserveFieldArgs extends BaseKeyPath {
		/** If the `keyPath` does not exist yet, this specifies how often to recheck to see if it now exists in milliseconds */
		retryInterval?: number;
		/** If the `keyPath` does not exist yet, this specifies how long to wait before erroring out in milliseconds */
		retryTimeout?: number;
		match?: MatchObject | ObserveFieldMatchValueTypes;
	}

	export interface SetValueAtKeyPathArgs extends BaseKeyPath {
		value: any;
	}

	export interface ReadRegistryArgs {
		values?: {
			[section: string]: string[] | string
		};
	}

	export interface WriteRegistryArgs {
		values: {
			[section: string]: {[sectionItemKey: string]: string | null}
		};
	}

	export interface DeleteRegistrySectionsArgs {
		sections: string[] | string;
		allowEntireRegistryDelete?: boolean;
	}

	// tslint:disable-next-line: no-empty-interface
	export interface DeleteEntireRegistrySectionsArgs {}

	// tslint:disable-next-line: no-empty-interface
	export interface GetServerHostArgs {}

	export type RequestArgs = CallFuncArgs | GetFocusedNodeArgs | GetValueAtKeyPathArgs | GetValuesAtKeyPathsArgs | HasFocusArgs | IsInFocusChainArgs | ObserveFieldArgs | SetValueAtKeyPathArgs | HandshakeArgs | ReadRegistryArgs | WriteRegistryArgs | DeleteRegistrySectionsArgs | DeleteEntireRegistrySectionsArgs;

	export interface RequestOptions {
		/** How long to wait (in milliseconds) until the request is considered a failure. If not provided OnDeviceComponent.defaultTimeout is used  */
		timeout?: number;
	}

	export interface Request {
		id: string;
		callbackPort: number;
		args: RequestArgs;
		type: RequestTypes;
		settings: {
			logLevel: LogLevels
		};
		callback?: (req: express.Request) => void;
		version: string;
	}

	export interface NodeRepresentation {
		// Allow other fields
		[key: string]: any;
		change: {
			Index1: number
			Index2: number
			Operation: string
		};
		childRenderOrder?: 'renderFirst' | 'renderLast';
		children: NodeRepresentation[];
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
}
