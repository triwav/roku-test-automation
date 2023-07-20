/* eslint-disable no-debugger */
/* eslint-disable @typescript-eslint/quotes */
import * as needle from 'needle';
import * as querystring from 'needle/lib/querystring';
import * as fsExtra from 'fs-extra';
import type {TestLine, AssertTestLine, PressButtonTestLine, IdElementSubject, Condition, StringComparator, NumberComparator} from '@suitest/types';

import { ECP } from './ECP';
import * as ODC from './types/OnDeviceComponent';
import type { OnDeviceComponent } from './OnDeviceComponent';
import type { ConfigOptions } from './types/ConfigOptions';
import { utils } from './utils';

export class Suitest {
	public testsByTestId: {
		[key: string]: ApiTestItem
	} = {};

	public testIdsForTags: {
		[key: string]: string[]
	} = {};

	public allElements: {
		[key: string]: {
			platforms: {
				roku: {
					info: {
						[key: string]: any;
					},
					excludedProperties: string[];
					selectors: {
						xpath?: {
							val: string;
							active: boolean;
						}
						text?: {
							val: string;
							active: boolean;
						}
					}
				}
			}
		}
	} = {};

	public preOpenAppHook: (() => Promise<void>) | undefined;
	public postOpenAppHook: (() => Promise<void>) | undefined;

	//store the import on the class to make testing easier
	private utils = utils;
	private needle = needle;

	private ecp: ECP;

	private odc: OnDeviceComponent;

	private config?: ConfigOptions;

	private baseSuitestApiUrl = 'https://the.suite.st/api/public/v4/';

	/** Maps between ST button id and our own ECP key value */
	private buttonIdToKeyMap = {
		LEFT: ECP.Key.Left,
		RIGHT: ECP.Key.Right,
		UP: ECP.Key.Up,
		DOWN: ECP.Key.Down,
		ENTER: ECP.Key.Ok,
		BACK: ECP.Key.Back,
		FAST_FWD: ECP.Key.Forward,
		REWIND: ECP.Key.Rewind,
		PLAY_PAUSE: ECP.Key.Play,
		EXIT: ECP.Key.Home
	};

	private logIndentLevel = 0;

	constructor(ecp: ECP, odc: OnDeviceComponent, config?: ConfigOptions) {
		if (config) {
			this.setConfig(config);
		}

		this.ecp = ecp;
		this.odc = odc;
	}

	public setConfig(config: ConfigOptions) {
		this.utils.validateRTAConfigSchema(config);
		this.config = config;
	}

	public getConfig() {
		if (!this.config) {
			this.config = utils.getConfigFromEnvironmentOrConfigFile();
		}
		return this.config?.Suitest;
	}

	public getNonOptionalConfig() {
		const config = this.getConfig();
		if (!config) {
			throw new Error('Suitest Config was required and was not supplied');
		}
		return config;
	}

	private async sendSuitestApiRequest(method: needle.NeedleHttpVerbs, path: string, params?: object, body?: needle.BodyData) {
		if (!params) {
			params = {};
		}

		const url = this.baseSuitestApiUrl + path + '?' + querystring.build(params);
		return this.sendSuitestApiRequestCore(method, url, body);
	}

	private async sendSuitestApiRequestCore(method: needle.NeedleHttpVerbs, url: string, body?: needle.BodyData) {
		const {tokenId, tokenPassword} = this.getNonOptionalConfig();
		if (!tokenId || !tokenPassword) {
			throw new Error(`tokenId or tokenPassword was not provided and required for API access`);
		}

		const requestOptions: needle.NeedleOptions = {
			username: tokenId,
			password: tokenPassword,
			accept: 'application/json',
			// proxy: '127.0.0.1:8888'
		};

		if (body) {
			const response = await this.needle(method, url, body, requestOptions);
			return response.body;
		}

		const response = await this.needle(method, url, requestOptions);
		return response.body;
	}


	public sendSuitestApiPostRequest(path: string, body: needle.BodyData, params?: object) {
		return this.sendSuitestApiRequest('post', path, params, body);
	}

	public sendSuitestApiGetRequest(path: string, params?: object) {
		return this.sendSuitestApiRequest('get', path, params);
	}

