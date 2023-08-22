import type * as fsExtra from 'fs-extra';
import * as path from 'path';
import type * as Mocha from 'mocha';
import * as Ajv from 'ajv';
const ajv = new Ajv();

import type { ConfigOptions, DeviceConfigOptions } from './types/ConfigOptions';

class Utils {
	private path?: typeof path;

	private fsExtra?: typeof fsExtra;

	// We use a dynamic require to avoid an issue in the brightscript vscode extension
	private require<T>(id: string): T {
		return require(id) as T;
	}

	private getPath() {
		if (!this.path) {
			this.path = this.require<typeof path>('path');
		}
		return this.path;
	}

	private getFsExtra() {
		if (!this.fsExtra) {
			this.fsExtra = this.require<typeof fsExtra>('fs-extra');
		}
		return this.fsExtra;
	}

	/** Provides a way to easily get a path to device files for external access */
	public getDeviceFilesPath() {
		return this.getPath().resolve(__dirname + '/../../device');
	}

	/** Provides a way to easily get a path to client files for external access */
	public getClientFilesPath() {
		return this.getPath().resolve(__dirname + '/../');
	}

	public parseJsonFile(filePath: string) {
		return JSON.parse(this.getFsExtra().readFileSync(filePath, 'utf-8'));
	}

	public getMatchingDevices(config: ConfigOptions, deviceSelector: Record<string, any>): { [key: string]: DeviceConfigOptions} {
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

	public getConfigFromConfigFile(configFilePath = 'rta-config.json') {
		const config = this.getConfigFromConfigFileCore(configFilePath);
		this.validateRTAConfigSchema(config);

		return config;
	}

	private getConfigFromConfigFileCore(configFilePath = 'rta-config.json', parentConfigPaths: string[] = []) {
		configFilePath = path.resolve(configFilePath);
		let config: ConfigOptions;
		try {
			config = this.parseJsonFile(configFilePath);
		} catch(e) {
			throw utils.makeError('NoConfigFound', 'Config could not be found or parsed correctly.');
		}
		parentConfigPaths.push(configFilePath);

		if (config.extends) {
			const baseConfigFilePath = path.resolve(config.extends);
			if (parentConfigPaths.includes(baseConfigFilePath)) {
				throw new Error(`Circular dependency detected. '${baseConfigFilePath}' has already been included`);
			}

			const baseConfig = this.getConfigFromConfigFileCore(baseConfigFilePath, parentConfigPaths);

			for (const section of ['RokuDevice', 'ECP', 'OnDeviceComponent', 'NetworkProxy', 'NetworkProxy']) {
				// Override every field that was specified in the child
				for (const key in config[section]) {
					if (!baseConfig[section]) {
						baseConfig[section] = {};
					}
					baseConfig[section][key] = config[section][key];
				}
			}
			config = baseConfig;
		}

		return config;
	}

	/** Helper for setting up process.env from a config */
	setupEnvironmentFromConfig(config: ConfigOptions, deviceSelector?: Record<string, any> | number) {
		if (deviceSelector === undefined) {
			deviceSelector = config.RokuDevice.deviceIndex ?? 0;
		}

		if (typeof deviceSelector === 'number') {
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

	/** Helper for setting up process.env from a config file */
	public setupEnvironmentFromConfigFile(configFilePath = 'rta-config.json', deviceSelector: Record<string, any> | number | undefined = undefined) {
		const config = this.getConfigFromConfigFile(configFilePath);
		this.setupEnvironmentFromConfig(config);
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

	public getConfigFromEnvironmentOrConfigFile(configFilePath = 'rta-config.json') {
		let config = this.getOptionalConfigFromEnvironment();

		if (!config) {
			config = this.getConfigFromConfigFile(configFilePath);
		}

		return config;
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

		if (config) {
			this.validateRTAConfigSchema(config);
		}

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
		if (contextOrSuite.constructor.name === 'Context') {
			ctx = contextOrSuite as Mocha.Context;
		} else if (contextOrSuite.constructor.name === 'Suite') {
			ctx = contextOrSuite.ctx as Mocha.Context;
		} else {
			throw new Error('Neither Mocha.Context or Mocha.Suite passed in');
		}

		if (!(ctx.test?.constructor.name === 'Test')) {
			throw new Error('Mocha.Context did not contain test. At least surrounding Mocha.Suite must use non arrow function');
		}

		return ctx.test?.titlePath();
	}

	public generateFileNameForTest(contextOrSuite: Mocha.Context | Mocha.Suite, extension: string) {
		const titlePath = this.getTestTitlePath(contextOrSuite);
		return titlePath.join('/') + `.${extension}`;
	}

	public async ensureDirExistForFilePath(filePath: string) {
		await this.getFsExtra().ensureDir(this.getPath().dirname(filePath));
	}

	public randomStringGenerator(length = 7) {
		const p = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		return [...Array(length)].reduce((a) => a + p[~~(Math.random() * p.length)], '');
	}

	public addRandomPostfix(message: string, length = 2) {
		return `${message}-${this.randomStringGenerator(length)}`;
	}

	public isObjectWithProperty<Y extends PropertyKey>
    (obj: any, prop: Y): obj is Record<Y, unknown> {
        if (obj === null || typeof obj !== 'object') {
            return false;
        }
        // eslint-disable-next-line no-prototype-builtins
        return obj.hasOwnProperty(prop);
    }

	public convertValueToNumber(value: string | number | undefined, defaultValue = 0) {
		if (typeof value === 'number') {
			return value;
		} else if (typeof value === 'string') {
			return +value;
		}
		return defaultValue;
	}

	public lpad(value, padLength = 2, padCharacter = '0') {
		return value.toString().padStart(padLength, padCharacter);
	}

	public randomInteger(max = 2147483647, min = 0) {
		return Math.floor(Math.random() * (max - min + 1) ) + min;
	}
}

const utils = new Utils();
export { utils };
