import type { HttpRequestOptions } from './RokuDevice';
import type { RokuDevice } from './RokuDevice';
import type { ActiveAppResponse } from './types/ActiveAppResponse';
import type { ConfigOptions } from './types/ConfigOptions';
import { utils } from './utils';
import type { MediaPlayerResponse } from './types/MediaPlayerResponse';
import type { AppUIResponse, AppUIResponseChild } from './types/AppUIResponse';

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

	constructor(device: RokuDevice, config?: ConfigOptions) {
		this.device = device;
		if (config) {
			this.setConfig(config);
		}
	}

	public setConfig(config: ConfigOptions) {
		utils.validateRTAConfigSchema(config);
		this.config = config;
		this.device.setConfig(config);
	}

	/**
	 * Get the full RTA config
	 */
	public getRtaConfig() {
		if (!this.config) {
			this.config = utils.getConfigFromEnvironmentOrConfigFile();
		}
		return this.config;
	}

	/**
	 * Get the ECP config from the full RTA config.
	 */
	public getConfig() {
		return this.getRtaConfig()?.ECP;
	}

	public async sendText(text: string, options?: SendKeypressOptions & { raspTemplateVariable?: 'script-login' | 'script-password' }) {
		this.addRaspFileStep(`text: ${options?.raspTemplateVariable ?? text}`);
		for (const char of text) {
			const value: any = `LIT_${char}`;
			await this.sendKeypress(value, options);
		}
	}

	public async sendKeyDown(key: Key, keyEventOptions: SendKeyEventOptions = 0, keypressOptions?: SendKeypressOptions) {
		const { eventOptions, pressOptions } = this.normalizeOptions(keyEventOptions, keypressOptions);
		eventOptions.keydown = true;
		eventOptions.keyup = false;
		await this.sendKeyEvent(key, eventOptions, pressOptions);
	}

	public async sendKeyUp(key: Key, keyEventOptions: SendKeyEventOptions = 0, keypressOptions?: SendKeypressOptions) {
		const { eventOptions, pressOptions } = this.normalizeOptions(keyEventOptions, keypressOptions);
		eventOptions.keyup = true;
		eventOptions.keydown = false;
		await this.sendKeyEvent(key, eventOptions, pressOptions);
	}

	public async sendKeyPressAndHold(key: Key, keyEventOptions: SendKeyEventOptions, keypressOptions?: SendKeypressOptions) {
		const { eventOptions, pressOptions } = this.normalizeOptions(keyEventOptions, keypressOptions);
		eventOptions.keydown = true;
		eventOptions.keyup = true;
		await this.sendKeyEvent(key, eventOptions, pressOptions);
	}

	public async sendKeyEvent(key: Key, keyEventOptions: SendKeyEventOptions, keypressOptions?: SendKeypressOptions) {
		const { eventOptions, pressOptions } = this.normalizeOptions(keyEventOptions, keypressOptions);
		const keydown = eventOptions?.keydown;
		const keyup = eventOptions?.keyup;
		const duration = eventOptions.duration;

		if (keydown != keyup || duration) {
			const keypressDelay = this.getConfig()?.default?.keypressDelay;
			let wait = pressOptions?.wait;
			if (!wait && keypressDelay) {
				wait = keypressDelay;
			}

			const encodedKey = encodeURIComponent(key);

			for (let i = 0; i < (pressOptions?.count ?? 1); i++) {
				if (keydown) {
					await this.device.sendEcpPost(`keydown/${encodedKey}`);
				}

				if (duration) {
					await this.utils.sleep(duration);
				}

				if (keyup) {
					await this.device.sendEcpPost(`keyup/${encodedKey}`);
				}

				if (wait) await this.utils.sleep(wait);
			}
		} else {
			await this.sendKeypress(key, pressOptions);
		}
	}

	private normalizeOptions(eventOptions: SendKeyEventOptions, pressOptions: SendKeypressOptions = {}): { eventOptions, pressOptions } {
		if (typeof eventOptions === 'number') {
			eventOptions = {
				duration: eventOptions,
				keydown: true,
				keyup: true
			};
		}

		if (typeof pressOptions === 'number') {
			pressOptions = {
				wait: pressOptions
			};
		}

		return { eventOptions: eventOptions, pressOptions: pressOptions };
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
		verifyLaunchTimeOut = 3000,
		options = {} as HttpRequestOptions
	} = {}) {
		channelId = this.getChannelId(channelId);

		// We always append a param as if none is passed and the application is already running it will not restart the application
		params['RTA_LAUNCH'] = 1;

		await this.device.sendEcpPost(`launch/${channelId}`, params, undefined, options);
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
		params = {},
		options = {} as HttpRequestOptions
	} = {}) {
		await this.device.sendEcpPost(`input`, params, undefined, options);
	}

	public async getActiveApp(options: HttpRequestOptions = {}) {
		const result = await this.device.sendEcpGet(`query/active-app`, undefined, options);
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

	public async getAppUI() {
		const result = await this.device.sendEcpGet(`query/app-ui`);

		const children = result.body?.children;
		if (!children || children[0].name != 'status' || children[0].value != 'OK' || children[1].name != 'topscreen' || children[1].children[0].name != 'plugin' || children[1].children[1].name != 'screen') {
			throw this.utils.makeError('getAppUIInvalidResponse', 'Received invalid app-ui response from device');
		}

		const screen = children[1].children[1];

		const response: AppUIResponse = {
			plugin: children[1].children[0].attributes,
			screen: {
				focused: screen.attributes.focused == 'true',
				type: screen.attributes.type,
				children: this.convertChildrenForGetAppUI(screen.children)
			}
		};

		const sceneNode = response.screen.children[0];
		sceneNode.base = 'scene';
		sceneNode.keyPath = '';

		if (sceneNode.children) {
			for (const [position, child] of sceneNode.children.entries()) {
				this.generateKeyPathsFromAppUIResponse(child, { position: position });
			}
		}

		this.calculateSceneBoundingRects(sceneNode);
		return response;
	}


	private convertChildrenForGetAppUI(children: any[], parentIsRowListItem = false) {
		const response: AppUIResponseChild[] = [];

		// If we are a RowListItem then we are removing the duplicate Group returned in addition to the MarkupGrid to avoid confusion
		if (parentIsRowListItem) {
			children.pop(); // Remove the last child which is the Group
		}

		for (const [index, child] of children.entries()) {
			// Do some conversions
			if (child.attributes.name) {
				child.attributes.id = child.attributes.name;
			}

			child.attributes.focusable = (child.attributes.focusable == 'true');
			child.attributes.focused = (child.attributes.focused == 'true');
			child.attributes.visible = (child.attributes.visible !== 'false');
			child.attributes.inheritParentOpacity = (child.attributes.inheritParentOpacity !== 'false');
			child.attributes.inheritParentTransform = (child.attributes.inheritParentTransform !== 'false');

			const opacity = child.attributes.opacity ?? '100';
			child.attributes.opacity = +opacity / 100;

			if (child.attributes.translation) {
				child.attributes.translation = this.convertAppUiArray(child.attributes.translation);
			}

			if (child.attributes.bounds) {
				// If we have bounds then we need to ensure translation is set or else we won't be able to move in the SceneGraph Inspector
				if (!child.attributes.translation) {
					child.attributes.translation = [0, 0];
				}
				child.attributes.bounds = this.convertAppUiArray(child.attributes.bounds);
			}

			const childResponse: AppUIResponseChild = {
				...child.attributes,
				subtype: child.name == 'RenderableNode' ? 'Group' : child.name,
			};

			if (Array.isArray(child.children) && child.children.length > 0) {
				childResponse.children = this.convertChildrenForGetAppUI(child.children ?? [], child.name == 'RowListItem');
			} else {
				// The response contains a property named children with the number of children but we are using the same name for the array so want to remove if no children
				delete childResponse.children;
			}

			response.push(childResponse);
		}

		return response;
	}

	private calculateSceneBoundingRects(node: AppUIResponseChild, offset: number[] = [0, 0], useBounds = false) {
		if (useBounds && node.bounds) {
			offset = [
				node.bounds[0] + offset[0],
				node.bounds[1] + offset[1]
			];
		} else if (node.translation) {
			offset = [
				node.translation[0] + offset[0],
				node.translation[1] + offset[1]
			];
		}

		if (node.bounds && node.subtype != 'RowListItem') {
			// Not doing RowListItem calculation since it isn't needed and everything is finally working
			node.sceneRect = {
				x: offset[0],
				y: offset[1],
				width: node.bounds[2],
				height: node.bounds[3]
			};
		}

		if (node.subtype == 'RowListItem') {
			// We have to subtract the row offset from the bounds for correct positioning
			if (node.children && node.children[node.children.length - 1]) {
				const lastChild = node.children[node.children.length - 1];
				if (lastChild.translation) {
					offset = [
						offset[0] - lastChild.translation[0],
						offset[1] - lastChild.translation[1]
					];
				}
			}

			if (node.bounds) {
				offset[0] += node.bounds[0];
				offset[1] += node.bounds[1];
			}
		} else if (node.subtype == 'MarkupGrid') {
			useBounds = true;
		}

		node['offset'] = offset;

		for (const child of node.children ?? []) {
			this.calculateSceneBoundingRects(child, offset, useBounds);
		}
	}

	private generateKeyPathsFromAppUIResponse(node: AppUIResponseChild, keyPathContext: {
		position: number;
		duplicateIdsFound?: boolean;
		parent?: AppUIResponseChild;
	}, keyPathParts: string[] = []) {
		const currentNodeKeyPathParts = [...keyPathParts];

		// Only add key path if it doesn't already exist
		let addKeyPath = !node.keyPath;

		if (node.subtype == 'RowListItem') {
			// Don't want to add key paths for RowListItem but want to add onto key path parts
			addKeyPath = false;

			currentNodeKeyPathParts.push(keyPathContext.position.toString());
		} else if (keyPathContext.parent?.subtype == 'RowListItem') { // We have to make our magic key paths for RowList
			// don't add key paths by default for RowListItem
			addKeyPath = false;

			// Title is always the first child of the RowListItem
			if (keyPathContext.position == 0) {
				currentNodeKeyPathParts.push('title');

				if (node.subtype == 'Label') {
					addKeyPath = true;
				} else {
					// We need to add it to the child instead so it is tied to the actual custom component
					const child = node.children?.[0];
					if (child) {
						node.base = 'appUI';
						child.keyPath = currentNodeKeyPathParts.join('.');
					}
				}
			} else if (node.subtype === 'MarkupGrid') {
				currentNodeKeyPathParts.push('items');
			}
		} else if (node.id && !keyPathContext.duplicateIdsFound) {
			currentNodeKeyPathParts.push(`#${node.id}`);
		} else {
			currentNodeKeyPathParts.push(keyPathContext.position.toString());
		}

		if (addKeyPath) {
			// We always need to use appUI as the base for the key path. Originally we would try to use scene for non ArrayGrid items but nodes that don't extend Group are excluded in the app-ui response so we can't use scene as the base because index based key path parts will then get off.
			node.base = 'appUI';
			node.keyPath = currentNodeKeyPathParts.join('.');
		}

		const children = node.children ?? [];
		for (const [childPosition, childNode] of children.entries()) {
			const duplicateIds = children.filter((child, index) => {
				if (child.id) {
					if (child.id == childNode.id && index != childPosition) {
						return true;
					}
				}
				return false;
			});

			keyPathContext = {
				position: childPosition,
				parent: node,
				duplicateIdsFound: duplicateIds.length > 0,
			};

			this.generateKeyPathsFromAppUIResponse(childNode, keyPathContext, currentNodeKeyPathParts);
		}
	}

	private convertAppUiArray(input?: string, fallback?: number[]) {
		if (!input) {
			return fallback;
		}

		// the app-ui api returns arrays with curly braces that we need to convert to square braces and then run JSON.parse on
		return JSON.parse(input.replace(/[{}]/g, match => match === '{' ? '[' : ']'));
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

	public async isActiveApp(channelId?: string, options: HttpRequestOptions = {}) {
		const result = await this.getActiveApp(options);
		return result.app?.id === this.getChannelId(channelId);
	}

	public async getMediaPlayer(options: HttpRequestOptions = {}) {
		const result = await this.device.sendEcpGet(`query/media-player`, undefined, options);
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

	public async getChanperf(options: HttpRequestOptions = {}) {
		const { body } = await this.device.sendEcpGet(`query/chanperf`, undefined, options);

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
		utils.getFsExtra().writeFileSync(outputPath, raspFileLines.join('\n'));
	}
}

/** If value is a number then we convert it to an object with the number used for wait  */
type SendKeypressOptions = number | {
	wait?: number;
	count?: number;
}

/** If value is a number then we convert it to an object with number used for duration and keydown and keyup set */
type SendKeyEventOptions = number | {
	keydown?: boolean;
	keyup?: boolean;
	duration: number;
}
