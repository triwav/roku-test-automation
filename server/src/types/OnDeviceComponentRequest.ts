import * as express from 'express';

export enum RequestType {
	callFunc,
	hasFocus,
	isInFocusChain,
	getValueAtKeyPath,
	getValuesAtKeyPaths,
	handshake,
	observeField,
	observeFocus,
	setFocus,
	setValueAtKeyPath
}

export enum KeyPathBaseTypes {
	global,
	scene
}

export interface OnDeviceComponentRequest {
	type: RequestType;
	args: object;
	callback?: OnDeviceComponentRequestCallback;
}

type OnDeviceComponentRequestCallback = (req: express.Request) => void;
