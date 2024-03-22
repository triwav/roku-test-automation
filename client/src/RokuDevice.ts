import * as needle from 'needle';
import * as rokuDeploy from 'roku-deploy';
import * as fsExtra from 'fs-extra';
import * as querystring from 'needle/lib/querystring';
import type * as mocha from 'mocha';
import * as net from 'net';
import * as path from 'path';

import type { ConfigOptions } from './types/ConfigOptions';
import { utils } from './utils';

export interface HttpRequestOptions {
	/** How many times to retry the request before throwing an error. Defaults to 3 if not specified */
	retryCount?: number;
}

export class RokuDevice {
	public deployed = false;
	private config?: ConfigOptions;
	private needle = needle;

	constructor(config?: ConfigOptions) {
		if (config) {
			this.setConfig(config);
		}
	}

	public setConfig(config: ConfigOptions) {
		utils.validateRTAConfigSchema(config);
		this.config = config;
	}

	/** Provides a way to get the whole config not just this classes' Config */
	public getRtaConfig() {
		if (!this.config) {
			this.config = utils.getConfigFromEnvironmentOrConfigFile();
		}
		return this.config;
	}

	public getConfig() {
		return this.getRtaConfig()?.RokuDevice;
	}

	public getCurrentDeviceConfig() {
		const configSection = this.getConfig();
		return configSection.devices[configSection.deviceIndex ?? 0];
	}

	public async deploy(options?: rokuDeploy.RokuDeployOptions & {
		injectTestingFiles?: boolean;
		preventMultipleDeployments?: boolean;
		deleteBeforeInstall?: boolean; // Remove in v3
	}, beforeZipCallback?: (info: rokuDeploy.BeforeZipCallbackInfo) => void) {
		options = rokuDeploy.getOptions(options);
		if (options.deleteInstalledChannel || options.deleteBeforeInstall) {
			try {
				await rokuDeploy.deleteInstalledChannel(options);
			} catch (e) {
				// note we don't report the error; as we don't actually care that we could not deploy - it's just useless noise to log it.
			}
		}
			await this.createPackage(options, beforeZipCallback);
			const result = await this.publish(options);
			this.deployed = true;
			return result;
    }

	public async createPackage(options?: rokuDeploy.RokuDeployOptions & {
		injectTestingFiles?: boolean;
	}, beforeZipCallback?: (info: rokuDeploy.BeforeZipCallbackInfo) => void) {
		const injectTestingFiles = options?.injectTestingFiles !== false;
		options = rokuDeploy.getOptions(options);

		if (injectTestingFiles) {
			const files = options.files ?? [];
			files.push({
				src: `${utils.getDeviceFilesPath()}/**/*`,
				dest: '/'
			});
			options.files = files;
		}

		await rokuDeploy.createPackage(options, (info) => {
			// Manifest modification
			const manifestPath = `${info.stagingDir}/manifest`;
			const manifestContents = fsExtra.readFileSync(manifestPath, 'utf-8').replace('ENABLE_RTA=false', 'ENABLE_RTA=true');
			fsExtra.writeFileSync(manifestPath, manifestContents);

			// update the xml components that we are injecting into
			const helperInjection = this.getRtaConfig()?.OnDeviceComponent?.helperInjection;
			if (helperInjection && helperInjection.enabled !== false) {
				for (const path of helperInjection.componentPaths) {
					const xmlComponentContents = fsExtra.readFileSync(`${info.stagingDir}/${path}`, 'utf-8');
					const updatedContents = this.injectRtaHelpersIntoComponentContents(xmlComponentContents);
					fsExtra.writeFileSync(`${info.stagingDir}/${path}`, updatedContents);
				}
			}

			if (beforeZipCallback) {
				beforeZipCallback(info);
			}
		});
	}

	public async publish(options?: rokuDeploy.RokuDeployOptions) {
		const deviceConfig = this.getCurrentDeviceConfig();
		options = rokuDeploy.getOptions(options);
		options.host = deviceConfig.host;
		options.password = deviceConfig.password;

		return await rokuDeploy.publish(options);
	}

	public getOutputZipFilePath(options: rokuDeploy.RokuDeployOptions) {
		return rokuDeploy.getOutputZipFilePath(options);
	}

	private injectRtaHelpersIntoComponentContents(contents: string) {
		// Find the position where we close the interface
		const searchForString = '</interface>';
		const endInterfacePosition = contents.indexOf(searchForString);

		// Now update the contents with our new injected content. Maintains single line to avoid line numbers getting off
		let updatedContents = contents.substring(0, endInterfacePosition);
		updatedContents += `<function name="RTA_componentOperation" />`;
		updatedContents += searchForString;
		updatedContents += `<script type="text/brightscript" uri="pkg:/components/RTA_helpers.brs" />`;
		updatedContents += contents.substring(endInterfacePosition + searchForString.length);
		return updatedContents;
	}

	public sendEcpPost(path: string, params = {}, body: needle.BodyData = '', options: HttpRequestOptions = {}): Promise<needle.NeedleResponse> {
		return this.sendEcp(path, params, body, options);
	}

	public sendEcpGet(path: string, params = {}, options: HttpRequestOptions = {}): Promise<needle.NeedleResponse> {
		return this.sendEcp(path, params, undefined, options);
	}

