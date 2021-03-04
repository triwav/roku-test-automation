import * as fsExtra from 'fs-extra';
import * as path from 'path';
import * as Mocha from 'mocha';
import * as Ajv from 'ajv';
const ajv = new Ajv();

import { ConfigOptions, DeviceConfigOptions, ConfigBaseKeyTypes } from './types/ConfigOptions';

class Utils {
	public getDeviceFilesPath() {
		return path.resolve(__dirname + '/../../device');
	}

	public parseJsonFile(filePath: string) {
		return JSON.parse(fsExtra.readFileSync(filePath, 'utf-8'));
	}

	public getMatchingDevices(config: ConfigOptions, deviceSelector: {}): { [key: string]: DeviceConfigOptions}  {
		const matchingDevices = {};
		config.RokuDevice.devices.forEach((device, index) => {
			for (const key in deviceSelector) {
				if (!device.properties) {
					continue;
				}
				const requestedValue = deviceSelector[key];
				if (device.properties[key] !== requestedValue) continue;
			}
			matchingDevices[index] = device;
		});

		return matchingDevices;
	}

	/** Helper for setting up process.env from a config */
	public setupEnvironmentFromConfigFile(configFilePath: string = 'rta-config.json', deviceSelector: {} | number = 0) {
		const config: ConfigOptions = this.parseJsonFile(configFilePath);
		if (!config.RokuDevice) {
			console.log('Config did not contain RokuDevice object!!!');
		} else if (typeof deviceSelector === 'number') {
			config.RokuDevice.deviceIndex = deviceSelector;
		} else {
			const matchingDevices = this.getMatchingDevices(config, deviceSelector);
			const keys = Object.keys(matchingDevices);
			if (keys.length === 0) {
				throw utils.makeError('NoMatchingDevicesFound', 'No devices matched the device selection criteria');
			}
			config.RokuDevice.deviceIndex = parseInt(keys[0]);
		}
		process.env.rtaConfig = JSON.stringify(config);
	}

	/** Validates the ConfigOptions schema the current class is using
	 * @param sectionsToValidate - if non empty array will only validate the sections provided instead of the whole schema
	 */
	public validateRTAConfigSchema(config: any) {
		const schema = utils.parseJsonFile(__dirname + '/../rta-config.schema.json');
		if (!ajv.validate(schema, config)) {
			const error = ajv.errors?.[0];
			throw utils.makeError('ConfigValidationError', `${error?.dataPath} ${error?.message}`);
		}
	}

	public getConfigFromEnvironment() {
		const config = this.getOptionalConfigFromEnvironment();
		if (!config) {
			throw this.makeError('MissingEnvironmentError', 'Did not contain config at "process.env.rtaConfig"');
		}
		return config;
	}

	public getOptionalConfigFromEnvironment() {
		if (!process.env.rtaConfig) return undefined;
		const config: ConfigOptions = JSON.parse(process.env.rtaConfig);
		return config;
	}

	public sleep(milliseconds: number) {
		return new Promise((resolve) => setTimeout(resolve, milliseconds));
	}

	public async promiseTimeout<T>(promise: Promise<T>, milliseconds: number, message?: string) {
		let timeout;
		const timeoutPromise = new Promise<T>((resolve, reject) => {
			timeout = setTimeout(() => {
				if (!message) {
					message = 'Timed out after ' + milliseconds + 'ms.';
				}
				reject(this.makeError('Timeout', message));
			}, milliseconds);
		});

		// Returns a race between our timeout and the passed in promise
		try {
			return await Promise.race([
				promise,
				timeoutPromise
			]);
		} finally {
			clearTimeout(timeout);
		}
	}

	public makeError(name: string, message: string) {
		const error = new Error(message);
		error.name = name;
		return error;
	}

	public getTestTitlePath(contextOrSuite: Mocha.Context | Mocha.Suite) {
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

	public generateFileNameForTest(contextOrSuite: Mocha.Context | Mocha.Suite, extension: string) {
		const titlePath = this.getTestTitlePath(contextOrSuite);
		return titlePath.join('/') + `.${extension}`;
	}

	public async ensureDirExistForFilePath(filePath: string) {
		await fsExtra.ensureDir(path.dirname(filePath));
	}

	public randomStringGenerator(length: number = 7) {
		const p = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		return [...Array(length)].reduce((a) => a + p[~~(Math.random() * p.length)], '');
	}

	public addRandomPostfix(message: string, length: number = 2) {
		return `${message}-${this.randomStringGenerator(length)}`;
	}
}

const utils = new Utils();
export { utils };