	public async retrieveAllTestsForAppVersion(concurrencyLimit = 50) {
		const {appId, version} = this.getNonOptionalConfig();
		if (!appId || !version) {
			throw new Error(`appId or version was not provided and required for API access`);
		}

		let result;
		do {
			if (result?.next) {
				// Subsequent request
				result = await this.sendSuitestApiRequestCore('get', result.next);
			} else {
				// First request
				result = await this.sendSuitestApiGetRequest(`apps/${appId}/versions/${version}/tests`, {
					limit: concurrencyLimit
				});
			}

			const promises = [] as Promise<ApiTestItem>[];
			const tagsForTestIds = {};
			for (const test of result.values as ApiTestItem[]) {
				const testId = test.testId;
				const tags = test.tags;
				// Have to store the tags to apply when we get our individual test response
				tagsForTestIds[testId] = tags;
				for (const tag of test.tags) {
					if (!this.testIdsForTags[tag]) {
						this.testIdsForTags[tag] = [];
					}
					this.testIdsForTags[tag].push(testId);
				}
				promises.push(this.getTestDefinitionForAppVersion(testId, appId, version));
			}
			for (const test of await Promise.all(promises)) {
				// Assign tags from tests call
				const testId = test.testId;
				test.tags = tagsForTestIds[testId];
				this.testsByTestId[testId] = test;

			}
		} while (result.next);
		return this.testIdsForTags;
	}

	// Have to make an individual call to get each test definition
	public async getTestDefinitionForAppVersion(testId: string, appId?: string, version?: string) {
		return this.sendSuitestApiGetRequest(`apps/${appId}/versions/${version}/tests/${testId}`);
	}

	public writeOutTestsToFile(file: string) {
		return fsExtra.writeFile(file, JSON.stringify(this.testsByTestId, null, 4));
	}

	public async readInTestsFromFile(file: string) {
		const result = JSON.parse(await fsExtra.readFile(file, 'utf8'));
		if (result) {
			this.testsByTestId = result;
			for (const testId in this.testsByTestId) {
				const test = this.testsByTestId[testId];
				for (const tag of test.tags) {
					if (!this.testIdsForTags[tag]) {
						this.testIdsForTags[tag] = [];
					}
					this.testIdsForTags[tag].push(testId);
				}
			}
		}
	}

	public async runTest(testId: string, isSnippet = false) {
		const test = this.testsByTestId[testId];
		if (!test) {
			throw new Error(`Could not find testId: ${testId}`);
		}
		this.debugLog(`Starting ${test.title} testId: ${testId}`);
		this.logIndentLevel++;
		for (const testLine of test.definition) {
			if (testLine.excluded) {
				this.debugLog(`Skipping ${testLine.type} lineId: ${testLine.lineId} as it is excluded`);
				continue;
			}

			if (testLine.screenshot) {
				this.debugLog(`testId: ${testId} lineId: ${testLine.lineId} requested screenshot but not currently implemented`);
			}

			switch (testLine.type) {
				case 'openApp': {
					const applicationPath = this.getConfig()?.applicationPath;
					if (!applicationPath) {
						throw new Error(`openApp was called and config did not have an applicationPath specified`);
					}

					this.debugLog(`Running ${testLine.type} lineId: ${testLine.lineId}`);

					if (!isSnippet) {
						await this.preOpenAppHook?.();
						const device = this.odc.device;
						await device.deploy({
							rootDir: applicationPath,
							files: [`**/*`],
							deleteBeforeInstall: true
						});
						await this.postOpenAppHook?.();
					}
					break;
				}
				case "assert":
					this.debugLog(`Running ${testLine.type} (${testLine.condition.subject.type}) lineId: ${testLine.lineId}`);
					await this.handleAssertLine(testLine);
					break;
				case "sleep":
					if (typeof testLine.timeout === 'number') {
						this.debugLog(`Running sleep (${testLine.timeout}ms) lineId: ${testLine.lineId}`);
						await this.utils.sleep(testLine.timeout);
					} else {
						debugger;
					}
					break;
				case "button":
					if ((testLine.count ?? 1) > 1) {
						this.debugLog(`Running button (${testLine.ids} max ${testLine.count} times) lineId: ${testLine.lineId}`);
					} else {
						this.debugLog(`Running button (${testLine.ids}) lineId: ${testLine.lineId}`);
					}

					await this.handlePressButtonLine(testLine);
					break;
				case "runSnippet":
					// Give some spacing between tests
					console.log('');
					await this.runTest(testLine.val, true);
					break;
				case "sendText":
					this.debugLog(`Running sendText (${testLine.val}) lineId: ${testLine.lineId}`);
					await this.ecp.sendText(testLine.val);
					break;
				case "comment":
					this.debugLog(`Comment: ${testLine.val}`);
					break;
				case "setText":
				case "takeScreenshot":
				case "closeApp":
				case "suspendApp":
				case "openDeepLink":
					debugger;
					break;
				case "deviceSettings":
				case "tap":
				case "scroll":
				case "openUrl":
				case "pollUrl":
				case "swipe":
				case "browserCommand":
				case "click":
				case "moveTo":
				case "wait":
				case "clearAppData":
				case "execCmd":
					debugger;
			}
		}
		this.logIndentLevel--;
		this.debugLog(`Finished ${test.title} testId: ${testId}`);
	}

