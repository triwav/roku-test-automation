/* eslint-disable @typescript-eslint/no-non-null-assertion */
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
		await device.deploy({
			rootDir: '../testProject',
			preventMultipleDeployments: true
		});
	});

	describe('storeNodeReferences', function () {
		let storeResult: Unwrap<typeof odc.storeNodeReferences>;
		before(async () => {
			storeResult = await odc.storeNodeReferences();
		});

		it('should have the correct fields for flatTree', async () => {
			expect(storeResult.flatTree).to.be.an('array');
			for (const tree of storeResult.flatTree) {
				expect(tree.id).to.be.string;
				expect(tree.subtype).to.be.string;
				expect(tree.ref).to.be.a('number');
				expect(tree.parentRef).to.be.a('number');
			}
		});

		it('should have the correct fields for rootTree', async () => {
			expect(storeResult.rootTree).to.be.an('array');
			for (const tree of storeResult.rootTree) {
				expect(tree.id).to.be.string;
				expect(tree.subtype).to.be.string;
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
					expect(nodeTree.subtype).to.not.equal('RowListItem');
				}
			});
		});

		describe('arrayGridChildren', function () {
			before(async () => {
				storeResult = await odc.storeNodeReferences({
					includeArrayGridChildren: true
				});
			});

			it('should include ArrayGrid children if requested', () => {
				let arrayGridChildrenCount = 0;
				for (const nodeTree of storeResult.flatTree) {
					if (nodeTree.subtype === 'RowListItem') {
						arrayGridChildrenCount++;
					}
				}
				expect(arrayGridChildrenCount).to.be.greaterThan(0);
			});

			it('should be able to pull ArrayGrid children for an itemComponent even if it did not have a parent and did not have enough items to have an itemComponent in the same row that had a parent as long as we have a rowTitleComponent', () => {
				let rowListWithCustomTitleComponentNodeTree: ODC.NodeTree | undefined = undefined;
				for (const nodeTree of storeResult.flatTree) {
					if (nodeTree.id === 'rowListWithCustomTitleComponent') {
						rowListWithCustomTitleComponentNodeTree = nodeTree;
					}
				}
				expect(rowListWithCustomTitleComponentNodeTree).to.be.ok;
				const markupGrid = rowListWithCustomTitleComponentNodeTree?.children[0].children[1];
				expect(markupGrid?.subtype).to.equal('MarkupGrid');
				expect(markupGrid?.children.length).to.equal(1);
				expect(markupGrid?.children[0].subtype).to.equal('RowListItemComponent');
			});
		});
	});

	describe('getNodesInfo', function () {
		let storeResult: Unwrap<typeof odc.storeNodeReferences>;
		before(async () => {
			storeResult = await odc.storeNodeReferences();
		});

		it('should get only the requested number of nodes with the right return types', async () => {
			const requests = {} as {
				[key: string]: ODC.GetValueArgs
			};
			for (const index in storeResult.flatTree) {
				if (index === '12') break;
				requests[index] = {
					base: 'nodeRef',
					keyPath: index
				};
			}

			const {results} = await odc.getNodesInfo({
				requests: requests
			});
			expect(Object.keys(results).length).to.equal(Object.keys(requests).length);
			for (const key in results) {
				const node = results[key];
				expect(node).to.be.ok;
				expect(node.fields.id.value).to.equal(storeResult.flatTree[key].id);
				expect(node.subtype).to.equal(storeResult.flatTree[key].subtype);
			}
		});

		it('should include fields in the response', async () => {
			const {results} = await odc.getNodesInfo({
				requests: {
					firstItem: {
						base: 'nodeRef',
						keyPath: '0'
					}
				}
			});

			const node = results.firstItem;
			expect(node.subtype).to.equal('MainScene');
			expect(node.fields.visible.fieldType).to.equal('boolean');
			expect(node.fields.visible.type).to.equal('roBoolean');
			expect(node.fields.visible.value).to.equal(true);
		});

		it('should include children array with each child node subtype', async () => {
			const {results} = await odc.getNodesInfo({
				requests: {
					firstItem: {
						base: 'nodeRef',
						keyPath: '0'
					}
				}
			});

			const node = results.firstItem;
			const expectedSubtypes = [
				'Poster',
				'Poster',
				'Group'
			];
			for (const child of node.children) {
				expect(child.subtype).to.equal(expectedSubtypes.shift());
			}
		});

		it('should fail if we try to access a non-node keyPath', async () => {
			try {
				await odc.getNodesInfo({
					requests: {
						firstItem: {
							base: 'global',
							keyPath: 'booleanValue'
						}
					}
				});
			} catch (e) {
				// failed as expected
				return;
			}
			assert.fail('Should have thrown an exception getting boolean value');
		});
	});

	describe('deleteNodeReferences', function () {
		it('should successfully delete the node references for the default key', async () => {
			await odc.storeNodeReferences();
			await odc.deleteNodeReferences();
			try {
				await odc.getNodesInfo({
					requests: {
						firstItem: {
							keyPath: '0'
						}
					}
				});
			} catch (e) {
				// failed as expected
				return;
			}
			assert.fail('Should have thrown an exception on the getNodesInfo if the references were removed');
		});
	});

	describe('getNodesWithProperties', function () {
		before(async () => {
			await odc.storeNodeReferences({includeArrayGridChildren: true});
		});

		it('should be able to work with a single field with no operator specified and return the correct response', async () => {
			const fieldValue = true;
			const fieldName = 'myCustomBooleanField';

			await setAndVerifyValue({
				base: 'scene',
				keyPath: `pagesContainer.0.${fieldName}`,
				value: fieldValue
			});

			const {nodes, nodeRefs} = await odc.getNodesWithProperties({
				properties: [{
					field: fieldName,
					value: fieldValue
				}]
			});

			expect(nodes.length).to.equal(1);
			expect(nodeRefs.length).to.equal(1);
			const node = nodes[0];
			expect(node.subtype).to.equal('LandingPage');
			expect(node[fieldName]).to.equal(fieldValue);
		});

		it('should be able to work with a multiple fields with operator specified and return the correct node response', async () => {
			const fieldValue = utils.addRandomPostfix('myCustomStringFieldValue');
			const fieldName = 'myCustomStringField';
			await setAndVerifyValue({
				base: 'scene',
				keyPath: `pagesContainer.0.${fieldName}`,
				value: fieldValue + 'ExtraToTestInWorksCorrect'
			});

			const {nodes} = await odc.getNodesWithProperties({
				properties: [{
					fields: ['renderTracking', fieldName],
					operator: 'in',
					value: fieldValue
				}]
			});

			expect(nodes.length).to.equal(1);
			const node = nodes[0];
			expect(node.subtype).to.equal('LandingPage');
			expect(node[fieldName]).to.contain(fieldValue);
		});

		it('If only one property matches then the node should not be returned', async () => {
			const fieldValue = utils.addRandomPostfix('myCustomStringFieldValue');
			const fieldName = 'myCustomStringField';

			const {nodes} = await odc.getNodesWithProperties({
				properties: [{
					field: 'visible',
					value: false
				},
				{
					fields: ['renderTracking', fieldName],
					operator: 'in',
					value: fieldValue
				}]
			});

			expect(nodes.length).to.equal(0);
		});

		it('If wrong value type for operator we should throw an error', async () => {
			try {
				const fieldName = 'myCustomStringField';

				const result = await odc.getNodesWithProperties({
					properties: [{
						field: fieldName,
						operator: '>=',
						value: ''
					}]
				});
			} catch (e) {
				// failed as expected
				return;
			}
			assert.fail('Should have thrown an exception');
		});

		it('should be able to run all the same advanced functionality as we can on a keyPath in getValue if we set a keyPath', async () => {
			// Only return nodes whose width is 42
			const {nodes} = await odc.getNodesWithProperties({
				properties: [{
					keyPath: 'boundingRect().width',
					operator: '=',
					value: 42
				}]
			});

			expect(nodes.length).to.equal(1);
			const node = nodes[0];
			expect(node.subtype).to.equal('Poster');
			expect(node.id).to.equal('poster');
		});

	});

	describe('ResponsivenessTesting', function () {
		it('should fail to get data if we have not started responsiveness testing yet', async () => {
			try {
				await odc.getResponsivenessTestingData();
			} catch (e) {
				// failed as expected
				return;
			}
			assert.fail('Should have thrown an exception');
		});

		it('should use our passed in params if provided', async () => {
			const periodTickCount = 10;
			const tickDuration = 1;
			const periodsTrackCount = 2;
			await odc.startResponsivenessTesting({
				periodTickCount: periodTickCount,
				tickDuration: tickDuration,
				periodsTrackCount: periodsTrackCount
			});
			const response = await odc.getResponsivenessTestingData();
			await odc.stopResponsivenessTesting();
			expect(response.periodTickCount).to.equal(periodTickCount);
			expect(response.tickDuration).to.equal(tickDuration);
			expect(response.periodsTrackCount).to.equal(periodsTrackCount);
		});

		it('should return an empty array response if we have not finished a period yet but still give total counts', async () => {
			const periodTickCount = 5000;
			const tickDuration = 1;
			await odc.startResponsivenessTesting({
				periodTickCount: periodTickCount,
				tickDuration: tickDuration
			});
			await utils.sleep(50);
			const {periods, testingTotals} = await odc.getResponsivenessTestingData();
			await odc.stopResponsivenessTesting();
			expect(periods).to.be.an('array');
			expect(periods.length).to.equal(0);
			expect(testingTotals.duration).to.be.a('number');
			expect(testingTotals.tickCount).to.be.a('number');
			expect(testingTotals.percent).to.be.a('number');
		});

		it('should return a proper response if enough time has passed for periods to be set', async () => {
			const periodTickCount = 5;
			const tickDuration = 1;
			const periodsTrackCount = 2;
			await odc.startResponsivenessTesting({
				periodTickCount: periodTickCount,
				tickDuration: tickDuration,
				periodsTrackCount: periodsTrackCount
			});
			await utils.sleep(50);
			const {periods, testingTotals} = await odc.getResponsivenessTestingData();
			await odc.stopResponsivenessTesting();
			expect(periods).to.be.an('array');
			expect(periods.length).to.equal(periodsTrackCount);
			expect(periods[0].percent).to.be.a('number');
			expect(testingTotals.duration).to.be.a('number');
			expect(testingTotals.tickCount).to.be.a('number');
			expect(testingTotals.percent).to.be.a('number');
		});
	});

	describe('disableScreenSaver', function () {
		it('should work disabling', async () => {
			await odc.disableScreenSaver({disableScreensaver: true});
		});

		it('should work reenabling', async () => {
			await odc.disableScreenSaver({disableScreensaver: false});
		});
	});

	describe('getValue', function () {
		it('found should be true if key path was found and has timeTaken as a number', async () => {
			const {found, timeTaken} = await odc.getValue({base: 'scene', keyPath: 'subchild3'});
			expect(found).to.be.true;
			expect(timeTaken).to.be.a('number');
		});

		it('found should be false if key path was not found', async () => {
			const {found} = await odc.getValue({keyPath: 'invalid'});
			expect(found).to.be.false;
		});

		it('should work with findnode', async () => {
			const {value} = await odc.getValue({base: 'scene', keyPath: 'subchild3'});
			expect(value.id).to.eq('subchild3');
		});

		it('should not find a child if it is not beneath the parent node', async () => {
			const {value} = await odc.getValue({base: 'scene', keyPath: 'subchild3.testTarget'});
			expect(value?.id).to.be.undefined;
		});

		it('should work with findNode.getChild', async () => {
			const {value} = await odc.getValue({base: 'scene', keyPath: 'testTarget.0'});
			expect(value.id).to.eq('child1');
		});

		it('should work with findNode.getChild.getChild', async () => {
			const {value} = await odc.getValue({base: 'scene', keyPath: 'testTarget.1.1'});
			expect(value.id).to.eq('subchild2');
		});

		it('should work with findNode.getChild.findNode', async () => {
			const {value} = await odc.getValue({base: 'scene', keyPath: 'testTarget.1.subchild1'});
			expect(value.id).to.eq('subchild1');
		});

		it('should be able to get a value on a valid field', async () => {
			const {value} = await odc.getValue({keyPath: 'AuthManager.isLoggedIn'});
			expect(value).to.be.false;
		});

		it('should work with array values', async () => {
			const {value} = await odc.getValue({keyPath: 'arrayValue.0.name'});
			expect(value).to.equal('firstItem');
		});

		it('should work with negative array values', async () => {
			const {value} = await odc.getValue({keyPath: 'arrayValue.-1.name'});
			expect(value).to.equal('lastItem');
		});

		it('should not include children by default', async () => {
			const {value} = await odc.getValue({base: 'scene', keyPath: ''});
			expect(value.children).to.be.undefined;
		});

		it('should not include children if maxChildDepth set to zero', async () => {
			const {value} = await odc.getValue({base: 'scene', keyPath: '', responseMaxChildDepth: 0});
			expect(value.children).to.be.undefined;
		});

		it('should include children to specified depth', async () => {
			const {value} = await odc.getValue({base: 'scene', keyPath: '', responseMaxChildDepth: 2});
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
			const {value} = await odc.getValue({base: 'nodeRef', keyPath: `${key}`});
			expect(value.id).to.equal(storeNode.id);
			expect(value.subtype).to.equal(storeNode.subtype);
		});

		describe('Brightscript interface function calls', function () {
			describe('getParent()', async () => {
				it('should work on node item', async () => {
					const {value} = await odc.getValue({base: 'scene', keyPath: 'poster.getParent()'});
					expect(value.subtype).to.equal('MainScene');
				});

				it('should gracefully fallback if called on nonsupported type', async () => {
					const {found} = await odc.getValue({keyPath: 'intValue.getParent()'});
					expect(found).to.false;
				});
			});

			describe('count()', async () => {
				it('should work on array item', async () => {
					const {value} = await odc.getValue({keyPath: 'arrayValue.count()'});
					expect(value).to.equal(3);
				});

				it('should work on AA item', async () => {
					const {value} = await odc.getValue({keyPath: 'arrayValue.0.count()'});
					expect(value).to.equal(1);
				});

				it('should work on node item', async () => {
					const {value} = await odc.getValue({keyPath: 'AuthManager.count()'});
					expect(value).to.equal(6);
				});

				it('should gracefully fallback if called on nonsupported type', async () => {
					const {found} = await odc.getValue({keyPath: 'intValue.count()'});
					expect(found).to.false;
				});
			});

			describe('keys()', async () => {
				it('should work on AA item', async () => {
					const {value} = await odc.getValue({keyPath: 'arrayValue.0.keys()'});
					expect(value).to.be.instanceof(Array);
					expect(value[0]).to.equal('name');
				});

				it('should work on node item', async () => {
					const {value} = await odc.getValue({keyPath: 'AuthManager.keys()'});
					expect(value).to.be.instanceof(Array);
					expect(value[0]).to.equal('change');
				});

				it('should gracefully fallback if called on nonsupported type', async () => {
					const {found} = await odc.getValue({keyPath: 'intValue.keys()'});
					expect(found).to.false;
				});
			});

			describe('len()', async () => {
				it('should work on string item', async () => {
					const {value} = await odc.getValue({keyPath: 'stringValue.len()'});
					expect(value).to.equal(11);
				});

				it('should gracefully fallback if called on nonsupported type', async () => {
					const {found} = await odc.getValue({keyPath: 'intValue.len()'});
					expect(found).to.false;
				});
			});

			describe('getChildCount()', async () => {
				it('should work on node item', async () => {
					const {value} = await odc.getValue({base: 'scene', keyPath: 'getChildCount()'});
					expect(value).to.equal(3);
				});

				it('should gracefully fallback if called on nonsupported type', async () => {
					const {found} = await odc.getValue({keyPath: 'intValue.getChildCount()'});
					expect(found).to.false;
				});
			});

			describe('threadinfo()', async () => {
				it('should work on node item', async () => {
					const {value} = await odc.getValue({base: 'scene', keyPath: 'threadinfo()'});
					const currentThread = value.currentThread;
					expect(currentThread.name).to.equal('MainScene');
					expect(currentThread.type).to.equal('Render');
				});

				it('should gracefully fallback if called on nonsupported type', async () => {
					const {found} = await odc.getValue({keyPath: 'intValue.threadinfo()'});
					expect(found).to.false;
				});
			});

			describe('getFieldTypes()', async () => {
				it('should work on node item', async () => {
					const {value} = await odc.getValue({base: 'scene', keyPath: 'getFieldTypes()'});
					const expectedValues = {
						allowBackgroundTask:'boolean',
						backExitsScene:'boolean',
						backgroundColor:'color',
						backgroundUri:'uri',
						change:'string',
						childRenderOrder:'string',
						clippingRect:'rect2d',
						currentDesignResolution:'std::shared_ptr<std::map<std::__cxx11::basic_string<char, std::char_traits<char>, std::allocator<char> >, std::any, std::less<std::__cxx11::basic_string<char, std::char_traits<char>, std::allocator<char> > >, std::allocator<std::pair<std::__cxx11::basic_string<char, std::char_traits<char>, std::allocator<char> > const, std::any> > > >',
						dialog:'std::shared_ptr<Roku::SceneGraph::DialogBase>',
						enableRenderTracking:'boolean',
						focusable:'boolean',
						focusedChild:'node',
						id:'string',
						inheritParentOpacity:'boolean',
						inheritParentTransform:'boolean',
						limitBackgroundToUIResolution:'boolean',
						muteAudioGuide:'boolean',
						opacity:'float',
						pagesContainer:'node',
						palette:'std::shared_ptr<Roku::SceneGraph::RSGPalette>',
						renderPass:'integer',
						renderTracking:'string',
						rotation:'float',
						scale:'vector2d',
						scaleRotateCenter:'vector2d',
						translation:'vector2d',
						visible:'boolean'
					};
					expect(Object.keys(value).length).to.equal(Object.keys(expectedValues).length);
					for (const key in expectedValues) {
						expect(value[key]).to.equal(expectedValues[key]);
					}
				});

				it('should gracefully fallback if called on nonsupported type', async () => {
					const {found} = await odc.getValue({keyPath: 'intValue.getFieldTypes()'});
					expect(found).to.false;
				});
			});

			describe('subtype()', async () => {
				it('should work on node item', async () => {
					const {value} = await odc.getValue({base: 'scene', keyPath: 'rowListWithCustomTitleComponent.subtype()'});
					expect(value).to.equal('RowList');
				});

				it('should gracefully fallback if called on nonsupported type', async () => {
					const {found} = await odc.getValue({keyPath: 'intValue.subtype()'});
					expect(found).to.false;
				});
			});

			describe('boundingRect()', async () => {
				it('should work on node item', async () => {
					const {value} = await odc.getValue({base: 'scene', keyPath: 'rowListWithCustomTitleComponent.boundingRect()'});
					expect(value.height).to.equal(438);
					expect(value.width).to.equal(1958);
					expect(value.x).to.equal(131);
					expect(value.y).to.equal(681);
				});

				it('should gracefully fallback if called on nonsupported type', async () => {
					const {found} = await odc.getValue({keyPath: 'intValue.boundingRect()'});
					expect(found).to.false;
				});
			});

			describe('localBoundingRect()', async () => {
				it('should work on node item', async () => {
					const {value} = await odc.getValue({base: 'scene', keyPath: 'rowListWithCustomTitleComponent.localBoundingRect()'});
					expect(value.height).to.equal(438);
					expect(value.width).to.equal(1958);
					expect(value.x).to.equal(-19);
					expect(value.y).to.equal(-19);
				});

				it('should gracefully fallback if called on nonsupported type', async () => {
					const {found} = await odc.getValue({keyPath: 'intValue.localBoundingRect()'});
					expect(found).to.false;
				});
			});

			describe('sceneBoundingRect()', async () => {
				it('should work on node item', async () => {
					const {value} = await odc.getValue({base: 'scene', keyPath: 'rowListWithCustomTitleComponent.sceneBoundingRect()'});
					expect(value.height).to.equal(438);
					expect(value.width).to.equal(1958);
					expect(value.x).to.equal(131);
					expect(value.y).to.equal(681);
				});

				it('should gracefully fallback if called on nonsupported type', async () => {
					const {found} = await odc.getValue({keyPath: 'intValue.sceneBoundingRect()'});
					expect(found).to.false;
				});
			});
		});
	});

	describe('getValues', function () {
		it('should work with multiple values and should return the timeTaken value', async () => {
			const {results, timeTaken} = await odc.getValues({requests: {
					subchild1: {base: 'scene', keyPath: 'testTarget.1.subchild1'},
					subchild2: {base: 'scene', keyPath: 'testTarget.1.1'}
				}
			});
			expect(results.subchild1.value.id).to.eq('subchild1');
			expect(results.subchild2.value.id).to.eq('subchild2');
			expect(timeTaken).to.be.a('number');
		});
	});

	describe('getFocusedNode', function () {
		it('should return currently focused node', async () => {
			await odc.focusNode({
				base: 'scene',
				keyPath: 'pagesContainer.loginButton'
			});
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
			expect(storeResult.flatTree[ref!].subtype).to.equal(node.subtype);
			expect(storeResult.flatTree[ref!].id).to.equal(node.id);
		});

		it('should return focused arrayGrid child if requested', async () => {
			const storeResult = await odc.storeNodeReferences({includeArrayGridChildren: true});
			await odc.focusNode({
				base: 'scene',
				keyPath: 'rowListWithCustomTitleComponent'
			});
			const {node, ref} = await odc.getFocusedNode({
				includeRef: true,
				returnFocusedArrayGridChild: true
			});
			expect(ref).to.be.ok;
			expect(storeResult.flatTree[ref!].subtype).to.equal(node.subtype);
			expect(node.itemContent.id).to.equal('row 0  item 0');

			// Reset back to login button for focus
			await odc.focusNode({
				base: 'scene',
				keyPath: 'pagesContainer.loginButton'
			});
		});
	});

	describe('hasFocus', function () {
		it('should return true when current node has focus', async () => {
			const args: ODC.FocusNodeArgs = {base: 'scene', keyPath: 'pagesContainer.loginButton'};
			await odc.focusNode(args);
			const hasFocus = await odc.hasFocus(args);
			expect(hasFocus).to.be.true;
		});

		it('should return false when current node does not have focus', async () => {
			expect(await odc.hasFocus({base: 'scene', keyPath: 'child1'})).to.be.false;
		});
	});

	describe('isInFocusChain', function () {
		it('should return true when current node is in focus chain', async () => {
			const args: ODC.FocusNodeArgs = {base: 'scene', keyPath: 'pagesContainer.loginButton'};
			await odc.focusNode(args);
			const isInFocusChain = await odc.isInFocusChain(args);
			expect(isInFocusChain).to.be.true;
		});

		it('should return false when current node is not in focus chain', async () => {
			expect(await odc.isInFocusChain({base: 'scene', keyPath: 'child1'})).to.be.false;
		});
	});

	describe('focusNode', function () {
		it('should successfully set focus on the requested node', async () => {
			const args: ODC.FocusNodeArgs = {base: 'scene', keyPath: 'pagesContainer'};
			await odc.focusNode(args);
			const hasFocus = await odc.hasFocus(args);
			expect(hasFocus).to.be.true;
		});

		it('should return an error when keypath does not point to a node', async () => {
			try {
				await odc.focusNode({base: 'scene', keyPath: 'stringValue'});
			} catch(e) {
				// failed as expected
				return;
			}
			assert.fail('Should have thrown an exception');
		});
	});

	describe('setValue', function () {
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

			await odc.setValue({
				keyPath: nodeKey,
				value: updateValue
			});

			const {found, value} = await odc.getValue({keyPath: nodeKey, responseMaxChildDepth: 1});
			expect(found).to.be.true;
			const childrenResult = value.children;
			expect(childrenResult.length).to.equal(children.length);

			const firstChildResult = childrenResult[0];
			expect(firstChildResult.id).to.equal(firstChild.id);

			// Check a value that wasn't in the initial to make sure it actually created a node vs an AA of the structure
			expect(firstChildResult.opacity).to.equal(1);
		});

		it('should be able to add a child node to scene', async () => {
			const nodeKey = utils.addRandomPostfix('node');

			const updateValue = {
				children: [{
					subtype: 'Group',
					id: nodeKey
				}]
			};

			await odc.setValue({
				base: 'scene',
				keyPath: '',
				value: updateValue
			});

			const {value} = await odc.getValue({base: 'scene', keyPath: '', responseMaxChildDepth: 1});

			const lastNode = value.children.pop();
			expect(lastNode.id).to.equal(nodeKey);
		});

		it('should be able to add a childnode to an existing node', async () => {
			const nodeKey = utils.addRandomPostfix('node');

			const updateValue = {
				children: [{
					subtype: 'Group',
					id: nodeKey
				}]
			};

			await odc.setValue({
				base: 'scene',
				keyPath: 'pagesContainer',
				field: '',
				value: updateValue
			});

			const {value} = await odc.getValue({base: 'scene', keyPath: 'pagesContainer', responseMaxChildDepth: 1});

			const lastNode = value.children.pop();
			expect(lastNode.id).to.equal(nodeKey);
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
			const observePromise = odc.observeField({...args});
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
			await ecp.sendLaunchChannel({
				skipIfAlreadyRunning: false,
				launchParameters: {contentId: 'deeplink'},
				verifyLaunch: false
			});
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

		it(`should work with funcs that don't take any arguments`, async () => {
			const args = {keyPath: 'AuthManager.isLoggedIn'};
			await setAndVerifyValue({...args, value: false});
			await odc.callFunc({keyPath: 'AuthManager', funcName: 'loginUserNoArgs'});
			const {value} = await odc.getValue(args);
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
			await odc.deleteEntireRegistry();
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

		describe('restoreRegistry', function () {
			it('should properly restore if configured to do so', async () => {
				(odc as any).config.OnDeviceComponent.restoreRegistry = true;
				// This also triggers storing of the current values first
				await odc.deleteEntireRegistry();
				await odc.shutdown();
				(odc as any).config.OnDeviceComponent.restoreRegistry = false;
				const {values} = await odc.readRegistry();
				expect(values.rtaFirstSectionName.firstItem).to.equal(firstKeyValue);
				expect(values.rtaFirstSectionName.secondItem).to.equal(secondKeyValue);
				expect(values.rtaSecondSectionName.thirdItem).to.equal(thirdKeyValue);
				expect(values.rtaSecondSectionName.fourthItem).to.equal(fourthKeyValue);
			});
		});
	});

	describe('fileSystem', function () {
		const standardVolumes = ['cachefs:', 'common:', 'pkg:', 'tmp:'];

		describe('getVolumeList', function () {
			it('should contain the standard list of volumes expected', async () => {
				const {list} = await odc.getVolumeList();

				for (const volume of standardVolumes) {
					expect(list.includes(volume), `list did not contain '${volume}'`).to.be.true;
				}
			});
		});

		describe('getDirectoryListing', function () {
			it('should return a list of files for the selected directories', async () => {
				let pathsReturned = 0;
				for (const volume of standardVolumes) {
					const {list} = await odc.getDirectoryListing({
						path: volume + '/'
					});
					pathsReturned += list.length;
				}
				expect(pathsReturned).to.be.greaterThan(0);
			});
		});

		describe('stat', function () {
			it('should return correct info for a directory', async () => {
				const fileInfo = await odc.statPath({
					path: 'common:/certs'
				});
				expect(fileInfo.type).to.equal('directory');
				expect(fileInfo.hidden).to.be.false;
				expect(fileInfo.size).to.be.undefined;
				expect(fileInfo.permissions).to.equal('rw');
			});

			it('should return correct info for a file', async () => {
				const fileInfo = await odc.statPath({
					path: 'common:/certs/ca-bundle.crt'
				});
				expect(fileInfo.type).to.equal('file');
				expect(fileInfo.hidden).to.be.false;
				expect(fileInfo.size).to.be.greaterThan(0);
				expect(fileInfo.permissions).to.equal('rw');
			});

			it('should throw an error for a file that does not exist', async () => {
				try {
					await odc.statPath({
						path: 'common:/does_not_exist'
					});
				} catch (e) {
					// failed as expected
					return;
				}
				assert.fail('Should have thrown an exception');
			});
		});

		describe('createDirectory', function () {
			it('should successfully make a directory if on a writable volume', async () => {
				const path = 'tmp:/super_secret';
				await odc.createDirectory({
					path: path
				});
				const {type} = await odc.statPath({
					path: path
				});
				expect(type).to.equal('directory');
			});

			it('should error out if we try to make a directory on a read only volume', async () => {
				try {
					await odc.createDirectory({
						path: 'common:/super_secret'
					});
				} catch (e) {
					// failed as expected
					return;
				}
				assert.fail('Should have thrown an exception');
			});
		});

		describe('delete', function () {
			it('should successfully make a directory if on a writable volume', async () => {
				try {
					await odc.deleteFile({
						path: 'common:/certs/ca-bundle.crt'
					});
				} catch (e) {
					// failed as expected
					return;
				}
				assert.fail('Should have thrown an exception');
			});
		});
	});

	describe('readFile', function () {
		it('successfully reads a known file', async () => {
			const {binaryPayload} = await odc.readFile({
				path: 'common:/certs/ca-bundle.crt'
			});
			expect(binaryPayload.length).to.be.greaterThan(0);
		});

		it('throws an error on non existant file', async () => {
			try {
				await odc.readFile({
					path: 'common:/does_not_exist'
				});
			} catch (e) {
				// failed as expected
				return;
			}
			assert.fail('Should have thrown an exception reading nonexistant file');
		});
	});

	describe('writeFile', function () {
		it('successfully writes to a writable volume', async () => {
			const writeFilePath = 'tmp:/test.txt';
			const expectedBinaryPayload = Buffer.from(utils.randomStringGenerator(32));
			await odc.writeFile({
				path: writeFilePath,
				binaryPayload: expectedBinaryPayload
			});

			const {binaryPayload: actualBinaryPayload} = await odc.readFile({
				path: writeFilePath
			});

			expect(actualBinaryPayload.toString()).to.equal(expectedBinaryPayload.toString());
		});

		it('throws an error on read only volumes', async () => {
			const writeFilePath = 'pkg:/sorry_read_only';
			const expectedBinaryPayload = Buffer.from(utils.randomStringGenerator(32));

			try {
				await odc.writeFile({
					path: writeFilePath,
					binaryPayload: expectedBinaryPayload
				});
			} catch (e) {
				// failed as expected
				return;
			}
			assert.fail('Should have thrown an exception trying to write to a read only volume');
		});
	});

	async function setAndVerifyValue(args: {expectedStartingValue?: any} & ODC.SetValueArgs) {
		if (args.expectedStartingValue !== undefined) {
			const {value: actualStartingValue} = await odc.getValue(args);
			expect(actualStartingValue).to.equal(args.expectedStartingValue, `${args.base}.${args.keyPath} did not match expected value before set`);
		}
		const { timeTaken } = await odc.setValue(args);
		const {value: actualValue} = await odc.getValue(args);
		expect(actualValue).to.equal(args.value, `${args.base}.${args.keyPath} did not match expected value after set`);
		expect(timeTaken).to.be.a('number', 'timeTaken was not a number when returned from setValue');
	}
});
