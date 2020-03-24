import * as fsExtra from 'fs-extra';
import * as Mocha from 'mocha';
import { ECP } from './ECP';
import { RokuDevice } from './RokuDevice';
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

export function setupFromConfig(config: ConfigOptions) {
	try {
		createCheckers(ConfigOptionsTi).ConfigOptions.check(config);
	} catch (e) {
		throw new Error(`Config failed validation: ${e.message}`);
	}

	const deviceConfig = config.device;

	const device = new RokuDevice(deviceConfig.ip, deviceConfig.password, deviceConfig.screenshotFormat);
	if (deviceConfig.proxy) {
		device.setProxy(deviceConfig.proxy);
	}
	const ecp = new ECP(device, config);

	return {
		device: device,
		ecp: ecp
	};
}

export function setupFromConfigFile(configFilePath: string = 'rta-config.json') {
	const config = readConfigFile(configFilePath);
	return setupFromConfig(config);
}

export function sleep(milliseconds: number) {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
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
