import * as fsExtra from 'fs-extra';
import * as path from 'path';
import * as Mocha from 'mocha';

import { RokuDevice } from './RokuDevice';
import { ECP } from './ECP';
import { OnDeviceComponent } from './OnDeviceComponent';

import { ConfigOptions } from './types/ConfigOptions';
import ConfigOptionsTi from './types/ConfigOptions-ti';
import { createCheckers } from 'ts-interface-checker';

export function readConfigFile(configFilePath: string = 'rta-config.json'): ConfigOptions {
	const config: ConfigOptions = JSON.parse(fsExtra.readFileSync(configFilePath, 'utf-8'));
	try {
		createCheckers(ConfigOptionsTi).ConfigOptions.check(config);
	} catch (e) {
		throw new Error(`Config '${configFilePath}' failed validation: ${e.message}`);
	}
	return config;
}

const deviceClasses = {};

export function setupFromConfig(config: ConfigOptions) {
	try {
		createCheckers(ConfigOptionsTi).ConfigOptions.check(config);
	} catch (e) {
		throw new Error(`Config failed validation: ${e.message}`);
	}

	const deviceConfig = config.device;
	if (deviceClasses[deviceConfig.ip]) return deviceClasses[deviceConfig.ip];
	const device = new RokuDevice(deviceConfig.ip, deviceConfig.password, deviceConfig.screenshotFormat);
	if (deviceConfig.debugProxy) {
		device.setDebugProxy(deviceConfig.debugProxy);
	}
	const ecp = new ECP(device, config);

	const odc = new OnDeviceComponent(device, config);

	const classes = {
		device: device,
		ecp: ecp,
		odc: odc
	};
	deviceClasses[deviceConfig.ip] = classes;
	return classes;
}

export function setupFromConfigFile(configFilePath: string = 'rta-config.json') {
	const config = readConfigFile(configFilePath);
	return setupFromConfig(config);
}

export function sleep(milliseconds: number) {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function promiseTimeout<T>(promise: Promise<T>, milliseconds: number) {
	let timeout = new Promise<T>((resolve, reject) => {
		setTimeout(() => {
			reject('Timed out after ' + milliseconds + 'ms.');
		}, milliseconds);
	});

	// Returns a race between our timeout and the passed in promise
	return Promise.race([
		promise,
		timeout
	]);
}

export function makeError(name: string, message: string) {
	const error = new Error(message);
	error.name = name;
	return error;
}

export function getTestTitlePath(contextOrSuite: Mocha.Context | Mocha.Suite) {
	let ctx: Mocha.Context;
	if (contextOrSuite instanceof Mocha.Context) {
		ctx = contextOrSuite;
	} else if (contextOrSuite instanceof Mocha.Suite) {
		ctx = contextOrSuite.ctx;
	} else {
		throw new Error('Neither Mocha.Context or Mocha.Suite passed in');
	}

	if (!(ctx.test instanceof Mocha.Test)) {
		throw new Error('Mocha.Context did not contain test. At least surrounding Mocha.Suite must use non arrow function');
	}

	return ctx.test.titlePath();
}

export function generateFileNameForTest(contextOrSuite: Mocha.Context | Mocha.Suite, extension: string) {
	const titlePath = getTestTitlePath(contextOrSuite);
	return titlePath.join('/') + `.${extension}`;
}

export async function ensureDirExistForFilePath(filePath: string) {
	await fsExtra.ensureDir(path.dirname(filePath));
}

export function randomStringGenerator(length: number = 7) {
	const p = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	return [...Array(length)].reduce((a) => a + p[~~(Math.random() * p.length)], '');
}