	private async sendEcp(path: string, params = {}, body?: needle.BodyData, options: HttpRequestOptions = {}): Promise<needle.NeedleResponse> {
		let url = `http://${this.getCurrentDeviceConfig().host}:8060/${path}`;
		let retryCount = options.retryCount;
		if (retryCount === undefined) {
			retryCount = 3;
		}

		if (params && Object.keys(params).length) {
			url = url.replace(/\?.*|$/, '?' + querystring.build(params));
		}

		try {
			if (body !== undefined) {
				return await this.needle('post', url, body, this.getNeedleOptions());
			} else {
				return await this.needle('get', url, this.getNeedleOptions());
			}
		} catch (e) {
			if ((retryCount - 1) > 0) {
				this.debugLog(`ECP request to ${url} failed. Retrying.`);
				// Want to delay retry slightly
				await utils.sleep(50);
				return this.sendEcp(path, params, body, {...options, retryCount: retryCount - 1});
			}
		}
		throw utils.makeError('sendEcpError', `ECP request to ${url} failed and no retries left`);
	}

	/**
	 * @param outputFilePath - Where to output the generated screenshot. Extension is automatically appended based on what type of screenshotFormat you have specified for this device
	 */
	public async getScreenshot(outputFilePath?: string) {
		await this.generateScreenshot();
		return await this.saveScreenshot(outputFilePath);
	}

	public async getTestScreenshot(contextOrSuite: mocha.Context | mocha.Suite, basePath = '', postFix = '', separator = '_') {
		const screenshotPath = path.join(basePath, utils.getTestTitlePath(contextOrSuite).join(separator)) + postFix;
		return await this.getScreenshot(screenshotPath);
	}

	public async getTelnetLog() {
		return new Promise<string>((resolve, reject) => {
			const socket = net.createConnection(8085, this.getCurrentDeviceConfig().host);

			let content = '';
			let timeout;
			socket.on('data', (data) => {
				content += String(data);

				// Cancel any previous timeout
				if (timeout) {
					clearTimeout(timeout);
				}

				// We might get more data so have to wait for that to come in before proceeding
				timeout = setTimeout(() => {
					resolve(this.processTelnetLog(content));
					socket.destroy();
				}, 400);
			});

			socket.on('close', () => {
				resolve(this.processTelnetLog(content) + '\nSocket Closed');
				socket.destroy();
			});

			socket.on('error', (e) => {
				reject(e);
				socket.destroy();
			});
		});
	}

	private processTelnetLog(content: string) {
		const lines = content.split('\n');
		const splitContents = [] as string[];
		for (const line of lines.reverse()) {
			splitContents.unshift(line);
			if (/------\s+compiling.*------/i.exec(line)) {
				break;
			}
		}
		return `Telnet output from ${this.getCurrentDeviceConfig().host}\n` + splitContents.join('\n');
	}

	private async generateScreenshot() {
		const url = `http://${this.getCurrentDeviceConfig().host}/plugin_inspect`;
		const data = {
			archive: '',
			mysubmit: 'Screenshot'
		};
		const options = this.getNeedleOptions(true);
		options.multipart = true;
		return await this.needle('post', url, data, options);
	}

	private async saveScreenshot(outputFilePath?: string) {
		const deviceConfig = this.getCurrentDeviceConfig();
		const options = this.getNeedleOptions(true);

		let ext = deviceConfig.screenshotFormat ?? 'jpg';
		if (outputFilePath) {
			await utils.ensureDirExistForFilePath(outputFilePath);
			options.output = `${outputFilePath}.${ext}`;
		}

		let url = `http://${deviceConfig.host}/pkgs/dev.${ext}`;
		let result = await this.needle('get', url, options);
		if (result.statusCode === 401) {
			throw new Error(`Could not download screenshot at ${url}. Make sure you have the correct device password`);
		} else if (result.statusCode === 404) {
			if (ext === 'jpg') {
				ext = 'png';
			} else {
				ext = 'jpg';
			}
			url = `http://${deviceConfig.host}/pkgs/dev.${ext}`;
			result = await this.needle('get', url, options);
			if (result.statusCode === 200) {
				console.log(`Device ${deviceConfig.host} screenshot format was ${deviceConfig.screenshotFormat}. Temporarily updating to ${ext}. Consider updating your config.`);
				deviceConfig.screenshotFormat = ext;
			}
		}

		if (result.statusCode !== 200) {
			throw new Error(`Could not download screenshot at ${url}. Make sure your sideloaded application is open`);
		}

		return {
			format: deviceConfig.screenshotFormat,
			buffer: result.body as Buffer,
			path: options.output
		};
	}

	private getNeedleOptions(requiresAuth = false) {
		const options: needle.NeedleOptions = {};
		if (requiresAuth) {
			options.username = 'rokudev';
			options.password = this.getCurrentDeviceConfig().password;
			options.auth = 'digest';
		}

		options.proxy = this.getConfig().proxy;
		return options;
	}

	private debugLog(message: string, ...args) {
		if (this.getConfig()?.clientDebugLogging) {
			console.log(`[NetworkProxy] ${message}`, ...args);
		}
	}
}
