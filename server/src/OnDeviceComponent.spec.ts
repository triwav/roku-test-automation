import * as chai from 'chai';
const expect = chai.expect;
import * as assert from 'assert';

import { utils } from './utils';
import { ODCSetValueAtKeyPathArgs } from './types/OnDeviceComponentRequest';
import { ecp, odc } from '.';

describe('OnDeviceComponent', function () {
	before(async () => {
		await ecp.sendLaunchChannel({skipIfAlreadyRunning: true});
	});

	describe('getValueAtKeyPath', function () {
		it('found should be true for if key path was found', async () => {
			const {found} = await odc.getValueAtKeyPath({base: 'scene', keyPath: 'subchild3'});
			expect(found).to.be.true;
		});

		it('found should be false if key path was not found', async () => {
			const {found} = await odc.getValueAtKeyPath({keyPath: 'invalid'});
			expect(found).to.be.false;
		});

		it('should work with findnode', async () => {
			const {value} = await odc.getValueAtKeyPath({base: 'scene', keyPath: 'subchild3'});
			expect(value.id).to.eq('subchild3');
		});

		it('should not find a child if it is not beneath the parent node', async () => {
			const {value} = await odc.getValueAtKeyPath({base: 'scene', keyPath: 'subchild3.testTarget'});
			expect(value.id).to.be.undefined;
		});

		it('should work with findNode.getChild', async () => {
			const {value} = await odc.getValueAtKeyPath({base: 'scene', keyPath: 'testTarget.0'});
			expect(value.id).to.eq('child1');
		});

		it('should work with findNode.getChild.getChild', async () => {
			const {value} = await odc.getValueAtKeyPath({base: 'scene', keyPath: 'testTarget.1.1'});
			expect(value.id).to.eq('subchild2');
		});

		it('should work with findNode.getChild.findNode', async () => {
			const {value} = await odc.getValueAtKeyPath({base: 'scene', keyPath: 'testTarget.1.subchild1'});
			expect(value.id).to.eq('subchild1');
		});

		it('should be able to get a value on a valid field', async () => {
			const {value} = await odc.getValueAtKeyPath({keyPath: 'AuthManager.isLoggedIn'});
			expect(value).to.be.false;
		});

		it('should work with array values', async () => {
			const {value} = await odc.getValueAtKeyPath({keyPath: 'arrayValue.0.name'});
			expect(value).to.equal('firstItem');
		});

		it('should work with negative array values', async () => {
			const {value} = await odc.getValueAtKeyPath({keyPath: 'arrayValue.-1.name'});
			expect(value).to.equal('lastItem');
		});
	});

	describe('getValuesAtKeyPaths', function () {
		it('should work with multiple values', async () => {
			const {subchild1, subchild2} = await odc.getValuesAtKeyPaths({requests: {
					subchild1: {base: 'scene', keyPath: 'testTarget.1.subchild1'},
					subchild2: {base: 'scene', keyPath: 'testTarget.1.1'}
				}
			});
			expect(subchild1.id).to.eq('subchild1');
			expect(subchild2.id).to.eq('subchild2');
		});
	});

	describe('getFocusedNode', function () {
		it('should return currently focused node', async () => {
			const {id} = await odc.getFocusedNode();
			expect(id).to.equal('subchild2');
		});
	});

	describe('hasFocus', function () {
		it('should return true when current node has focus', async () => {
			expect(await odc.hasFocus({base: 'scene', keyPath: 'subchild2'})).to.be.true;
		});

		it('should return false when current node does not have focus', async () => {
			expect(await odc.hasFocus({base: 'scene', keyPath: 'child1'})).to.be.false;
		});
	});

	describe('isInFocusChain', function () {
		it('should return true when current node is in focus chain', async () => {
			expect(await odc.isInFocusChain({base: 'scene', keyPath: 'child2'})).to.be.true;
		});

		it('should return false when current node is not in focus chain', async () => {
			expect(await odc.isInFocusChain({base: 'scene', keyPath: 'child1'})).to.be.false;
		});
	});

	describe('setValueAtKeyPath', function () {
		it('should be able to set a key on global', async () => {
			await setAndVerifyValue({
				keyPath: 'booleanValue',
				value: false,
				expectedStartingValue: true
			});
		});

		it('should be able set a value on a node and succeed', async () => {
			await setAndVerifyValue({
				keyPath: 'AuthManager.isLoggedIn',
				value: true,
				expectedStartingValue: false
			});
		});

		it('should be able to set a key on an AA stored on a node', async () => {
			await setAndVerifyValue({
				keyPath: 'AuthManager.profiles.profile1.settings.personalization.showContinueWatching',
				value: false,
				expectedStartingValue: true
			});
		});

		it('should be able to create a node structure', async () => {
			const nodeKey = utils.addRandomPostfix('node');

			const firstChild = {
				id: 'one'
			};

			const secondChild = {
				id: 'two'
			};

			const children = [firstChild, secondChild];

			const updateValue = {
				subtype: 'Group',
				children: children
			};

			await odc.setValueAtKeyPath({
				keyPath: nodeKey,
				value: updateValue
			});

			const {found, value} = await odc.getValueAtKeyPath({keyPath: nodeKey});
			expect(found).to.be.true;
			const childrenResult = value.children;
			expect(childrenResult.length).to.equal(children.length);

			const firstChildResult = childrenResult[0];
			expect(firstChildResult.id).to.equal(firstChild.id);

			// Check a value that wasn't in the initial to make sure it actually created a node vs an AA of the structure
			expect(firstChildResult.opacity).to.equal(1);
		});
	});

	describe('observeField', function () {
		it('should fail if given invalid keyPath', async () => {
			try {
				await odc.observeField({keyPath: 'does.not.exist'});
			} catch (e) {
				// failed as expected
				return;
			}
			assert.fail('Should have thrown an exception');
		});

		it('should succeed if given a valid node for its parent keyPath', async () => {
			const args = {keyPath: 'AuthManager.isLoggedIn'};
			await setAndVerifyValue({...args, value: false});
			const observePromise = odc.observeField(args);
			await setAndVerifyValue({...args, value: true});
			const {value, observerFired} = await observePromise;
			expect(value).to.be.true;
			expect(observerFired).to.be.true;
		});

		it('should wait for value to match if requested and should work with simple match property', async () => {
			const args = {keyPath: 'stringValue'};
			const expectedValue = utils.addRandomPostfix('secondValue');
			const observePromise = odc.observeField({...args, match: expectedValue});
			await setAndVerifyValue({...args, value: utils.addRandomPostfix('firstValue')});
			await setAndVerifyValue({...args, value: expectedValue});
			const {value, observerFired} = await observePromise;
			expect(value).to.equal(expectedValue);
			expect(observerFired).to.be.true;
		});

		it('if the match key path does not exist it should throw an error', async () => {
			const args = {keyPath: 'stringValue'};
			const observePromise = odc.observeField({...args, match: {keyPath: 'invalid.key.path', value: 'willNeverMatch'}});
			const setValuePromise = setAndVerifyValue({...args, value: utils.addRandomPostfix('trigger')});
			try {
				await Promise.all([observePromise, setValuePromise]);
			} catch (e) {
				return;
			}
			assert.fail('Should have thrown an exception');
		});

		it('it should allow match on other key paths and wait until that value matches', async () => {
			const args = {
				keyPath: 'stringValue',
				match: {
					keyPath: 'intValue',
					value: 42
				}
			};
			await setAndVerifyValue({...args.match, value: 0});
			const observePromise = odc.observeField(args);
			await setAndVerifyValue({...args, value: utils.addRandomPostfix('firstValue')});
			const expectedValue = utils.addRandomPostfix('secondValue');
			await setAndVerifyValue(args.match);
			await setAndVerifyValue({...args, value: expectedValue});
			const {value, observerFired} = await observePromise;
			expect(value).to.equal(expectedValue);
			expect(observerFired).to.be.true;
		});

		it('if a match value is provided and the value already equals what we are looking for, it should return right away', async () => {
			const args = {
				keyPath: 'stringValue',
				match: {
					keyPath: 'intValue',
					value: 42
				}
			};
			await setAndVerifyValue(args.match);
			const {observerFired} = await odc.observeField(args);
			expect(observerFired).to.be.false;
		});
	});

	describe('callFunc', function () {
		it('should fail if given invalid keyPath', async () => {
			try {
				await odc.callFunc({keyPath: 'does.not.exist',  funcName: 'trigger'});
			} catch (e) {
				// failed as expected
				return;
			}
			assert.fail('Should have thrown an exception');
		});

		it(`should work with funcs that don't take any params`, async () => {
			const args = {keyPath: 'AuthManager.isLoggedIn'};
			await setAndVerifyValue({...args, value: false});
			await odc.callFunc({keyPath: 'AuthManager', funcName: 'loginUser'});
			const {value} = await odc.getValueAtKeyPath(args);
			expect(value).to.be.true;
		});

		it('should work with funcs taking params', async () => {
			const {value} = await odc.callFunc({base: 'scene', keyPath: '', funcName: 'multiplyNumbers', funcParams: [3, 5]});
			expect(value).to.be.equal(15);
		});
	});

	async function setAndVerifyValue(args: {expectedStartingValue?: any} & ODCSetValueAtKeyPathArgs) {
		if (args.expectedStartingValue !== undefined) {
			const {value: actualStartingValue} = await odc.getValueAtKeyPath(args);
			expect(actualStartingValue).to.equal(args.expectedStartingValue, `${args.base}.${args.keyPath} did not match expected value before set`);
		}
		await odc.setValueAtKeyPath(args);
		const {value: actualValue} = await odc.getValueAtKeyPath(args);
		expect(actualValue).to.equal(args.value, `${args.base}.${args.keyPath} did not match expected value after set`);
	}
});
