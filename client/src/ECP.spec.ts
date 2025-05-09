import type * as needle from 'needle';
import * as fsExtra from 'fs-extra';
import * as assert from 'assert';
import * as chai from 'chai';
// TODO remove this
const assertArrays = require('chai-arrays');
chai.use(assertArrays);
import * as sinonImport from 'sinon';
const sinon = sinonImport.createSandbox();
const expect = chai.expect;

import { ECP } from './ECP';
import * as testUtils from './test/utils';
import type { ConfigOptions } from './types/ConfigOptions';
import type { AppUIResponse, AppUIResponseChild } from '.';
import { utils } from '.';

describe('ECP', function () {
	let ecp: ECP;
	let device: any;
	let ecpResponse: any;
	let ecpUtils: any;
	let config: ConfigOptions;

	beforeEach(() => {
		device = {
			sendEcpPost: () => {
				return ecpResponse;
			},
			sendEcpGet: () => {
				return ecpResponse;
			}
		};
		ecp = new ECP(device);
		ecpUtils = ecp['utils'];
		ecpResponse = '';
	});

	afterEach(() => {
		sinon.restore();
	});

	describe('sendText', function () {
		it('calls_device_sendEcpPost_for_each_character', async () => {
			const stub = sinon.stub(device, 'sendEcpPost').callsFake(((path: string, params?: object, body?: needle.BodyData) => {}) as any);

			const text = 'love my life';
			await ecp.sendText(text);
			expect(stub.callCount).to.equal(text.length);
		});

		it('uses_raspTemplateVariable_if_provided_instead_of_text_for_rasp_output', async () => {
			ecp.startRaspFileCreation();
			const raspFileSteps = (ecp as any).raspFileSteps as string[];
			await ecp.sendText('bob@hotmail.com', {raspTemplateVariable: 'script-login'});
			expect(raspFileSteps[0]).to.contain('script-login');
			await ecp.sendText('123456', {raspTemplateVariable: 'script-password'});
			expect(raspFileSteps[1]).to.contain('script-password');
		});
	});

	describe('sendKeypressSequence', function () {
		it('calls_device_sendEcpPost_for_each_key', async () => {
			const stub = sinon.stub(device, 'sendEcpPost').callsFake(((path: string, params?: object, body?: needle.BodyData) => {}) as any);

			const keys = [ECP.Key.Forward, ECP.Key.Play, ECP.Key.Rewind];
			await ecp.sendKeypressSequence(keys);
			expect(stub.callCount).to.equal(keys.length);
		});

		it('should send_the_pattern_multiple_times_in_the_correct_order_if_count_is_more_than_one', async () => {
			let index = 0;
			const keys = [ECP.Key.Forward, ECP.Key.Play, ECP.Key.Rewind];
			const count = 3;

			const stub = sinon.stub(device, 'sendEcpPost').callsFake(((path: string, params?: object, body?: needle.BodyData) => {
				expect(path).to.contain(keys[index]);
				index++;
				if (index === keys.length) {
					index = 0;
				}
			}) as any);

			await ecp.sendKeypressSequence(keys, {count: count});
			expect(stub.callCount).to.equal(keys.length * count);
		});

		it('should_not_send_any_keys_if_count_is_zero', async () => {
			const keys = [ECP.Key.Forward, ECP.Key.Play, ECP.Key.Rewind];

			const stub = sinon.stub(device, 'sendEcpPost').callsFake(((path: string, params?: object, body?: needle.BodyData) => {}) as any);

			await ecp.sendKeypressSequence(keys, {count: 0});
			expect(stub.callCount).to.equal(0);
		});
	});

	describe('sendKeypress', function () {
		it('calls_device_sendEcpPost', async () => {
			const stub = sinon.stub(device, 'sendEcpPost').callsFake(((path: string, params?: object, body?: needle.BodyData) => {
				expect(path).to.contain(ECP.Key.Home);
			}) as any);

			await ecp.sendKeypress(ECP.Key.Home, 0);

			if (stub.notCalled) {
				assert.fail('device.sendEcpPost not called');
			}
		});

		it('does_not_sleep_if_not_requested', async () => {
			const stub = sinon.stub(ecpUtils, 'sleep').callsFake(((milliseconds: number) => {}) as any);

			await ecp.sendKeypress(ECP.Key.Home, 0);

			if (stub.called) {
				assert.fail('sleep was called');
			}
		});

		it('sleeps_if_requested', async () => {
			const wait = 1000;
			const stub = sinon.stub(ecpUtils, 'sleep').callsFake(((milliseconds: number) => {
				expect(milliseconds).to.equal(wait);
			}) as any);

			await ecp.sendKeypress(ECP.Key.Home, wait);

			if (stub.notCalled) {
				assert.fail('sleep was not called');
			}
		});

		it('uses_config_value_if_override_not_provided', async () => {
			const wait = 1000;
			config.ECP = {
				default: {
					keypressDelay: wait
				}
			};

			const stub = sinon.stub(ecpUtils, 'sleep').callsFake(((milliseconds: number) => {
				expect(milliseconds).to.equal(wait);
			}) as any);

			await ecp.sendKeypress(ECP.Key.Home);

			if (stub.notCalled) {
				assert.fail('sleep was not called');
			}
		});

		it('does_not_use_config_value_if_override_provided', async () => {
			const wait = 1000;
			config.ECP = {
				default: {
					keypressDelay: 2000
				}
			};

			const stub = sinon.stub(ecpUtils, 'sleep').callsFake(((milliseconds: number) => {
				expect(milliseconds).to.equal(wait);
			}) as any);

			await ecp.sendKeypress(ECP.Key.Home, wait);

			if (stub.notCalled) {
				assert.fail('sleep was not called');
			}
		});
	});

	describe('sendKeyDown', function () {
		it('sends_key_down_event', async () => {
			const postStub = sinon.stub(device, 'sendEcpPost').callsFake(((path: string, params?: object, body?: needle.BodyData) => {
				expect(path).to.contain(ECP.Key.Play);
			}) as any);

			await ecp.sendKeyDown(ECP.Key.Play);

			expect(postStub.callCount).equals(1);
			expect(postStub.getCall(0).lastArg).to.include('keydown/Play');
		});

		it('sends_multiple_key_events', async () => {
			const postStub = sinon.stub(device, 'sendEcpPost').callsFake(((path: string, params?: object, body?: needle.BodyData) => {
				expect(path).to.contain(ECP.Key.Play);
			}) as any);

			await ecp.sendKeyDown(ECP.Key.Play, 0, { count: 3 });

			expect(postStub.callCount).equals(3);
			expect(postStub.getCall(0).lastArg).to.include('keydown/Play');
			expect(postStub.getCall(1).lastArg).to.include('keydown/Play');
			expect(postStub.getCall(2).lastArg).to.include('keydown/Play');
		});
	});

	describe('sendKeyUp', function () {
		it('sends_key_up_event', async () => {
			const postStub = sinon.stub(device, 'sendEcpPost').callsFake(((path: string, params?: object, body?: needle.BodyData) => {
				expect(path).to.contain(ECP.Key.Play);
			}) as any);

			await ecp.sendKeyUp(ECP.Key.Play);

			expect(postStub.callCount).equals(1);
			expect(postStub.getCall(0).lastArg).to.include('keyup/Play');
		});
	});

	describe('sendKeyPressAndHold', function () {
		it('sends_long_key_press', async () => {
			const postStub = sinon.stub(device, 'sendEcpPost').callsFake(((path: string, params?: object, body?: needle.BodyData) => {
				expect(path).to.contain(ECP.Key.Play);
			}) as any);

			sinon.stub(ecpUtils, 'sleep').callsFake(((milliseconds: number) => {
				expect(milliseconds).to.greaterThan(0);
			}) as any);

			await ecp.sendKeyPressAndHold(ECP.Key.Play, 500);

			expect(postStub.callCount).equals(2);
			expect(postStub.getCall(0).lastArg).to.include('keydown/Play');
			expect(postStub.getCall(1).lastArg).to.include('keyup/Play');
		});
	});

	describe('sendKeyEvent', function () {
		it('sends_regular_key_press_when_press_and_hold_has_no_duration', async () => {
			const postStub = sinon.stub(device, 'sendEcpPost').callsFake(((path: string, params?: object, body?: needle.BodyData) => {
				expect(path).to.contain(ECP.Key.Play);
			}) as any);

			await ecp.sendKeyEvent(ECP.Key.Play, 0);
			await ecp.sendKeyEvent(ECP.Key.Play, { keydown: true, keyup: true, duration: 0 });

			expect(postStub.callCount).equals(2);
			expect(postStub.getCall(0).lastArg).to.include('keypress/Play');
			expect(postStub.getCall(1).lastArg).to.include('keypress/Play');
		});
	});

	describe('getActiveApp', function () {
		it('app_active', async () => {
			ecpResponse = await testUtils.getNeedleMockResponse(this);
			const result = await ecp.getActiveApp();
			expect(result.app?.id).to.equal('dev');
			expect(result.app?.title).to.equal('mockAppTitle');
			expect(result.app?.type).to.equal('appl');
			expect(result.app?.version).to.equal('1.0.0');
		});

		it('no_app_or_screensaver_active', async () => {
			ecpResponse = await testUtils.getNeedleMockResponse(this);
			const result = await ecp.getActiveApp();
			expect(result.app?.id).to.not.be.ok;
			expect(result.app?.title).to.equal('Roku');
		});

		it('screensaver_active_app_open', async () => {
			ecpResponse = await testUtils.getNeedleMockResponse(this);
			const result = await ecp.getActiveApp();
			expect(result.app?.id).to.equal('dev');
			expect(result.app?.title).to.equal('mockAppTitle');
			expect(result.app?.type).to.equal('appl');
			expect(result.app?.version).to.equal('1.0.0');

			expect(result.screensaver?.id).to.equal('261525');
			expect(result.screensaver?.title).to.equal('Aquatic Life');
			expect(result.screensaver?.type).to.equal('ssvr');
			expect(result.screensaver?.version).to.equal('13.0.90000006');
		});

		it('screensaver_active_no_app_open', async () => {
			ecpResponse = await testUtils.getNeedleMockResponse(this);
			const result = await ecp.getActiveApp();
			expect(result.screensaver?.id).to.equal('261525');
			expect(result.screensaver?.title).to.equal('Aquatic Life');
			expect(result.screensaver?.type).to.equal('ssvr');
			expect(result.screensaver?.version).to.equal('13.0.90000006');

			expect(result.app?.id).to.not.be.ok;
			expect(result.app?.title).to.equal('Roku');
		});
	});

	describe('sendLaunchChannel', function () {
		it('should_not_throw_if_successful_and_verification_is_enabled', async () => {
			ecpResponse = await testUtils.getNeedleMockResponse(this);
			await ecp.sendLaunchChannel({
				channelId: 'dev',
				params: {},
				verifyLaunch: false
			});
		});

		it('should_throw_if_channelId_not_supplied_and_no_config', async () => {
			try {
				await ecp.sendLaunchChannel();
			} catch (e) {
				expect(e.name).to.equal('LaunchChannelIdMissing');
				return;
			}
			assert.fail('Exception should have been thrown');
		});

		it('should_not_throw_if_channelId_not_supplied_but_in_config', async () => {
			try {
				config.ECP = {
					default: {
						launchChannelId: 'dev'
					}
				};

				await ecp.sendLaunchChannel({
					channelId: '',
					params: {},
					verifyLaunch: false
				});
			} catch (e) {
				assert.fail('Exception should not have been thrown: ' + e.message);
			}
		});

		it('should_throw_if_launch_not_successful_and_verification_is_enabled', async () => {
			sinon.stub(ecpUtils, 'sleep').callsFake(((milliseconds: number) => {}) as any);
			try {
				await ecp.sendLaunchChannel({
					channelId: 'dev',
					params: {},
					verifyLaunch: true,
					verifyLaunchTimeOut: 20
				});
			} catch (e) {
				expect(e.name).to.equal('sendLaunchChannelVerifyLaunch');
				return;
			}
			assert.fail('Exception should have been thrown');
		});

		it('should_not_throw_if_launch_not_successful_and_verification_not_enabled', async () => {
			await ecp.sendLaunchChannel({
				channelId: 'dev',
				params: {},
				verifyLaunch: false
			});
		});
	});

	describe('getMediaPlayer', function () {
		it('app_closed', async () => {
			ecpResponse = await testUtils.getNeedleMockResponse(this);
			const result = await ecp.getMediaPlayer();
			expect(result.state).to.equal('close');
			expect(result.error).to.equal(false);
			expect(result.plugin).to.not.be.ok;
		});

		it('player_closed', async () => {
			ecpResponse = await testUtils.getNeedleMockResponse(this);
			const result = await ecp.getMediaPlayer();

			expect(result.state).to.equal('close');
			expect(result.error).to.equal(false);

			expect(result.plugin?.bandwidth).to.equal('19111730 bps');
			expect(result.plugin?.id).to.equal('dev');
			expect(result.plugin?.name).to.equal('App name');
		});

		it('player_startup', async () => {
			ecpResponse = await testUtils.getNeedleMockResponse(this);
			const result = await ecp.getMediaPlayer();

			expect(result.state).to.equal('startup');
			expect(result.error).to.equal(false);

			expect(result.plugin?.bandwidth).to.equal('19111730 bps');
			expect(result.plugin?.id).to.equal('dev');
			expect(result.plugin?.name).to.equal('App name');

			expect(result.buffering?.current).to.equal('0');
			expect(result.buffering?.max).to.equal('1000');
			expect(result.buffering?.target).to.equal('1000');

			expect(result.new_stream?.speed).to.equal('128000 bps');

			expect(result.duration?.value).to.equal('8551626 ms');

			expect(result.is_live?.value).to.equal('false');
		});

		it('player_buffering', async () => {
			ecpResponse = await testUtils.getNeedleMockResponse(this);
			const result = await ecp.getMediaPlayer();

			expect(result.state).to.equal('buffer');
			expect(result.error).to.equal(false);

			expect(result.plugin?.bandwidth).to.equal('19111730 bps');
			expect(result.plugin?.id).to.equal('dev');
			expect(result.plugin?.name).to.equal('App name');

			expect(result.buffering?.current).to.equal('0');
			expect(result.buffering?.max).to.equal('1000');
			expect(result.buffering?.target).to.equal('1000');

			expect(result.new_stream?.speed).to.equal('128000 bps');

			expect(result.duration?.value).to.equal('8551626 ms');

			expect(result.is_live?.value).to.equal('false');
		});

		it('player_playing', async () => {
			ecpResponse = await testUtils.getNeedleMockResponse(this);
			const result = await ecp.getMediaPlayer();

			expect(result.state).to.equal('play');
			expect(result.error).to.equal(false);

			expect(result.plugin?.bandwidth).to.equal('19111730 bps');
			expect(result.plugin?.id).to.equal('dev');
			expect(result.plugin?.name).to.equal('App name');

			expect(result.format?.audio).to.equal('aac_adts');
			expect(result.format?.captions).to.equal('webvtt');
			expect(result.format?.container).to.equal('hls');
			expect(result.format?.drm).to.equal('none');
			expect(result.format?.video).to.equal('mpeg4_10b');

			expect(result.buffering?.current).to.equal('1000');
			expect(result.buffering?.max).to.equal('1000');
			expect(result.buffering?.target).to.equal('0');

			expect(result.new_stream?.speed).to.equal('128000 bps');

			expect(result.duration?.value).to.equal('8551626 ms');

			expect(result.is_live?.value).to.equal('false');
		});

		it('player_paused', async () => {
			ecpResponse = await testUtils.getNeedleMockResponse(this);
			const result = await ecp.getMediaPlayer();

			expect(result.state).to.equal('pause');
			expect(result.error).to.equal(false);

			expect(result.plugin?.bandwidth).to.equal('19111730 bps');
			expect(result.plugin?.id).to.equal('dev');
			expect(result.plugin?.name).to.equal('App name');

			expect(result.format?.audio).to.equal('aac_adts');
			expect(result.format?.captions).to.equal('webvtt');
			expect(result.format?.container).to.equal('hls');
			expect(result.format?.drm).to.equal('none');
			expect(result.format?.video).to.equal('mpeg4_10b');

			expect(result.buffering?.current).to.equal('1000');
			expect(result.buffering?.max).to.equal('1000');
			expect(result.buffering?.target).to.equal('0');

			expect(result.new_stream?.speed).to.equal('128000 bps');

			expect(result.duration?.value).to.equal('8551626 ms');

			expect(result.is_live?.value).to.equal('false');
		});
	});

	describe('getChanperf', function () {
		it('app_closed', async () => {
			ecpResponse = await testUtils.getNeedleMockResponse(this);
			const result = await ecp.getChanperf();
			expect(result.error).to.equal('Channel not running');
			expect(result.status).to.equal('FAILED');
			expect(result.plugin).to.not.be.ok;
		});

		it('app_open', async () => {
			ecpResponse = await testUtils.getNeedleMockResponse(this);
			const result = await ecp.getChanperf();
			expect(result.status).to.equal('OK');
			expect(result.plugin?.id).to.equal('dev');
			expect(result.plugin?.cpuPercent).to.be.ok;
			expect(result.plugin?.cpuPercent.user).to.equal(0.2);
			expect(result.plugin?.memory.anon).to.equal(91312128);
		});
	});

	describe('startRaspFileCreation', function () {
		it('creates_empty_array_for_raspFileSteps_when_run', () => {
			expect((ecp as any).raspFileSteps).to.be.undefined;
			ecp.startRaspFileCreation();
			expect((ecp as any).raspFileSteps).to.be.array();
		});
	});

	describe('finishRaspFileCreation', function () {
		const outputPath = 'test-path.rasp';

		it('outputs_file_at_path_specified_with_correct_contents', async () => {
			sinon.stub(ecpUtils, 'sleep').callsFake(((milliseconds: number) => {}) as any);
			config.ECP = {
				default: {
					keypressDelay: 1500
				}
			};

			ecp.startRaspFileCreation();
			await ecp.sendKeypress(ecp.Key.Up, 1);
			await ecp.sendKeypress(ecp.Key.Up, 1);
			await ecp.sendKeypress(ecp.Key.Down, 1);
			await ecp.sendKeypress(ecp.Key.Down, 1);
			await ecp.sendKeypress(ecp.Key.Left, 1);
			await ecp.sendKeypress(ecp.Key.Right, 1);
			await ecp.sendKeypress(ecp.Key.Left, 1);
			await ecp.sendKeypress(ecp.Key.Right, 1);
			await ecp.sleep(100);
			await ecp.sendKeypress(ecp.Key.Ok, 1);
			ecp.finishRaspFileCreation(outputPath);
			const expectedContents =
`params:
    rasp_version: 1
    default_keypress_wait: 1.5
steps:
    - press: up
    - press: up
    - press: down
    - press: down
    - press: left
    - press: right
    - press: left
    - press: right
    - pause: 0.1
    - press: ok`;
			expect(fsExtra.readFileSync(outputPath, 'utf8')).to.equal(expectedContents);
		});

		it('cleans_up_array_when_done', () => {
			ecp.startRaspFileCreation();
			expect((ecp as any).raspFileSteps).to.be.array();

			ecp.finishRaspFileCreation(outputPath);
			expect((ecp as any).raspFileSteps).to.be.undefined;
		});
		after(() => {
			fsExtra.removeSync(outputPath);
		});
	});
});
