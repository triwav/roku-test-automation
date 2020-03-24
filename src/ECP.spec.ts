import * as needle from 'needle';
import * as assert from 'assert';
import * as chai from 'chai';
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
		ecp = new ECP(device, config);
		ecpUtils = (ecp as any).utils;
		ecpResponse = '';
	});

	describe('sendText', function () {
		it('calls_device_sendECP_for_each_character', async () => {
			device.sendECP = sinon.spy((path: string, params?: object, body?: needle.BodyData) => {

			});
			const text = 'love my life';
			await ecp.sendText(text);
			expect(device.sendECP.callCount).to.equal(text.length);
		});
	});

	describe('sendKeyPressSequence', function () {
		it('calls_device_sendECP_for_each_key', async () => {
			device.sendECP = sinon.spy((path: string, params?: object, body?: needle.BodyData) => {

			});

			const keys = [ECP.Key.FORWARD, ECP.Key.PLAY, ECP.Key.REWIND];
			await ecp.sendKeyPressSequence(keys);

			expect(device.sendECP.callCount).to.equal(keys.length);
		});
	});

	describe('sendKeyPress', function () {
		it('calls_device_sendECP', async () => {
			device.sendECP = sinon.spy((path: string, params?: object, body?: needle.BodyData) => {
				expect(path).to.contain(ECP.Key.HOME);
			});

			await ecp.sendKeyPress(ECP.Key.HOME, 0);

			if (device.sendECP.notCalled) {
				assert.fail('device.sendECP not called');
			}
		});

		it('does_not_sleep_if_not_requested', async () => {
			ecpUtils.sleep = sinon.spy((milliseconds: number) => {

			});
			await ecp.sendKeyPress(ECP.Key.HOME, 0);

			if (ecpUtils.sleep.called) {
				assert.fail('sleep was called');
			}
		});

		it('sleeps_if_requested', async () => {
			const wait = 1000;
			ecpUtils.sleep = sinon.spy((milliseconds: number) => {
				expect(milliseconds).to.equal(wait);
			});
			await ecp.sendKeyPress(ECP.Key.HOME, wait);

			if (ecpUtils.sleep.notCalled) {
				assert.fail('sleep was not called');
			}
		});

		it('uses_config_value_if_override_not_provided', async () => {
			const wait = 1000;
			config.defaults = {
				ecp: {
					keyPressDelay: wait
				}
			};
			ecpUtils.sleep = sinon.spy((milliseconds: number) => {
				expect(milliseconds).to.equal(wait);
			});
			await ecp.sendKeyPress(ECP.Key.HOME);

			if (ecpUtils.sleep.notCalled) {
				assert.fail('sleep was not called');
			}
		});

		it('does_not_use_config_value_if_override_provided', async () => {
			const wait = 1000;
			config.defaults = {
				ecp: {
					keyPressDelay: 2000
				}
			};
			ecpUtils.sleep = sinon.spy((milliseconds: number) => {
				expect(milliseconds).to.equal(wait);
			});
			await ecp.sendKeyPress(ECP.Key.HOME, wait);

			if (ecpUtils.sleep.notCalled) {
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
			await ecp.sendLaunchChannel('dev', {}, true);
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
				config.channel = {
					id: 'dev'
				};
				await ecp.sendLaunchChannel('', {}, false);
			} catch (e) {
				assert.fail('Exception should not have been thrown: ' + e.message);
			}
		});

		it('should_throw_if_launch_not_successful_and_verification_is_enabled', async () => {
			try {
				await ecp.sendLaunchChannel('dev', {}, true);
			} catch (e) {
				expect(e.name).to.equal('sendLaunchChannelVerifyLaunch');
				return;
			}
			assert.fail('Exception should have been thrown');
		});

		it('should_not_throw_if_launch_not_successful_and_verification_not_enabled', async () => {
			await ecp.sendLaunchChannel('dev', {}, false);
		});
	});
});