	public async runTests(tags: string[], options: {excludedTestIds?: string[], startOffsetTestId?: string} = {}) {
		let startingTestIdFound = false;
		for (const tag of tags) {
			if (this.testIdsForTags[tag]) {
				this.debugLog(`Starting tests with tag: ${tag}`);
				for (const testId of this.testIdsForTags[tag]) {
					if (options.startOffsetTestId && !startingTestIdFound) {
						if (options.startOffsetTestId === testId) {
							startingTestIdFound = true;
						} else {
							this.debugLog(`Skipping testId: ${testId} due to start offset\n\n`);
							continue;
						}
					}

					if (options.excludedTestIds?.includes(testId)) {
						this.debugLog(`Skipping excluded testId: ${testId}\n\n`);
						continue;
					}

					await this.runTest(testId);
					console.log('\n\n');
				}
				this.debugLog(`Finished tests with tag: ${tag}`);
			} else {
				this.debugLog(`[WARN] Could not find tests with tag: ${tag}`);
			}
		}
	}

	private async handlePressButtonLine(testLine: PressButtonTestLine) {
		let error: Error | undefined;
		const buttonPressMaxCount = utils.convertValueToNumber(testLine.count, 1);
		for (let i = 0; i < buttonPressMaxCount; i++) {
			error = undefined;
			for (const id of testLine.ids) {
				const key = this.buttonIdToKeyMap[id];
				if (key) {
					await this.ecp.sendKeypress(key, { wait: utils.convertValueToNumber(testLine.delay) * 1.1 }) ; // Some tests seem to fail with the same delay likely due to Suitest's functions being quite a bit slower evaluating
				} else {
					debugger;
				}
			}

			const condition = testLine.condition;
			if (!condition) {
				continue;
			}
			const subject = condition.subject;

			switch(subject.type) {
				case 'element':
					try {
						await this.handleElementCondition(subject as IdElementSubject, condition);
						i = buttonPressMaxCount;
					} catch (e) {
						error = e;
					}
					break;
				case 'video':
					try {
						await this.handleVideoCondition(condition);
					} catch (e) {
						error = e;
						await utils.sleep(500);
					}
					break;
				default:
					throw new Error(`${subject.type} not handled`);
			}

			// If condition was met, break out of the loop
			if (error === undefined) {
				break;
			}
		}
	}

	private async handleAssertLine(testLine: AssertTestLine) {
		const condition = testLine.condition;
		const subject = condition.subject;

		let error: Error | undefined;
		let shouldContinue = true;
		const startTime = Date.now();
		while (shouldContinue && Date.now() - startTime < (testLine.timeout ?? 1)) {
			error = undefined;
			switch(subject.type) {
				case 'element':
					try {
						await this.handleElementCondition(subject as IdElementSubject, condition);
						shouldContinue = false;
					} catch (e) {
						error = e;
					}
					break;
				case 'video':
					try {
						await this.handleVideoCondition(condition);
						shouldContinue = false;
					} catch (e) {
						error = e;
					}
					break;
				default:
					throw new Error(`${subject.type} not handled`);
			}
		}
		if (error) {
			throw error;
		}
	}

