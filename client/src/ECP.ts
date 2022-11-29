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
		if (config) {
			this.setConfig(config);
		}
		this.device = new RokuDevice(config);
	}

	public setConfig(config: ConfigOptions) {
		utils.validateRTAConfigSchema(config);
		this.config = config;
	}

	public getConfig() {
		if (!this.config) {
			this.config = utils.getConfigFromEnvironmentOrConfigFile();
		}
		return this.config?.ECP;
	}

	public async sendText(text: string, options?: SendKeyPressOptions & {raspTemplateVariable?: 'script-login' | 'script-password'}) {
		this.addRaspFileStep(`text: ${options?.raspTemplateVariable ?? text}`);
		for (const char of text) {
			const value: any = `LIT_${char}`;
			await this.sendKeyPress(value, options);
		}
	}



	public async sendKeyPress(key: ECPKeys, options?: SendKeyPressOptions) {
		if (typeof options === 'number') {
			options = {
				wait: options
			};
		}

		if (options?.count) {
			return this.sendKeyPressSequence([key], options);
		}

		const raspEquivalent = this.convertKeyToRaspEquivalent(key);
		if (raspEquivalent) {
			this.addRaspFileStep(`press: ${raspEquivalent}`);
		}
		await this.device.sendECP(`keypress/${encodeURIComponent(key)}`, {}, '');

		const keyPressDelay = this.getConfig()?.default?.keyPressDelay;
		let wait = options?.wait;
		if (!wait && keyPressDelay) {
			wait = keyPressDelay;
		}

		if (wait) await this.utils.sleep(wait);
	}

	// This method simply runs this.utils.sleep. Added here to allow adding a pause in rasp file commands
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

	public async sendKeyPressSequence(keys: ECPKeys[], options?: SendKeyPressOptions) {
		if (typeof options !== 'number') {
			const count = options?.count;
			if (count !== undefined) {
				// Needed to avoid infinite recursion
				delete options?.count;
				const passedInKeys = keys;
				keys = [];
				for (let i = 0; i < count; i++) {
					keys = keys.concat(passedInKeys);
				}
			}
		}

		for (const key of keys) {
			await this.sendKeyPress(key, options);
		}
	}

	public async sendLaunchChannel({
		channelId = '',
		launchParameters = {},
		skipIfAlreadyRunning = false,
		verifyLaunch = true,
		verifyLaunchTimeOut = 3000
	} = {}) {
		channelId = this.getChannelId(channelId);

		if (skipIfAlreadyRunning) {
			if (await this.isActiveApp(channelId)) {
				console.log('already running skipping launch');
				return;
			}
		}

		await this.device.sendECP(`launch/${channelId}`, launchParameters, '');
		if (verifyLaunch) {
			const startTime = new Date();
			while (new Date().valueOf() - startTime.valueOf() < verifyLaunchTimeOut) {
				try {
					if (await this.isActiveApp(channelId)) {
						return;
					}
				} catch (e) {}
				await this.utils.sleep(100);
			}
			throw this.utils.makeError('sendLaunchChannelVerifyLaunch', `Could not launch channel with id of '${channelId}`);
		}
	}

	public async getActiveApp() {
		const result = await this.device.sendECP(`query/active-app`);
		const children = result.body?.children;
		if (!children) throw this.utils.makeError('getActiveAppInvalidResponse', 'Received invalid active-app response from device');

		const response: ActiveAppResponse = {};
		for (const child of children) {
			response[child.name] = {
				...child.attributes,
				title: child.value
			};
		}
		return response;
	}

	public getChannelId(channelId?: string) {
		if (!channelId) {
			const configChannelId = this.getConfig()?.default?.launchChannelId;
			if (!configChannelId) {
				throw this.utils.makeError('LaunchChannelIdMissing', 'launchChannelId required and not supplied');
			}
			channelId = configChannelId;
		}
		return channelId;
	}

	public async isActiveApp(channelId?: string) {
		const result = await this.getActiveApp();
		return result.app?.id === this.getChannelId(channelId);
	}

	public async getMediaPlayer() {
		const result = await this.device.sendECP(`query/media-player`);
		const player = result.body;
		if (!player) throw this.utils.makeError('getMediaPlayerInvalidResponse', 'Received invalid media-player response from device');

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

		for (const key of ['position', 'duration', 'runtime']) {
			const value = response[key]?.value.replace(' ms', '');
			if (value) {
				response[key].number = utils.convertValueToNumber(value);
			}
		}

		return response;
	}

	public async getChanperf() {
		const {body} = await this.device.sendECP(`query/chanperf`);

		const response = this.simplifyEcpResponse(body);
		const plugin = response.plugin;

		if (plugin) {
			// Convert dashes to camelCase
			plugin.cpuPercent = plugin['cpu-percent'];
			delete plugin['cpu-percent'];

			plugin.cpuPercent.durationSeconds = plugin.cpuPercent['duration-seconds'];
			delete plugin.cpuPercent['duration-seconds'];

			// Convert values to numbers
			response.timestamp = +response.timestamp;

			for (const field of ['cpuPercent', 'memory']) {
				for (const key in plugin[field]) {
					plugin[field][key] = +plugin[field][key];
				}
			}
		}

		return response as {
			timestamp?: number;
			status: 'OK' | 'FAILED'
			error?: string;
			plugin?: {
				id: string;
				cpuPercent: {
					durationSeconds: number;
					user: number;
					sys: number;
				}
				memory: {
					used: number;
					res: number;
					anon: number;
					swap: number;
					file: number;
					shared: number;
				}
			};
		};
	}

	private simplifyEcpResponse(body) {
		const response: any = {};
		for (const child of body.children) {
			if (child.children.length > 0) {
				response[child.name] = this.simplifyEcpResponse(child);
			} else if (child.attributes.length > 0) {
				response[child.name] = {
					...child.attributes,
					value: child.value
				};
			} else {
				response[child.name] = child.value;
			}
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

/** If value is a number then we convert it to an object with the number used for wait  */
type SendKeyPressOptions = number | {
	wait?: number;
	count?: number;
}
