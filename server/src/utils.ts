import * as fsExtra from 'fs-extra';
import * as path from 'path';
import * as Mocha from 'mocha';

import { ConfigOptions, DeviceConfigOptions } from './types/ConfigOptions';

// TODO switch to class
export function readConfigFile(configFilePath: string = 'rta-config.json') {
	const config: ConfigOptions = JSON.parse(fsExtra.readFileSync(configFilePath, 'utf-8'));
	return config;
}

export function getMatchingDevices(config: ConfigOptions, deviceSelector: {}): { [key: string]: DeviceConfigOptions}  {
	const matchingDevices = {};
	config.devices.forEach((device, index) => {
		for (const key in deviceSelector) {
			const requestedValue = deviceSelector[key];
			if (device.properties[key] !== requestedValue) continue;
		}
		matchingDevices[index] = device;
	});

	return matchingDevices;
}

/** Helper for setting up process.env from a config */
export function setupEnvironmentFromConfigFile(configFilePath: string = 'rta-config.json', deviceSelector: {} | number = 0) {
	console.log('setupEnvironmentFromConfigFile');

	const config = readConfigFile(configFilePath);
	if (typeof deviceSelector === 'number') {
		config.deviceIndex = deviceSelector;
	} else {
		const matchingDevices = getMatchingDevices(config, deviceSelector);
		const keys = Object.keys(matchingDevices);
		if (keys.length === 0) {
			throw new Error('No devices matched the device selection criteria');
		}
		config.deviceIndex = parseInt(keys[0]);
	}
	process.env.rtaConfig = JSON.stringify(config);
}

export function getConfigFromEnvironment() {
	if (process.env.rtaConfig) {
		const config: ConfigOptions = JSON.parse(process.env.rtaConfig);
		return config;
	}
	throw new Error('Did not contain config at "process.env.rtaConfig"');
}

export function getOptionalConfigFromEnvironment() {
	try {
		return getConfigFromEnvironment();
	} catch (e) {
		return undefined;
	}
}

export function sleep(milliseconds: number) {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function promiseTimeout<T>(promise: Promise<T>, milliseconds: number, message?: string) {
	let timeout = new Promise<T>((resolve, reject) => {
		setTimeout(() => {
			if (message === undefined) {
				message = 'Timed out after ' + milliseconds + 'ms.';
			}
			reject(message);
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

export function addRandomPostfix(message: string, length: number = 2) {
	return `${message}-${randomStringGenerator(length)}`;
}
