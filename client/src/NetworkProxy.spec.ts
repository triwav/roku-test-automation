import * as chai from 'chai';
const expect = chai.expect;
import * as assert from 'assert';

import { utils } from './utils';
import { ecp, odc, device, proxy } from '.';

// Skipping as pretty slow to run and sometimes fails
describe.skip('NetworkProxy', function () {
	before(async () => {
		await device.deploy({
			rootDir: '../testProject',
			preventMultipleDeployments: true
		});
	});

	it('should be able to intercept a request', async () => {
		await proxy.start();

		const imageUrl = 'https://picsum.photos/600/?r=' + Math.random();
		const promise = new Promise((resolve) => {
			proxy.observeRequest(imageUrl, () => {
				resolve(null);
			});
		});

		await odc.callFunc({
			base: 'scene',
			keyPath: '',
			funcName: 'setPosterUrl',
			funcParams: [imageUrl]
		});
		await utils.promiseTimeout(promise, 2000, 'Did not receive proxy request from Roku device');
	});
});
