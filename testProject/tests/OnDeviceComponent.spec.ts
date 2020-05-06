import * as chai from 'chai';
const expect = chai.expect;

import * as utils from '../../server/src/utils';
import { KeyPathBaseTypes } from '../../server/src/types/OnDeviceComponentRequest';
const {device, odc, ecp} = utils.setupFromConfigFile();

describe('OnDeviceComponent', function () {
	describe('getValueAtKeyPath', function () {
		it('should work with findnode', async () => {
			const value = await odc.getValueAtKeyPath('scene', 'subchild3');
			expect(value.id).to.eq('subchild3');
		});

		it('should not find a child if it is not beneath the parent node', async () => {
			const value = await odc.getValueAtKeyPath('scene', 'subchild3.testTarget');
			expect(value.id).to.be.undefined;
		});

		it('should work with findNode.getChild', async () => {
			const value = await odc.getValueAtKeyPath('scene', 'testTarget.0');
			expect(value.id).to.eq('child1');
		});

		it('should work with findNode.getChild.getChild', async () => {
			const value = await odc.getValueAtKeyPath('scene', 'testTarget.1.1');
			expect(value.id).to.eq('subchild2');
		});

		it('should work with findNode.getChild.findNode', async () => {
			const value = await odc.getValueAtKeyPath('scene', 'testTarget.1.subchild1');
			expect(value.id).to.eq('subchild1');
		});

		it('should work with for multiple values', async () => {
			const values = await odc.getValuesAtKeyPaths({
				subchild1: {base: 'scene', keyPath: 'testTarget.1.subchild1'},
				subchild2: {base: 'scene', keyPath: 'testTarget.1.1'}
			});
			expect(values.subchild1.id).to.eq('subchild1');
			expect(values.subchild2.id).to.eq('subchild2');
		});

		it('should be able to get a value on a valid field', async () => {
			const value = await odc.getValueAtKeyPath('global', 'authManager.isLoggedIn');
			expect(value).to.be.false;
		});
	});

	describe('setValueAtKeyPath', function () {
		async function setAndVerifyValue(base: KeyPathBaseTypes, keyPath: string, value: any, startingValue: any) {
			expect(await odc.getValueAtKeyPath(base, keyPath)).to.equal(startingValue, `${base}.${keyPath} did not match expected value before set`);
			const result = await odc.setValueAtKeyPath(base, keyPath, value);
			expect(result.success).to.be.true;
			expect(await odc.getValueAtKeyPath(base, keyPath)).to.equal(value, `${base}.${keyPath} did not match expected value after set`);
		}

		it('should be able to set a key on global', async () => {
			await setAndVerifyValue('global', 'booleanValue', false, true);
		});

		it('should be able set a value on a node and succeed', async () => {
			await setAndVerifyValue('global', 'authManager.isLoggedIn', true, false);
		});

		it('should be able to set a key on an AA stored on a node', async () => {
			await setAndVerifyValue('global', 'authManager.profiles.profile1.settings.personalization.showContinueWatching', false, true);
		});
	});
});
