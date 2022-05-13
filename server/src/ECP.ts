import { RokuDevice } from './RokuDevice';
import { ActiveAppResponse } from './types/ActiveAppResponse';
import { ConfigOptions } from './types/ConfigOptions';
import { ECPKeys } from './types/ECPKeys';
import { utils } from './utils';
import { MediaPlayerResponse } from './types/MediaPlayerResponse';
import * as fsExtra from 'fs-extra';

export class ECP {
	//store the import on the class to make testing easier
	private utils = utils;

	private device: RokuDevice;
	private config?: ConfigOptions;

	private raspFileSteps?: string[];

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

	public async sendText(text: string, wait?: number, raspTemplateVariable?: 'script-login' | 'script-password') {
		this.addRaspFileStep(`text: ${raspTemplateVariable ?? text}`);
		for (const char of text) {
			const value: any = `LIT_${char}`;
			await this.sendKeyPress(value, wait);
		}
	}

	public async sendKeyPress(key: ECPKeys, wait = 0) {
		const raspEquivalent = this.convertKeyToRaspEquivalent(key);
		if (raspEquivalent) {
			this.addRaspFileStep(`press: ${raspEquivalent}`);
		}
		await this.device.sendECP(`keypress/${encodeURIComponent(key)}`, {}, '');

		const keyPressDelay = this.getConfig()?.default?.keyPressDelay;
		if (!wait && keyPressDelay) {
			wait = keyPressDelay;
		}

		if (wait) await this.utils.sleep(wait);
	}

	// This method simply runs utils.sleep. Added here to allow adding a pause in rasp file commands
	public sleep(milliseconds: number) {
		this.addRaspFileStep(`pause: ${milliseconds / 1000}`);
		return this.utils.sleep(milliseconds);
	}

	private convertKeyToRaspEquivalent(key: ECPKeys) {
		switch (key) {
			case ECPKeys.BACK:
				return 'back';
			case ECPKeys.BACKSPACE:
				return console.log('Roku Remote Tool does not handle Backspace ECP request. Skipping');
			case ECPKeys.DOWN:
				return 'down';
			case ECPKeys.ENTER:
				return console.log('Roku Remote Tool does not handle Enter ECP request. Skipping');
			case ECPKeys.FORWARD:
				return 'forward';
			case ECPKeys.HOME:
				return 'home';
			case ECPKeys.LEFT:
				return 'left';
			case ECPKeys.OK:
				return 'ok';
			case ECPKeys.OPTIONS:
				return 'info';
			case ECPKeys.PLAY:
				return 'play';
			case ECPKeys.REPLAY:
				return 'repeat';
			case ECPKeys.REWIND:
				return 'reverse';
			case ECPKeys.RIGHT:
				return 'right';
			case ECPKeys.SEARCH:
				return console.log('Roku Remote Tool does not handle Search ECP request. Skipping');
			case ECPKeys.UP:
				return 'up';
		}
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

		const response: ActiveAppResponse = {};
		for (const child of children) {
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

		for (const child of player.children) {
			response[child.name] = {
				...child.attributes,
				value: child.value
			};
		}

		return response;
	}

	private addRaspFileStep(step: string) {
		if (this.raspFileSteps) {
			this.raspFileSteps.push(`    - ${step}`);
		}
	}

	public startRaspFileCreation() {
		this.raspFileSteps = [];
	}

	public finishRaspFileCreation(outputPath: string, defaultKeypressWait?: number) {
		if (!this.raspFileSteps) {
			throw new Error('startRaspFileCreation was not called before finishRaspFileCreation');
		}

		if (defaultKeypressWait === undefined) {
			defaultKeypressWait = this.getConfig()?.default?.keyPressDelay;
			if (defaultKeypressWait === undefined) {
				// Default that Roku uses in Remote Tool
				defaultKeypressWait = 2;
			}
		}

		let raspFileLines = [] as string[];
		raspFileLines.push('params:');
		raspFileLines.push('    rasp_version: 1');
		raspFileLines.push(`    default_keypress_wait: ${defaultKeypressWait / 1000}`);
		raspFileLines.push(`steps:`);
		raspFileLines = raspFileLines.concat(this.raspFileSteps);
		this.raspFileSteps = undefined;
		fsExtra.writeFileSync(outputPath, raspFileLines.join('\n'));
	}
}
