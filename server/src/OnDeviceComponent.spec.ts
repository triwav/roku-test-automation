const chai = require('chai');
const assertArrays = require('chai-arrays');
chai.use(assertArrays);

const expect = chai.expect;
import * as assert from 'assert';

import { utils } from './utils';
import { ODC } from './types/OnDeviceComponentRequest';
import { ecp, odc, device } from '.';

// Used to unwrap promise return types to get the true value
type Unwrap<T> = T extends Promise<infer U> ? U : T extends (...args: any) => Promise<infer U> ? U : T extends (...args: any) => infer U ? U : T;

describe('OnDeviceComponent', function () {
	before(async () => {
		await device.deploy({rootDir: '../testProject'}, {preventMultipleDeployments: true});

		await ecp.sendLaunchChannel({skipIfAlreadyRunning: true});
	});

	describe('nodeReferences', function () {
		describe('storeNodeReferences', function () {
			let storeResult: Unwrap<typeof odc.storeNodeReferences>;
			before(async () => {
				storeResult = await odc.storeNodeReferences();
			});

			it('should have the correct fields for flatTree', async () => {
				expect(storeResult.flatTree).to.be.an('array');
				for (const tree of storeResult.flatTree) {
					expect(tree.id).to.be.string;
					expect(tree.subtype).to.be.string
					expect(tree.ref).to.be.a('number');
					expect(tree.parentRef).to.be.a('number');
				}
			});

			it('should have the correct fields for rootTree', async () => {
				expect(storeResult.rootTree).to.be.an('array');
				for (const tree of storeResult.rootTree) {
					expect(tree.id).to.be.string;
					expect(tree.subtype).to.be.string
					expect(tree.ref).to.be.a('number');
					expect(tree.parentRef).to.be.a('number');
					expect(tree.children).to.be.an('array');
				}
			});

			it('each tree should have a children array field', async () => {
				expect(storeResult.rootTree).to.be.array();
				for (const tree of storeResult.flatTree) {
					expect(tree.children).to.be.array();
				}
			});

			it('should not include node count info by default', async () => {
				expect(storeResult.totalNodes).to.not.be.ok;
				expect(storeResult.nodeCountByType).to.not.be.ok;
			});

			describe('nodeCountInfo', function () {
				before(async () => {
					storeResult = await odc.storeNodeReferences({
						includeNodeCountInfo: true
					});
				});

				it('should include node count info if requested', async () => {
					expect(storeResult.totalNodes).to.be.greaterThan(0);
					expect(Object.keys(storeResult.nodeCountByType!).length).to.be.greaterThan(0);
				});

				it('should not run array grid child finding code unless explicitly requested', async () => {
					for (const nodeTree of storeResult.flatTree) {
						expect(nodeTree.subtype).to.not.equal('RowListItem')
					}
				});
			});

			describe('arrayGridChildren', function () {
				before(async () => {
					storeResult = await odc.storeNodeReferences({
						includeArrayGridChildren: true
					});
				});

				it('should include ArrayGrid children if requested', async () => {
					let arrayGridChildrenCount = 0;
					for (const nodeTree of storeResult.flatTree) {
						if (nodeTree.subtype === 'RowListItem') {
							arrayGridChildrenCount++;
						}
					}
					expect(arrayGridChildrenCount).to.be.greaterThan(0);
				});
			});
		});

		describe('getNodeReferences', function () {
			let storeResult: Unwrap<typeof odc.storeNodeReferences>;
			before(async () => {
				storeResult = await odc.storeNodeReferences();
			});

			it('should get only the requested number of nodes with the right return types', async () => {
				const indexes = [] as number[];
				for (const index in storeResult.flatTree) {
					if (index === '12') break;
					indexes.push(+index);
				}

				const getResult = await odc.getNodeReferences({
					indexes: indexes
				});
				expect(Object.keys(getResult.nodes).length).to.equal(indexes.length);
				for (const index of indexes) {
					const node = getResult.nodes[index];
					expect(node).to.be.ok;
					expect(node.fields.id.value).to.equal(storeResult.flatTree[index].id);
					expect(node.subtype).to.equal(storeResult.flatTree[index].subtype);
				}
			});

			it('should return all values if we did not provided a list of indexes', async () => {
				const getResult = await odc.getNodeReferences({
					indexes: []
				});
				expect(Object.keys(getResult.nodes).length).to.equal(storeResult.flatTree.length);
				for (const index in storeResult.flatTree) {
					const node = getResult.nodes[index];

					expect(node).to.be.ok;
					expect(node.fields.id.value).to.equal(storeResult.flatTree[index].id);
					expect(node.subtype).to.equal(storeResult.flatTree[index].subtype);
				}
			});

			it('should include fields in the response', async () => {
				const getResult = await odc.getNodeReferences({
					indexes: [0]
				});

				const node = getResult.nodes[0];
				expect(node.subtype).to.equal("MainScene");
				expect(node.fields.visible.fieldType).to.equal("boolean");
				expect(node.fields.visible.type).to.equal("roBoolean");
				expect(node.fields.visible.value).to.equal(true);
			});
		});

		describe('deleteNodeReferences', function () {
			it('should successfully delete the node references for the default key', async () => {
				await odc.storeNodeReferences();
				await odc.deleteNodeReferences();
				try {
					await odc.getNodeReferences({
						indexes: []
					});
				} catch (e) {
					// failed as expected
					return;
				}
				assert.fail('Should have thrown an exception on the getNodeReferences if the references were removed');
			});
		});
	});

	describe('getValueAtKeyPath', function () {
		it('found should be true if key path was found and has timeTaken as a number', async () => {
			const {found, timeTaken} = await odc.getValueAtKeyPath({base: 'scene', keyPath: 'subchild3'});
			expect(found).to.be.true;
			expect(timeTaken).to.be.a('number');
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

		it('should not include children by default', async () => {
			const {value} = await odc.getValueAtKeyPath({base: 'scene', keyPath: ''});
			expect(value.children).to.be.undefined;
		});

		it('should not include children if maxChildDepth set to zero', async () => {
			const {value} = await odc.getValueAtKeyPath({base: 'scene', keyPath: '', responseMaxChildDepth: 0});
			expect(value.children).to.be.undefined;
		});

		it('should include children to specified depth', async () => {
			const {value} = await odc.getValueAtKeyPath({base: 'scene', keyPath: '', responseMaxChildDepth: 2});
			expect(value.children).to.not.be.empty;
			for (const child of value.children) {
				for (const subchild of child.children) {
					// We only requested 2 so make sure it only returned two levels
					expect(subchild.children).to.be.undefined;
				}
			}
		});

		it('should work with nodeRef base', async () => {
			const storeResult = await odc.storeNodeReferences();
			const key = 10;
			const storeNode = storeResult.flatTree[key];
			const {value} = await odc.getValueAtKeyPath({base: 'nodeRef', keyPath: `${key}`});
			expect(value.id).to.equal(storeNode.id);
			expect(value.subtype).to.equal(storeNode.subtype);
		});
	});

	describe('getValuesAtKeyPaths', function () {
		it('should work with multiple values and should return the timeTaken value', async () => {
			const {subchild1, subchild2, timeTaken} = await odc.getValuesAtKeyPaths({requests: {
					subchild1: {base: 'scene', keyPath: 'testTarget.1.subchild1'},
					subchild2: {base: 'scene', keyPath: 'testTarget.1.1'}
				}
			});
			expect(subchild1.id).to.eq('subchild1');
			expect(subchild2.id).to.eq('subchild2');
			expect(timeTaken).to.be.a('number');
		});
	});

	describe('getFocusedNode', function () {
		it('should return currently focused node', async () => {
			const {node} = await odc.getFocusedNode();
			expect(node.id).to.equal('loginButton');
		});

		it('should not include children by default', async () => {
			const {node} = await odc.getFocusedNode();
			expect(node.children).to.be.undefined;
		});

		it('should not include children if maxChildDepth set to zero', async () => {
			const {node} = await odc.getFocusedNode({responseMaxChildDepth: 0});
			expect(node.children).to.be.undefined;
		});

		it('should include children to specified depth', async () => {
			const {node} = await odc.getFocusedNode({responseMaxChildDepth: 1});
			expect(node.children).to.not.be.empty;
			for (const child of node.children) {
				// We only requested 1 so make sure it only returned a single level
				expect(child.children).to.be.undefined;
			}
		});

		it('should not include ref field by default', async () => {
			const {ref} = await odc.getFocusedNode();
			expect(ref).to.not.be.ok;
		});

		it('should fail if invalid key supplied or we did not store first', async () => {
			try {
				await odc.getFocusedNode({key: 'na', includeRef: true});
			} catch (e) {
				// failed as expected
				return;
			}
			assert.fail('Should have thrown an exception');
		});

		it('should return correct ref if requested', async () => {
			const storeResult = await odc.storeNodeReferences();
			const {node, ref} = await odc.getFocusedNode({includeRef: true});
			expect(ref).to.be.ok;
			expect(storeResult.flatTree[ref!].id).to.equal(node.id);
		});
	});

	describe('hasFocus', function () {
		it('should return true when current node has focus', async () => {
			const hasFocus = await odc.hasFocus({base: 'scene', keyPath: 'pagesContainer.loginButton'});
			expect(hasFocus).to.be.true;
		});

		it('should return false when current node does not have focus', async () => {
			expect(await odc.hasFocus({base: 'scene', keyPath: 'child1'})).to.be.false;
		});
	});

	describe('isInFocusChain', function () {
		it('should return true when current node is in focus chain', async () => {
			const isInFocusChain = await odc.isInFocusChain({base: 'scene', keyPath: 'pagesContainer.loginButton'});
			expect(isInFocusChain).to.be.true;
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

			const {found, value} = await odc.getValueAtKeyPath({keyPath: nodeKey, responseMaxChildDepth: 1});
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
				await odc.observeField({keyPath: 'does.not.exist', retryTimeout: 200});
			} catch (e) {
				// failed as expected
				return;
			}
			assert.fail('Should have thrown an exception');
		});

		it('should succeed if given a valid node for its parent keyPath and should return timeTaken value', async () => {
			const args = {keyPath: 'AuthManager.isLoggedIn'};
			await setAndVerifyValue({...args, value: false});
			const observePromise = odc.observeField(args);
			await setAndVerifyValue({...args, value: true});
			const {value, observerFired, timeTaken} = await observePromise;
			expect(value).to.be.true;
			expect(observerFired).to.be.true;
			expect(timeTaken).to.be.a('number');
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

		it('should still work after a restart of the application', async () => {
			await ecp.sendLaunchChannel({skipIfAlreadyRunning: false, launchParameters: {contentId: 'deeplink'}});
			const {observerFired} = await odc.observeField({
				keyPath: 'launchComplete'
			});
			expect(observerFired).to.be.true;
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

		it(`should inject an placeholder param to the function if no funcParams are passed`, async () => {
			const args = {keyPath: 'AuthManager.isLoggedIn'};
			await setAndVerifyValue({...args, value: false});
			await odc.callFunc({keyPath: 'AuthManager', funcName: 'loginUser'});
			const {value} = await odc.getValueAtKeyPath(args);
			expect(value).to.be.true;
		});

		it(`should work with funcs that don't take any arguments when allowWithoutArgs param is set to true`, async () => {
			const args = {keyPath: 'AuthManager.isLoggedIn'};
			await setAndVerifyValue({...args, value: false});
			await odc.callFunc({keyPath: 'AuthManager', funcName: 'loginUserNoArgs', allowWithoutArgs: true});
			const {value} = await odc.getValueAtKeyPath(args);
			expect(value).to.be.true;
		});

		it('should work with funcs taking params and has timeTaken as a number', async () => {
			const {value, timeTaken} = await odc.callFunc({base: 'scene', keyPath: '', funcName: 'multiplyNumbers', funcParams: [3, 5]});
			expect(value).to.be.equal(15);
			expect(timeTaken).to.be.a('number');
		});
	});

	describe('registry', function () {
		const firstSectionName = 'rtaFirstSectionName';
		const secondSectionName = 'rtaSecondSectionName';

		const firstKey = 'firstItem';
		const secondKey = 'secondItem';
		let firstKeyValue: string;
		let secondKeyValue: string;

		const thirdKey = 'thirdItem';
		const fourthKey = 'fourthItem';
		let thirdKeyValue: string;
		let fourthKeyValue: string;

		beforeEach(async function () {
			firstKeyValue = utils.addRandomPostfix('firstKeyValue');
			secondKeyValue = utils.addRandomPostfix('secondKeyValue');
			thirdKeyValue = utils.addRandomPostfix('thirdKeyValue');
			fourthKeyValue = utils.addRandomPostfix('fourthKeyValue');

			await odc.writeRegistry({values: {
				[firstSectionName]: {
					[firstKey]: firstKeyValue,
					[secondKey]: secondKeyValue
				},
				[secondSectionName]: {
					[thirdKey]: thirdKeyValue,
					[fourthKey]: fourthKeyValue
				}
			}});
		});

		afterEach(async function () {
			await odc.deleteRegistrySections({sections: [firstSectionName, secondSectionName]});
		});

		describe('registryRead', function () {
			it('should return all registry values if no params passed in', async () => {
				const {values} = await odc.readRegistry();

				const firstSection = values[firstSectionName];
				expect(firstSection[firstKey]).to.equal(firstKeyValue);
				expect(firstSection[secondKey]).to.equal(secondKeyValue);

				const secondSection = values[secondSectionName];
				expect(secondSection[thirdKey]).to.equal(thirdKeyValue);
				expect(secondSection[fourthKey]).to.equal(fourthKeyValue);
			});

			it('should return the requested registry values if arrays provided', async () => {
				const {values} = await odc.readRegistry({values: {
					[firstSectionName]: [secondKey],
					[secondSectionName]: [thirdKey, fourthKey]
				}});

				const firstSection = values[firstSectionName];
				expect(firstSection[firstKey]).to.be.undefined;
				expect(firstSection[secondKey]).to.equal(secondKeyValue);

				const secondSection = values[secondSectionName];
				expect(secondSection[thirdKey]).to.equal(thirdKeyValue);
				expect(secondSection[fourthKey]).to.equal(fourthKeyValue);
			});

			it('should return the requested registry value if string passed in', async () => {
				const {values} = await odc.readRegistry({values: {
					[firstSectionName]: firstKey
				}});

				const firstSection = values[firstSectionName];
				expect(firstSection[firstKey]).to.equal(firstKeyValue);
				expect(firstSection[secondKey]).to.be.undefined;

				expect(values[secondSectionName]).to.be.undefined;
			});
		});

		describe('registryWrite', function () {
			it('should successfully be able to write and delete a section field', async () => {
				await odc.writeRegistry({values: {
					[firstSectionName]: {
						[firstKey]: firstKeyValue
					}
				}});

				const {values} = await odc.readRegistry({values: {
					[firstSectionName]: firstKey
				}});
				expect(values[firstSectionName][firstKey]).to.be.equal(firstKeyValue);

				await odc.writeRegistry({values: {
					[firstSectionName]: {
						[firstKey]: null
					}
				}});

				const {values: valuesAfterDelete} = await odc.readRegistry({values: {
					[firstSectionName]: firstKey
				}});
				expect(valuesAfterDelete[firstSectionName][firstKey]).to.be.undefined;
			});
		});

		describe('deleteRegistrySections', function () {
			it('should delete all values in the specified registry section if string provided', async () => {
				await odc.deleteRegistrySections({sections: firstSectionName});
				const {values} = await odc.readRegistry({values: {
					[firstSectionName]: [],
					[secondSectionName]: []
				}});

				const firstSection = values[firstSectionName];
				expect(firstSection[firstKey]).to.be.undefined;
				expect(firstSection[secondKey]).to.be.undefined;

				const secondSection = values[secondSectionName];
				expect(secondSection[thirdKey]).to.equal(thirdKeyValue);
				expect(secondSection[fourthKey]).to.equal(fourthKeyValue);
			});

			it('should delete all values in the specified registry sections if arrays provided', async () => {
				await odc.deleteRegistrySections({sections: [firstSectionName, secondSectionName]});

				const {values} = await odc.readRegistry({values: {
					[firstSectionName]: [],
					[secondSectionName]: []
				}});

				const firstSection = values[firstSectionName];
				expect(firstSection[firstKey]).to.be.undefined;
				expect(firstSection[secondKey]).to.be.undefined;

				const secondSection = values[secondSectionName];
				expect(secondSection[thirdKey]).to.be.undefined;
				expect(secondSection[fourthKey]).to.be.undefined;
			});
		});

		describe('deleteEntireRegistry', function () {
			it('should delete all values in the specified registry section if string provided', async () => {
				await odc.deleteEntireRegistry();
				const {values} = await odc.readRegistry({values: {
					[firstSectionName]: [],
					[secondSectionName]: []
				}});

				const firstSection = values[firstSectionName];
				expect(firstSection[firstKey]).to.be.undefined;
				expect(firstSection[secondKey]).to.be.undefined;

				const secondSection = values[secondSectionName];
				expect(secondSection[thirdKey]).to.be.undefined;
				expect(secondSection[fourthKey]).to.be.undefined;
			});
		});
	});

	async function setAndVerifyValue(args: {expectedStartingValue?: any} & ODC.SetValueAtKeyPathArgs) {
		if (args.expectedStartingValue !== undefined) {
			const {value: actualStartingValue} = await odc.getValueAtKeyPath(args);
			expect(actualStartingValue).to.equal(args.expectedStartingValue, `${args.base}.${args.keyPath} did not match expected value before set`);
		}
		const { timeTaken } = await odc.setValueAtKeyPath(args);
		const {value: actualValue} = await odc.getValueAtKeyPath(args);
		expect(actualValue).to.equal(args.value, `${args.base}.${args.keyPath} did not match expected value after set`);
		expect(timeTaken).to.be.a('number', 'timeTaken was not a number when returned from setValueAtKeyPath');
	}
});
