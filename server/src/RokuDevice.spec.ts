import * as assert from 'assert';
import * as chai from 'chai';
import * as sinonImport from 'sinon';
import * as fsExtra from 'fs-extra';
const sinon = sinonImport.createSandbox();
const expect = chai.expect;
import * as querystring from 'needle/lib/querystring';

import { RokuDevice } from './RokuDevice';
import { ECP } from './ECP';
import * as utils from './utils';

describe('RokuDevice', function () {
	let device: RokuDevice;
	let ecp: ECP;
	beforeEach(() => {
		({device, ecp} = utils.setupFromConfigFile());
	});

	afterEach(() => {
		sinon.restore();
	});

	this.timeout(10000);

	describe('sendECP', () => {
		it('should work for POST requests', async () => {
			await device.sendECP('keypress/Home', {}, '');
		});

		it('should work if params are passed in', async () => {
			sinon.stub((device as any), 'needle').callsFake((method, url, data, options?) => {
				expect(url).to.contain(querystring.build(params));
			});
			const params = {
				contentId: 'contentIdValue',
				mediaType: 'special'
			};
			await device.sendECP('launch/dev', params, '');
		});
	});

	describe('getScreenshot', () => {
		it('should work', async () => {
			await ecp.sendLaunchChannel();
			const screenShotPath = await device.getScreenshot('output');
			if (!fsExtra.existsSync(screenShotPath)) {
				assert.fail(`'${screenShotPath}' did not exist`);
			}
			fsExtra.removeSync(screenShotPath);
		});
	});
});
