import { RokuDevice } from './RokuDevice';
import { ActiveAppResponse } from './types/ActiveAppResponse';
import { ConfigOptions } from './types/ConfigOptions';
import { ECPKeys } from './types/ECPKeys';
import * as utils from './utils';

export class ECP {
	//store the import on the class to make testing easier
	private utils = utils;

	private device: RokuDevice;
	private config?: ConfigOptions;

	public static readonly Key = ECPKeys;
	public readonly Key = ECP.Key;

	constructor(device: RokuDevice, config?: ConfigOptions) {
		this.device = device;
		this.config = config;
	}

	public async sendText(text: string, wait = 0) {
		for (const char of text) {
			const value: any = `LIT_${char}`;
			await this.sendKeyPress(value, wait);
		}
	}

	public async sendKeyPress(key: ECPKeys, wait = 0) {
		await this.device.sendECP(`keypress/${encodeURIComponent(key)}`, {}, '');
		if (!wait) {
			wait = this.config?.defaults?.ecp.keyPressDelay ?? wait;
		}

		if (wait) await this.utils.sleep(wait);
	}

	public async sendKeyPressSequence(keys: ECPKeys[], wait = 0) {
		for (const key of keys) {
			await this.sendKeyPress(key, wait);
		}
	}

	public async sendLaunchChannel({
		channelId = '',
		launchParameters = {},
		verifyLaunch = true,
		skipIfAlreadyRunning = false
	} = {}) {
		if (!channelId) {
			const configChannelId = this.config?.channel?.id;
			if (!configChannelId) {
				throw utils.makeError('sendLaunchChannelChannelIdMissing', 'Channel id required and not supplied');
			}
			channelId = configChannelId;
		}
		if (skipIfAlreadyRunning) {
			const result = await this.getActiveApp();
			if (result.app?.id === channelId) return;
		}
		await this.device.sendECP(`launch/${channelId}`, launchParameters, '');
		if (verifyLaunch) {
			let success = true;
			try {
				const result = await this.getActiveApp();
				if (result.app?.id !== channelId) {
					success = false;
				}
			} catch (e) {
				success = false;
			}

			if (!success) throw utils.makeError('sendLaunchChannelVerifyLaunch', `Could not launch channel with id of '${channelId}`);
		}
	}

	public async getActiveApp() {
		let result = await this.device.sendECP(`query/active-app`);
		const children = result.body?.children;
		if (!children) throw utils.makeError('getActiveAppInvalidResponse', 'Received invalid active-app response from device');

		let response: ActiveAppResponse = {};
		for (let child of children) {
			response[child.name] = {
				...child.attributes,
				title: child.value
			};
		}
		return response;
	}
}
