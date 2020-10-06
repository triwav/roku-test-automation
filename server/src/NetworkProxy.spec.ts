import * as chai from 'chai';
const expect = chai.expect;
import * as assert from 'assert';

import { utils } from './utils';
import { ODCSetValueAtKeyPathArgs } from './types/OnDeviceComponentRequest';
import { ecp, odc, device, proxy } from '.';

describe.only('NetworkProxy', function () {
	before(async () => {
		await device.deploy({rootDir: '../testProject'}, {preventMultipleDeployments: true});
		await ecp.sendLaunchChannel({skipIfAlreadyRunning: true});
	});

	it('should be able to intercept a request', async () => {
		await proxy.start();
		proxy.addBreakPointListener((args) => {
			console.log('addBreakPointListener');

			return null as any;
		});
		const imageUrl = 'https://picsum.photos/600';
		proxy.observeRequest(imageUrl, (test) => {
			debugger;
		});
		await odc.callFunc({
			base: 'scene',
			keyPath: '',
			funcName: 'setPosterUrl',
			funcParams: [imageUrl]
		});
	});
});
