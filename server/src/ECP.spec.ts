import * as needle from 'needle';
import * as fsExtra from 'fs-extra';
import * as assert from 'assert';
import * as chai from 'chai';
const assertArrays = require('chai-arrays');
chai.use(assertArrays);
import * as sinonImport from 'sinon';
const sinon = sinonImport.createSandbox();
const expect = chai.expect;

import { ECP } from './ECP';
import * as utils from './test/utils';
import { ConfigOptions } from './types/ConfigOptions';

describe('ECP', function () {
	let ecp: ECP;
	let device: any;
	let ecpResponse: any;
	let ecpUtils: any;
	let config: ConfigOptions;

	beforeEach(() => {
		device = {
			sendECP: () => {
				return ecpResponse;
			}
		};
		config = ({} as any);
		ecp = new ECP(config);
		(ecp as any).device = device;
		ecpUtils = (ecp as any).utils;
		ecpResponse = '';
	});

	afterEach(() => {
		sinon.restore();
	});

	describe('sendText', function () {
		it('calls_device_sendECP_for_each_character', async () => {
			const stub = sinon.stub(device, 'sendECP').callsFake((path: string, params?: object, body?: needle.BodyData) => {});

			const text = 'love my life';
			await ecp.sendText(text);
			expect(stub.callCount).to.equal(text.length);
		});

		it('uses_raspTemplateVariable_if_provided_instead_of_text_for_rasp_output', async () => {
			ecp.startRaspFileCreation();
			const raspFileSteps = (ecp as any).raspFileSteps as string[];
			await ecp.sendText('bob@hotmail.com', undefined, 'script-login');
			expect(raspFileSteps[0]).to.contain('script-login');
			await ecp.sendText('123456', undefined, 'script-password');
			expect(raspFileSteps[1]).to.contain('script-password');
		});
	});

	describe('sendKeyPressSequence', function () {
		it('calls_device_sendECP_for_each_key', async () => {
			const stub = sinon.stub(device, 'sendECP').callsFake((path: string, params?: object, body?: needle.BodyData) => {});

			const keys = [ECP.Key.FORWARD, ECP.Key.PLAY, ECP.Key.REWIND];
			await ecp.sendKeyPressSequence(keys);
			expect(stub.callCount).to.equal(keys.length);
		});
	});

	describe('sendKeyPress', function () {
		it('calls_device_sendECP', async () => {
			const stub = sinon.stub(device, 'sendECP').callsFake((path: string, params?: object, body?: needle.BodyData) => {
				expect(path).to.contain(ECP.Key.HOME);
			});

			await ecp.sendKeyPress(ECP.Key.HOME, 0);

			if (stub.notCalled) {
				assert.fail('device.sendECP not called');
			}
		});

		it('does_not_sleep_if_not_requested', async () => {
			const stub = sinon.stub(ecpUtils, 'sleep').callsFake((milliseconds: number) => {});

			await ecp.sendKeyPress(ECP.Key.HOME, 0);

			if (stub.called) {
				assert.fail('sleep was called');
			}
		});

		it('sleeps_if_requested', async () => {
			const wait = 1000;
			const stub = sinon.stub(ecpUtils, 'sleep').callsFake((milliseconds: number) => {
				expect(milliseconds).to.equal(wait);
			});

			await ecp.sendKeyPress(ECP.Key.HOME, wait);

			if (stub.notCalled) {
				assert.fail('sleep was not called');
			}
		});

		it('uses_config_value_if_override_not_provided', async () => {
			const wait = 1000;
			config.ECP = {
				default: {
					keyPressDelay: wait
				}
			};

			const stub = sinon.stub(ecpUtils, 'sleep').callsFake((milliseconds: number) => {
				expect(milliseconds).to.equal(wait);
			});

			await ecp.sendKeyPress(ECP.Key.HOME);

			if (stub.notCalled) {
				assert.fail('sleep was not called');
			}
		});

		it('does_not_use_config_value_if_override_provided', async () => {
			const wait = 1000;
			config.ECP = {
				default: {
					keyPressDelay: 2000
				}
			};

			const stub = sinon.stub(ecpUtils, 'sleep').callsFake((milliseconds: number) => {
				expect(milliseconds).to.equal(wait);
			});

			await ecp.sendKeyPress(ECP.Key.HOME, wait);

			if (stub.notCalled) {
				assert.fail('sleep was not called');
			}
		});
	});

	describe('getActiveApp', function () {
		it('app_active', async () => {
			ecpResponse = await utils.getNeedleMockResponse(this);
			const result = await ecp.getActiveApp();
			expect(result.app?.id).to.equal('dev');
			expect(result.app?.title).to.equal('mockAppTitle');
			expect(result.app?.type).to.equal('appl');
			expect(result.app?.version).to.equal('1.0.0');
		});

		it('no_app_or_screensaver_active', async () => {
			ecpResponse = await utils.getNeedleMockResponse(this);
			const result = await ecp.getActiveApp();
			expect(result.app?.id).to.not.be.ok;
			expect(result.app?.title).to.equal('Roku');
		});

		it('screensaver_active_app_open', async () => {
			ecpResponse = await utils.getNeedleMockResponse(this);
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
			ecpResponse = await utils.getNeedleMockResponse(this);
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
			ecpResponse = await utils.getNeedleMockResponse(this);
			await ecp.sendLaunchChannel({
				channelId: 'dev',
				launchParameters: {},
				verifyLaunch: false
			});
		});

		it('should_throw_if_channelId_not_supplied_and_no_config', async () => {
			try {
				await ecp.sendLaunchChannel();
			} catch (e) {
				expect(e.name).to.equal('sendLaunchChannelChannelIdMissing');
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
					launchParameters: {},
					verifyLaunch: false
				});
			} catch (e) {
				assert.fail('Exception should not have been thrown: ' + e.message);
			}
		});

		it('should_throw_if_launch_not_successful_and_verification_is_enabled', async () => {
			try {
				await ecp.sendLaunchChannel({
					channelId: 'dev',
					launchParameters: {},
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
				launchParameters: {},
				verifyLaunch: false
			});
		});
	});

	describe('getMediaPlayer', function () {
		it('app_closed', async () => {
			ecpResponse = await utils.getNeedleMockResponse(this);
			const result = await ecp.getMediaPlayer();
			expect(result.state).to.equal('close');
			expect(result.error).to.equal(false);
			expect(result.plugin).to.not.be.ok;
		});

		it('player_closed', async () => {
			ecpResponse = await utils.getNeedleMockResponse(this);
			const result = await ecp.getMediaPlayer();

			expect(result.state).to.equal('close');
			expect(result.error).to.equal(false);

			expect(result.plugin?.bandwidth).to.equal('19111730 bps');
			expect(result.plugin?.id).to.equal('dev');
			expect(result.plugin?.name).to.equal('App name');
		});

		it('player_startup', async () => {
			ecpResponse = await utils.getNeedleMockResponse(this);
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
			ecpResponse = await utils.getNeedleMockResponse(this);
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
			ecpResponse = await utils.getNeedleMockResponse(this);
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
			ecpResponse = await utils.getNeedleMockResponse(this);
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

	describe('startRaspFileCreation', function () {
		it('creates_empty_array_for_raspFileSteps_when_run', async () => {
			expect((ecp as any).raspFileSteps).to.be.undefined;
			ecp.startRaspFileCreation();
			expect((ecp as any).raspFileSteps).to.be.array();
		});
	});

	describe('finishRaspFileCreation', function () {
		const outputPath = 'test-path.rasp';

		it('outputs_file_at_path_specified_with_correct_contents', async () => {
			config.ECP = {
				default: {
					keyPressDelay: 1500
				}
			};

			ecp.startRaspFileCreation();
			ecp.sendKeyPress(ecp.Key.UP);
			ecp.sendKeyPress(ecp.Key.UP);
			ecp.sendKeyPress(ecp.Key.DOWN);
			ecp.sendKeyPress(ecp.Key.DOWN);
			ecp.sendKeyPress(ecp.Key.LEFT);
			ecp.sendKeyPress(ecp.Key.RIGHT);
			ecp.sendKeyPress(ecp.Key.LEFT);
			ecp.sendKeyPress(ecp.Key.RIGHT);
			ecp.sleep(100);
			ecp.sendKeyPress(ecp.Key.OK);
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

		it('cleans_up_array_when_done', async () => {
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
