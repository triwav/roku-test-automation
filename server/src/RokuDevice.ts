import * as needle from 'needle';
import querystring from 'needle/lib/querystring';
import { ScreenshotFormat } from './types/ConfigOptions';
import * as utils from './utils';

export class RokuDevice {
	public ip: string;
	public password: string;
	private debugProxy = '';
	private screenshotFormat: ScreenshotFormat;

	constructor(ip: string, password: string, screenshotFormat: ScreenshotFormat = 'jpg') {
		this.ip = ip;
		this.password = password;
		this.screenshotFormat = screenshotFormat;
	}

	public setDebugProxy(debugProxy: string) {
		this.debugProxy = debugProxy;
	}

	public async sendECP(path: string, params?: object, body?: needle.BodyData): Promise<needle.NeedleResponse> {
		let url = `http://${this.ip}:8060/${path}`;

		if (params && Object.keys(params).length) {
			url = url.replace(/\?.*|$/, '?' + querystring.build(params));
		}

		if (body !== undefined) {
			return await needle('post', url, body, this.getOptions());
		} else {
			return await needle('get', url, this.getOptions());
		}
	}

	/**
	 * @param outputFilePath - Where to output the generated screenshot. Extension is automatically appended based on what type of screenshotFormat you have specified for this device
	 */
	public async getScreenshot(outputFilePath: string) {
		await this.generateScreenshot();
		await this.saveScreenshot(outputFilePath);
	}

	public async getTestScreenshot(contextOrSuite: Mocha.Context | Mocha.Suite) {
		await this.getScreenshot(utils.getTestTitlePath(contextOrSuite).join('/'));
	}

	private async generateScreenshot() {
		const url = `http://${this.ip}/plugin_inspect`;
		const data = {
			archive: '',
			mysubmit: 'Screenshot'
		};
		const options = this.getOptions(true);
		options.multipart = true;
		return await needle('post', url, data, options);
	}

	private async saveScreenshot(outputFilePath: string) {
		await utils.ensureDirExistForFilePath(outputFilePath);
		const options = this.getOptions(true);
		const ext = `.${this.screenshotFormat}`;
		options.output = outputFilePath + ext;
		const url = `http://${this.ip}/pkgs/dev${ext}`;
		let result = await needle('get', url, options);
		if (result.statusCode !== 200) {
			throw new Error(`Could not download screenshot at ${url}`);
		}
	}

	private getOptions(requiresAuth: boolean = false) {
		const options: needle.NeedleOptions = {};
		if (requiresAuth) {
			options.username = 'rokudev';
			options.password = this.password;
			options.auth = 'digest';
		}

		if (this.debugProxy.length > 0) {
			options.proxy = this.debugProxy;
		}
		return options;
	}
}
