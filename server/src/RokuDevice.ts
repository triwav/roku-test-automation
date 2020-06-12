import * as needle from 'needle';
import * as querystring from 'needle/lib/querystring';
import { ConfigOptions } from './types/ConfigOptions';
import { utils } from './utils';

export class RokuDevice {
	public config?: ConfigOptions;
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
		const configSection = this.config?.[section];
		return configSection.devices[configSection.deviceIndex ?? 0];
	}

	public async sendECP(path: string, params?: object, body?: needle.BodyData): Promise<needle.NeedleResponse> {
		let url = `http://${this.getConfig().host}:8060/${path}`;

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

	public async getTestScreenshot(contextOrSuite: Mocha.Context | Mocha.Suite) {
		await this.getScreenshot(utils.getTestTitlePath(contextOrSuite).join('/'));
	}

	private async generateScreenshot() {
		const url = `http://${this.getConfig().host}/plugin_inspect`;
		const data = {
			archive: '',
			mysubmit: 'Screenshot'
		};
		const options = this.getOptions(true);
		options.multipart = true;
		return await this.needle('post', url, data, options);
	}

	private async saveScreenshot(outputFilePath: string) {
		const config = this.getConfig();
		await utils.ensureDirExistForFilePath(outputFilePath);
		const options = this.getOptions(true);
		const ext = `.${config.screenshotFormat}`;
		options.output = outputFilePath + ext;
		const url = `http://${config.host}/pkgs/dev${ext}`;
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
			options.password = this.getConfig().password;
			options.auth = 'digest';
		}

		/** Useful for debugging port 80 and ECP communication between Roku and server */
		options.proxy = '';
		return options;
	}
}
