import * as chai from 'chai';
const expect = chai.expect;


import {utils} from './utils';

describe('utils', function () {
	describe('getConfigFromConfigFile', function () {
		it('allows us to extend the config and have the correct values from both config files', () => {
			const config = utils.getConfigFromConfigFile('rta-config.json');

			expect(config.RokuDevice.devices.length).to.be.greaterThan(0);
			expect(config.OnDeviceComponent?.helperInjection?.componentPaths).to.include('components/MainScene.xml');
		});
	});
});
