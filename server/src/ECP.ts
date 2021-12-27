import { RokuDevice } from './RokuDevice';
import { ActiveAppResponse } from './types/ActiveAppResponse';
import { ConfigOptions } from './types/ConfigOptions';
import { ECPKeys } from './types/ECPKeys';
import { utils } from './utils';
import { MediaPlayerResponse } from './types/MediaPlayerResponse';

export class ECP {
	//store the import on the class to make testing easier
	private utils = utils;

	private device: RokuDevice;
	private config?: ConfigOptions;

	public static readonly Key = ECPKeys;
	public readonly Key = ECP.Key;

	constructor(config?: ConfigOptions) {
		this.config = config;
		this.device = new RokuDevice(config);
	}

	public getConfig() {
		if (!this.config) {
			const config = utils.getOptionalConfigFromEnvironment();
			utils.validateRTAConfigSchema(config);
			this.config = config;
		}
		return this.config?.ECP;
	}

	public async sendText(text: string, wait?: number) {
		for (const char of text) {
			const value: any = `LIT_${char}`;
			await this.sendKeyPress(value, wait);
		}
	}

	public async sendKeyPress(key: ECPKeys, wait = 0) {
		await this.device.sendECP(`keypress/${encodeURIComponent(key)}`, {}, '');

		const keyPressDelay = this.getConfig()?.default?.keyPressDelay;
		if (!wait && keyPressDelay) {
			wait = keyPressDelay;
		}

		if (wait) await this.utils.sleep(wait);
	}

	public async sendKeyPressSequence(keys: ECPKeys[], wait?: number) {
		for (const key of keys) {
			await this.sendKeyPress(key, wait);
		}
	}

	public async sendLaunchChannel({
		channelId = '',
		launchParameters = {},
		skipIfAlreadyRunning = false,
		verifyLaunch = true,
		verifyLaunchTimeOut = 3000
	} = {}) {
		if (!channelId) {
			const configChannelId = this.getConfig()?.default?.launchChannelId;
			if (!configChannelId) {
				throw utils.makeError('sendLaunchChannelChannelIdMissing', 'Channel id required and not supplied');
			}
			channelId = configChannelId;
		}
		if (skipIfAlreadyRunning) {
			const result = await this.getActiveApp();
			if (result.app?.id === channelId) {
				console.log('already running skipping launch');
				return;
			}
		}
		await this.device.sendECP(`launch/${channelId}`, launchParameters, '');
		if (verifyLaunch) {
			const startTime = new Date();
			while (new Date().valueOf() - startTime.valueOf() < verifyLaunchTimeOut) {
				try {
					const result = await this.getActiveApp();
					if (result.app?.id === channelId) {
						return;
					}
				} catch (e) {}
				await utils.sleep(100);
			}
			throw utils.makeError('sendLaunchChannelVerifyLaunch', `Could not launch channel with id of '${channelId}`);
		}
	}

	public async getActiveApp() {
		const result = await this.device.sendECP(`query/active-app`);
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

	public async getMediaPlayer() {
		const result = await this.device.sendECP(`query/media-player`);
		const player = result.body;
		if (!player) throw utils.makeError('getMediaPlayerInvalidResponse', 'Received invalid media-player response from device');

		const response: MediaPlayerResponse = {
			state: player.attributes.state,
			error: player.attributes.error === 'true',
		};

		for (let child of player.children) {
			response[child.name] = {
				...child.attributes,
				value: child.value
			};
		}

		return response;
	}
}