	private async handleElementCondition(subject: IdElementSubject, condition: Condition) {
		const element = this.allElements[subject.elementId];
		if (!element) {
			throw new Error(`Could not find element ${subject.nameHint} with id: ${subject.elementId}`);
		}

		const {rootTree, flatTree} = await this.odc.storeNodeReferences({
			includeArrayGridChildren: true
		});
		const roku = element.platforms.roku;

		let matchingNodeTree: ODC.TreeNode | undefined;
		let matchingNodeError: Error | undefined;
		let matchingNode: ODC.NodeRepresentation | undefined;

		if (roku.selectors.xpath && roku.selectors.xpath.active) {
			const xpathParts = roku.selectors.xpath.val.split('/');
			try {
				matchingNodeTree = await this.findMatchingNode(rootTree, xpathParts, flatTree);
				const {value} = await this.odc.getValue({
					base: ODC.BaseType.nodeRef,
					keyPath: `${matchingNodeTree.ref}`
				});
				matchingNode = value;
			} catch (e) {
				matchingNodeError = e;
			}

		} else if (roku.selectors.text && roku.selectors.text.active) {
			const textToSearchFor = roku.selectors.text.val;
			const {nodes, nodeRefs} = await this.odc.getNodesWithProperties({
				properties: [{
					field: 'text',
					operator: 'in',
					value: textToSearchFor
				}]
			});

			if (nodeRefs.length > 0) {
				// We always just select the first match
				matchingNodeTree = flatTree[nodeRefs[0]];
				matchingNode = nodes[0];
			} else {
				matchingNodeError = new Error(`Could not find node with text '${textToSearchFor}'`);
			}
		} else {
			debugger;
		}

		if (matchingNode) {
			for (const key in roku.info) {
				if (roku.excludedProperties.includes(key) || key === 'isFocused') {
					continue;
				}

				let actualValue;
				if (key === 'visibility') {
					actualValue = matchingNode.visible ? 'visible' : 'invisible';
				} else if (matchingNode[key] !== undefined) {
					actualValue = matchingNode[key];
				} else {
					debugger;
				}

				if (actualValue !== roku.info[key]) {
					matchingNodeTree = undefined;
					matchingNodeError = new Error(`Element ${key} value of '${matchingNode[key]}' did not match expected value of '${roku.info[key]}'`);
					break;
				}
			}
		}

		switch (condition.type) {
			case '!exists':
				if (matchingNodeTree !== undefined) {
					throw new Error(`${subject.nameHint} was expected not to exist but was found`);
				}
				return;
			case 'has':
				if (matchingNodeError) {
					throw matchingNodeError;
				}
				for (const expression of condition.expression) {
					if (!expression.val) {
						continue;
					}

					let actualValue;
					if (matchingNode) {
						const property = expression.property;
						if (property === 'visibility') {
							actualValue = matchingNode.visible ? 'visible' : 'invisible';
						} else if (matchingNode[property] !== undefined) {
							actualValue = matchingNode[property];
						} else {
							debugger;
						}
					} else {
						debugger;
					}

					switch (expression.type) {
						case "=":
							if (actualValue !== expression.val) {
								throw new Error(`Actual value ${actualValue} did not match ${expression.val}`);
							}
							break;
						case "!=":
							if (actualValue === expression.val) {
								throw new Error(`Actual value ${actualValue} was not expected to match ${expression.val}`);
							}
							break;
						case ">":
							if (!(actualValue > expression.val)) {
								throw new Error(`Actual value ${actualValue} was expected to be greater than ${expression.val}`);
							}
							break;
						case ">=":
							if (!(actualValue >= expression.val)) {
								throw new Error(`Actual value ${actualValue} was expected to be greater than or equal to ${expression.val}`);
							}
							break;
						case "<":
							if (!(actualValue < expression.val)) {
								throw new Error(`Actual value ${actualValue} was expected to be greater than equal to ${expression.val}`);
							}
							break;
						case "<=":
							if (!(actualValue <= expression.val)) {
								throw new Error(`Actual value ${actualValue} was expected to be less than or equal to ${expression.val}`);
							}
							break;
						case "~":
							if (!actualValue) {
								debugger;
							}
							if (!actualValue.includes(expression.val)) {
								throw new Error(`Actual value ${actualValue} was expected to contain ${expression.val}`);
							}
							break;
						case "!~":
							if (actualValue.includes(expression.val)) {
								throw new Error(`Actual value ${actualValue} was expected not to contain ${expression.val}`);
							}
							break;
						case "^":
						case "!^":
						case "$":
						case "!$":
						case "matches":
						case "exists":
						case "!exists":
						case "+-":
							throw new Error(`Not implemented yet: "${expression.type}"`);
					}
				}
				break;
			case 'exists':
				if (matchingNodeError) {
					throw matchingNodeError;
				}
				break;
			default:
				debugger;
				break;
		}
	}

