import * as express from 'express';

export enum RequestEnum {
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
export type RequestTypes = keyof typeof RequestEnum;

export enum KeyPathBaseEnum {
	global,
	scene
}
export type KeyPathBaseTypes = keyof typeof KeyPathBaseEnum;

export interface OnDeviceComponentRequest {
	type: RequestTypes;
	args: object;
	callback?: OnDeviceComponentRequestCallback;
}

type OnDeviceComponentRequestCallback = (req: express.Request) => void;
