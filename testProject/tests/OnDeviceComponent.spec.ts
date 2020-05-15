import * as chai from 'chai';
const expect = chai.expect;
import * as assert from 'assert';

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

	describe('observeField', function () {
		it('should fail if given invalid keyPath', async () => {
			try {
				await odc.observeField('global', 'does.not.exist');
			} catch (e) {
				// failed as expected
				return;
			}
			assert.fail('Should have thrown an exception');
		});

		it('should succeed if given a valid node for its parent keyPath', async () => {
			const keyPath = 'AuthManager.isLoggedIn';
			await setAndVerifyValue('global', keyPath, false);
			const observePromise = odc.observeField('global', keyPath);
			await setAndVerifyValue('global', keyPath, true);
			const {value} = await observePromise;
			expect(value).to.be.true;
		});

		it('should wait for value to match if requested', async () => {
			const keyPath = 'stringValue';
			const expectedValue = utils.addRandomPostfix('secondValue');
			const observePromise = odc.observeField('global', keyPath, expectedValue);
			await setAndVerifyValue('global', keyPath, utils.addRandomPostfix('firstValue'));
			await setAndVerifyValue('global', keyPath, expectedValue);
			const {value} = await observePromise;
			expect(value).to.equal(expectedValue);
		});

		it('if the match key path does not exist it should throw an error', async () => {
			const keyPath = 'stringValue';
			const observePromise = odc.observeField('global', keyPath, 'willNeverMatch', 'global', 'invalid.key.path');
			const setValuePromise = setAndVerifyValue('global', keyPath, utils.addRandomPostfix('trigger'));
			try {
				await Promise.all([observePromise, setValuePromise]);
			} catch (e) {
				return;
			}
			assert.fail('Should have thrown an exception');
		});

		it('it should allow match on other key paths and wait until that value matches', async () => {
			const keyPath = 'stringValue';
			const matchValue = 42;
			const matchKeyPath = 'intValue';
			await setAndVerifyValue('global', matchKeyPath, 0);
			const observePromise = odc.observeField('global', keyPath, matchValue, 'global', matchKeyPath);
			await setAndVerifyValue('global', keyPath, utils.addRandomPostfix('firstValue'));
			const expectedValue = utils.addRandomPostfix('secondValue');
			await setAndVerifyValue('global', matchKeyPath, matchValue);
			await setAndVerifyValue('global', keyPath, expectedValue);
			const {value} = await observePromise;
			expect(value).to.equal(expectedValue);
		});
	});

	async function setAndVerifyValue(base: KeyPathBaseTypes, keyPath: string, value: any, startingValue?: any) {
		if (startingValue !== undefined) {
			expect(await odc.getValueAtKeyPath(base, keyPath)).to.equal(startingValue, `${base}.${keyPath} did not match expected value before set`);
		}
		const result = await odc.setValueAtKeyPath(base, keyPath, value);
		expect(result.success).to.be.true;
		expect(await odc.getValueAtKeyPath(base, keyPath)).to.equal(value, `${base}.${keyPath} did not match expected value after set`);
	}
});
