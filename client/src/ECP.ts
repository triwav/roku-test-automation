import { RokuDevice } from './RokuDevice';
import type { ActiveAppResponse } from './types/ActiveAppResponse';
import type { ConfigOptions } from './types/ConfigOptions';
import { utils } from './utils';
import * as fsExtra from 'fs-extra';
import type { MediaPlayerResponse } from './types/MediaPlayerResponse';

export enum Key {
	Back = 'Back',
	Backspace = 'Backspace',
	Down = 'Down',
	Enter = 'Enter',
	Forward = 'Fwd',
	Home = 'Home',
	Left = 'Left',
	Ok = 'Select',
	Option = 'Info',
	Play = 'Play',
	Replay = 'InstantReplay',
	Rewind = 'Rev',
	Right = 'Right',
	Search = 'Search',
	Up = 'Up',
	PowerOff = 'PowerOff',
	PowerOn = 'PowerOn'
}

export class ECP {
	//store the import on the class to make testing easier
	private utils = utils;

	private device: RokuDevice;
	private config?: ConfigOptions;

	private raspFileSteps?: string[];

	public static readonly Key = Key;
	public readonly Key = Key;

	constructor(config?: ConfigOptions) {
		if (config) {
			this.setConfig(config);
		}
		this.device = new RokuDevice(config);
	}

	public setConfig(config: ConfigOptions) {
		utils.validateRTAConfigSchema(config);
		this.config = config;
		this.device.setConfig(config);
	}

	public getConfig() {
		if (!this.config) {
			this.config = utils.getConfigFromEnvironmentOrConfigFile();
		}
		return this.config?.ECP;
	}

	public async sendText(text: string, options?: SendKeypressOptions & {raspTemplateVariable?: 'script-login' | 'script-password'}) {
		this.addRaspFileStep(`text: ${options?.raspTemplateVariable ?? text}`);
		for (const char of text) {
			const value: any = `LIT_${char}`;
			await this.sendKeypress(value, options);
		}
	}

	public async sendKeypress(key: Key, options?: SendKeypressOptions) {
		if (typeof options === 'number') {
			options = {
				wait: options
			};
		}

		if (options?.count) {
			return this.sendKeypressSequence([key], options);
		}

		const raspEquivalent = this.convertKeyToRaspEquivalent(key);
		if (raspEquivalent) {
			this.addRaspFileStep(`press: ${raspEquivalent}`);
		}
		await this.device.sendEcpPost(`keypress/${encodeURIComponent(key)}`);

		const keypressDelay = this.getConfig()?.default?.keypressDelay;
		let wait = options?.wait;
		if (!wait && keypressDelay) {
			wait = keypressDelay;
		}

		if (wait) await this.utils.sleep(wait);
	}

	// This method simply runs this.utils.sleep. Added here to allow adding a pause in rasp file commands
	public sleep(milliseconds: number) {
		this.addRaspFileStep(`pause: ${milliseconds / 1000}`);
		return this.utils.sleep(milliseconds);
	}

	private convertKeyToRaspEquivalent(key: Key) {
		switch (key) {
			case Key.Back:
				return 'back';
			case Key.Backspace:
				return console.log('Roku Remote Tool does not handle Backspace ECP request. Skipping');
			case Key.Down:
				return 'down';
			case Key.Enter:
				return console.log('Roku Remote Tool does not handle Enter ECP request. Skipping');
			case Key.Forward:
				return 'forward';
			case Key.Home:
				return 'home';
			case Key.Left:
				return 'left';
			case Key.Ok:
				return 'ok';
			case Key.Option:
				return 'info';
			case Key.Play:
				return 'play';
			case Key.Replay:
				return 'repeat';
			case Key.Rewind:
				return 'reverse';
			case Key.Right:
				return 'right';
			case Key.Up:
				return 'up';
			case Key.Search:
			case Key.PowerOff:
			case Key.PowerOn:
				return console.log(`Roku Remote Tool does not handle ${key} ECP request. Skipping`);
		}
	}

	public async sendKeypressSequence(keys: Key[], options?: SendKeypressOptions) {
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
			await this.sendKeypress(key, options);
		}
	}

	public async sendLaunchChannel({
		channelId = '',
		params = {},
		verifyLaunch = true,
		verifyLaunchTimeOut = 3000
	} = {}) {
		channelId = this.getChannelId(channelId);

		// We always append a param as if none is passed and the application is already running it will not restart the application
		params['RTA_LAUNCH'] = 1;

		await this.device.sendEcpPost(`launch/${channelId}`, params);
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

	// Helper for sending a /input request to the device that can be handled via roInput
	public async sendInput({
		params = {}
	} = {}) {
		await this.device.sendEcpPost(`input`, params);
	}

	public async getActiveApp() {
		const result = await this.device.sendEcpGet(`query/active-app`);
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
		const result = await this.device.sendEcpGet(`query/media-player`);
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
		const {body} = await this.device.sendEcpGet(`query/chanperf`);

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
			defaultKeypressWait = this.getConfig()?.default?.keypressDelay;
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
type SendKeypressOptions = number | {
	wait?: number;
	count?: number;
}
