import * as assert from 'assert';
import * as chai from 'chai';
const expect = chai.expect;
import * as sinonImport from 'sinon';
const sinon = sinonImport.createSandbox();


import {utils} from './utils';

describe('utils', function () {
	afterEach(() => {
		sinon.restore();
	});

	describe('getConfigFromConfigFile', function () {
		it('allows us to extend the config and have the correct values from both config files', () => {
			const config = utils.getConfigFromConfigFile('rta-config.json');

			expect(config.RokuDevice.devices.length).to.be.greaterThan(0);
			expect(config.OnDeviceComponent?.helperInjection?.componentPaths).to.include('components/MainScene.xml');
		});

		it('throws an exception if the file does not exist', () => {
			try {
				utils.getConfigFromConfigFile('invalid.json');
			} catch(e) {
				// failed as expected
				return;
			}
			assert.fail('Should have thrown an exception');
		});

		it('throws an exception if a circular reference is detected', () => {
			try {
				sinon.stub(utils, 'parseJsonFile').callsFake((filePath) => {
					return {
						extends: filePath
					};
				});
				const fakeFileName = utils.randomStringGenerator();
				utils.getConfigFromConfigFile(fakeFileName);
			} catch(e) {
				// failed as expected
				return;
			}
			assert.fail('Should have thrown an exception');
		});
	});
});