	private async handleVideoCondition(condition: Condition) {
		const response = await this.ecp.getMediaPlayer();
		switch (condition.type) {
			case 'has':
				for (const expression of condition.expression) {
					if (!expression.val) {
						continue;
					}

					if (expression.property === 'videoState') {
						if (expression.type === '=') {
							if (expression.val === 'playing') {
								if (response.state != 'play') {
									throw new Error(`Video state was expected to be 'play' but had state '${response.state}'`);
								}
							} else if (expression.val === 'paused') {
								if (response.state != 'pause') {
									throw new Error(`Video state was expected to be 'pause' but had state '${response.state}'`);
								}
							} else {
								debugger;
							}
						} else {
							debugger;
						}
					} else if (expression.property === 'videoLength') {
						console.log('response.duration', response.duration);

						if (!response.duration) {
							throw new Error(`No duration was returned from Roku device`);
						}
						if (!this.compareValues(expression.type as StringComparator | NumberComparator, response.duration.number, expression.val)) {
							throw new Error(`duration did not match: ${response.duration.number} ${expression.type} expression.val`);
						}
					} else if (expression.property === 'videoPos') {
						if (!response.position) {
							throw new Error(`No position was returned from Roku device`);
						}

						if (!this.compareValues(expression.type as StringComparator | NumberComparator, response.position.number, expression.val)) {
							throw new Error(`position did not match: ${response.position.number} ${expression.type} expression.val`);
						}
					} else {
						debugger;
					}
				}
				break;
			case 'exists':
				if (response.state === 'close' || response.state === 'none') {
					throw new Error(`Video player was expected to exist but did not`);
				}
				break;
			default:
				debugger;
				break;
		}

		// Suitest once again is slower so can cause some existing tests to fail so we add a small sleep here to try and mitigate
		await utils.sleep(200);
	}

	private compareValues(operator: StringComparator | NumberComparator, a: string | number, b: string | number) {
		switch (operator) {
			case "=": return a == b;
			case "!=": return a != b;
			case ">": return a > b;
			case ">=": return a >= b;
			case "<": return a < b;
			case "<=": return a <= b;

			case "~":
			case "!~":
			case "^":
			case "!^":
			case "$":
			case "!$":
			case "+-":
				debugger;
		}
		return false;
	}

	public async findMatchingNode(rootNodeTree: ODC.TreeNode[], xpathParts: string[], flatTree: ODC.TreeNode[], previousXpathParts = [] as string[]): Promise<ODC.TreeNode> {
		while (xpathParts.length > 0 && xpathParts[0] === '') {
			xpathParts.shift();
		}

		let currentNodeSubtypePattern = xpathParts.shift() ?? '';
		previousXpathParts.push(currentNodeSubtypePattern);
		const positionMatch = currentNodeSubtypePattern.match(/\[(\d*)\]?/);
		let matchesLeft = 0;
		if (positionMatch) {
			currentNodeSubtypePattern = currentNodeSubtypePattern.replace(positionMatch[0], '');
			matchesLeft = +positionMatch[1] - 1; //xpath is one based so have to subtract 1
		}

		// If we encounter a RowListItem we always treat it like we're checking against the currently focused row
		if (currentNodeSubtypePattern === 'RowListItem') {
			const {ref} = await this.odc.getFocusedNode({
				returnFocusedArrayGridChild: true,
				includeRef: true
			});

			const itemComponentNodeTree = this.getNodeTree(flatTree, ref);
			// Have to walk up two to get to the RowListItem
			const markupGridNodeTree = this.getNodeTree(flatTree, itemComponentNodeTree?.parentRef);
			const rowlistItemNodeTree = this.getNodeTree(flatTree, markupGridNodeTree?.parentRef);
			if (rowlistItemNodeTree) {
				return this.findMatchingNode(rowlistItemNodeTree.children, xpathParts, flatTree, previousXpathParts);
			} else {
				debugger;
			}
		}

		for (const nodeTree of rootNodeTree) {
			if (nodeTree.subtype === currentNodeSubtypePattern) {
				if (matchesLeft) {
					matchesLeft--;
					continue;
				}
				if (xpathParts.length === 0) {
					return nodeTree;
				}
				return this.findMatchingNode(nodeTree.children, xpathParts, flatTree, previousXpathParts);
			}
		}

		throw new Error(`Failed to find '${currentNodeSubtypePattern}' at xpath '${previousXpathParts.join('/')}'`);
	}

	private getNodeTree(flatTree: ODC.TreeNode[], ref?: number) {
		if (!ref) {
			return undefined;
		}

		for (const nodeTree of flatTree) {
			if (nodeTree.ref === ref) {
				return nodeTree;
			}
		}
	}

	private debugLog(message: string, ...args) {
		console.log(`[Suitest] ${'  '.repeat(this.logIndentLevel)}${message}`, ...args);
	}
}

interface ApiTestItem {
	testId: string
	title: string
	tags: string[]
	latestRevisionTime: string
	latestRevisionAuthor: {
		name: string
		email: string
	}
	definition: TestLine[]
	description: string;
}
