import * as needle from 'needle';
import * as rokuDeploy from 'roku-deploy';
import * as fsExtra from 'fs-extra';
import * as querystring from 'needle/lib/querystring';
import * as mocha from 'mocha';

import { ConfigOptions } from './types/ConfigOptions';
import { utils } from './utils';

export class RokuDevice {
	public deployed = false;
	private config?: ConfigOptions;
	private needle = needle;

	constructor(config?: ConfigOptions) {
		this.config = config;
	}

	public getConfig() {
		const section = 'RokuDevice';
		if (!this.config) {
			const config = utils.getConfigFromEnvironment();
			utils.validateRTAConfigSchema(config, [section]);
			this.config = config;
		}
		return this.config?.[section];
	}

	public getCurrentDeviceConfig() {
		const section = 'RokuDevice';
		if (!this.config) {
			const config = utils.getConfigFromEnvironment();
			utils.validateRTAConfigSchema(config, [section]);
			this.config = config;
		}
		const configSection = this.getConfig();
		return configSection.devices[configSection.deviceIndex ?? 0];
	}

	public async deploy(options?: rokuDeploy.RokuDeployOptions, args?: {
		injectTestingFiles?: boolean,
		preventMultipleDeployments: boolean
	}) {
		if (args?.preventMultipleDeployments !== false) {
			if (this.deployed) return;
		}

		const deviceConfig = this.getCurrentDeviceConfig();
		options = rokuDeploy.getOptions(options);
		options.host = deviceConfig.host;
		options.password = deviceConfig.password;

		if (args?.injectTestingFiles !== false) {
			const files = options.files ?? [];
			files.push({
				src: __dirname + '/../../device/**/*',
				dest: '/'
			});
			options.files = files;
		}

		await rokuDeploy.deploy(options, (info) => {
			const manifestPath = `${info.stagingFolderPath}/manifest`;
			const manifestContents = fsExtra.readFileSync(manifestPath, 'utf-8').replace('ENABLE_RTA=false', 'ENABLE_RTA=true');
			fsExtra.writeFileSync(manifestPath, manifestContents);
		});
		this.deployed = true;
	}

	public async sendECP(path: string, params?: object, body?: needle.BodyData): Promise<needle.NeedleResponse> {
		let url = `http://${this.getCurrentDeviceConfig().host}:8060/${path}`;

		if (params && Object.keys(params).length) {
			url = url.replace(/\?.*|$/, '?' + querystring.build(params));
		}

		if (body !== undefined) {
			return this.needle('post', url, body, this.getOptions());
		} else {
			return this.needle('get', url, this.getOptions());
		}
	}

	/**
	 * @param outputFilePath - Where to output the generated screenshot. Extension is automatically appended based on what type of screenshotFormat you have specified for this device
	 */
	public async getScreenshot(outputFilePath: string) {
		await this.generateScreenshot();
		return await this.saveScreenshot(outputFilePath);
	}

	public async getTestScreenshot(contextOrSuite: mocha.Context | mocha.Suite) {
		await this.getScreenshot(utils.getTestTitlePath(contextOrSuite).join('/'));
	}

	private async generateScreenshot() {
		const url = `http://${this.getCurrentDeviceConfig().host}/plugin_inspect`;
		const data = {
			archive: '',
			mysubmit: 'Screenshot'
		};
		const options = this.getOptions(true);
		options.multipart = true;
		return await this.needle('post', url, data, options);
	}

	private async saveScreenshot(outputFilePath: string) {
		const deviceConfig = this.getCurrentDeviceConfig();
		await utils.ensureDirExistForFilePath(outputFilePath);
		const options = this.getOptions(true);
		const ext = `.${deviceConfig.screenshotFormat}`;
		options.output = outputFilePath + ext;
		const url = `http://${deviceConfig.host}/pkgs/dev${ext}`;
		let result = await this.needle('get', url, options);
		if (result.statusCode !== 200) {
			throw new Error(`Could not download screenshot at ${url}. Make sure you have the correct screenshot format in your config`);
		}
		return options.output;
	}

	private getOptions(requiresAuth: boolean = false) {
		const options: needle.NeedleOptions = {};
		if (requiresAuth) {
			options.username = 'rokudev';
			options.password = this.getCurrentDeviceConfig().password;
			options.auth = 'digest';
		}

		/** Useful for debugging port 80 and ECP communication between Roku and server */
		options.proxy = '';
		return options;
	}
}
