/* eslint-disable @typescript-eslint/no-non-null-assertion */
const chai = require('chai');
const assertArrays = require('chai-arrays');
chai.use(assertArrays);

const expect = chai.expect;
import * as assert from 'assert';

import { utils } from './utils';
import type * as ODC from './types/OnDeviceComponent';
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

	describe('getAllCount', function () {
		it('should have the correct fields and return a known node subtype', async () => {
			const { totalNodes, nodeCountByType } = await odc.getAllCount();
			expect(totalNodes).to.be.greaterThan(0);
			expect(nodeCountByType['MainScene']).to.equal(1);
			for (const nodeSubtype in nodeCountByType) {
				expect(nodeCountByType[nodeSubtype]).to.be.greaterThan(0);
			}
		});
	});

	describe('getRootsCount', function () {
		it('should have the correct fields and return a known node subtype', async () => {
			const { totalNodes, nodeCountByType } = await odc.getRootsCount();
			expect(totalNodes).to.be.greaterThan(0);
			expect(nodeCountByType['MainScene']).to.equal(1);
			for (const nodeSubtype in nodeCountByType) {
				expect(nodeCountByType[nodeSubtype]).to.be.greaterThan(0);
			}
		});
	});

	describe('storeNodeReferences', function () {
		let storeResult: Unwrap<typeof odc.storeNodeReferences>;
		before(async () => {
			storeResult = await odc.storeNodeReferences();
		});

		it('should have the correct fields for flatTree', () => {
			expect(storeResult.flatTree).to.be.an('array');
			for (const tree of storeResult.flatTree) {
				expect(tree.subtype).to.be.a.string;
				expect(tree.id).to.be.a.string;
				if (tree.id !== 'animation') {
					expect(tree.visible).to.be.a('boolean');
					expect(tree.opacity).to.be.a('number');
					expect(tree.translation).to.be.an('array');
				}
				expect(tree.id).to.be.string;
				expect(tree.ref).to.be.a('number');
				expect(tree.parentRef).to.be.a('number');
			}
		});

		it('should have the correct fields for rootTree', () => {
			expect(storeResult.rootTree).to.be.an('array');
			const tree = storeResult.rootTree[0];

			expect(tree.subtype).to.be.a.string;
			expect(tree.id).to.be.a.string;
			expect(tree.visible).to.be.a('boolean');
			expect(tree.opacity).to.be.a('number');
			expect(tree.translation).to.be.an('array');
			expect(tree.ref).to.be.a('number');
			expect(tree.parentRef).to.be.a('number');
			expect(tree.children).to.be.an('array');
		});

		it('each tree should have a children array field', () => {
			expect(storeResult.rootTree).to.be.array();
			for (const tree of storeResult.flatTree) {
				expect(tree.children).to.be.array();
			}
		});

		it('should not include node count info by default', () => {
			expect(storeResult.totalNodes).to.not.be.ok;
			expect(storeResult.nodeCountByType).to.not.be.ok;
		});

		it('should include correct keyPaths for both findNode and index based key paths', () => {
			expect(storeResult.rootTree[0].children[5].keyPath).to.equal('#pagesContainerGroup');
			expect(storeResult.rootTree[0].children[5].children[0].keyPath).to.equal('#pagesContainerGroup.0');
		});

		describe('includeNodeCountInfo', function () {
			before(async () => {
				storeResult = await odc.storeNodeReferences({
					includeNodeCountInfo: true
				});
			});

			it('should include node count info if requested', () => {
				expect(storeResult.totalNodes).to.be.greaterThan(0);
				expect(Object.keys(storeResult.nodeCountByType!).length).to.be.greaterThan(0);
			});

			it('should not run array grid child finding code unless explicitly requested', () => {
				for (const nodeTree of storeResult.flatTree) {
					expect(nodeTree.subtype).to.not.equal('RowListItem');
				}
			});
		});

		describe('includeArrayGridChildren', function () {
			before(async () => {
				storeResult = await odc.storeNodeReferences({
					includeArrayGridChildren: true
				});
			});

			it('should include ArrayGrid children and keyPaths if requested', () => {
				let arrayGridChildrenCount = 0;
				for (const nodeTree of storeResult.flatTree) {
					if (nodeTree.parentRef === -1) {
						continue;
					}

					if (nodeTree.subtype === 'RowListItem') {
						arrayGridChildrenCount++;
					} else if (nodeTree.subtype === 'RowListItemComponent') {
						expect(nodeTree.keyPath.endsWith(`items.${nodeTree.position}`)).to.be.true;
					} else if (nodeTree.subtype === 'RowListRowTitleComponent') {
						expect(nodeTree.keyPath.endsWith(`title`)).to.be.true;
					}
				}
				expect(arrayGridChildrenCount).to.be.greaterThan(0);
			});

			it('should be able to pull ArrayGrid children for an itemComponent even if it did not have a parent and did not have enough items to have an itemComponent in the same row that had a parent as long as we have a rowTitleComponent', () => {
				let rowListWithCustomTitleComponentNodeTree: ODC.TreeNode | undefined = undefined;
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

		describe('includeBoundingRectInfo', function () {
			before(async () => {
				storeResult = await odc.storeNodeReferences({
					includeBoundingRectInfo: true
				});
			});

			it('should include boundingRect info if requested and node extends from group', () => {
				for (const nodeTree of storeResult.flatTree) {
					if (nodeTree.id === 'animation') {
						expect(nodeTree.sceneRect).to.be.undefined;
					} else {
						expect(nodeTree.sceneRect).to.not.be.undefined;
					}
				}
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

			const { results } = await odc.getNodesInfo({
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
			const { results } = await odc.getNodesInfo({
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
			expect(node.fields.visible.value).to.be.true;
		});

		it('should include children array with each child node subtype', async () => {
			const { results } = await odc.getNodesInfo({
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
				'Rectangle',
				'Animation',
				'Group',
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
							base: 'nodeRef',
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
			await odc.storeNodeReferences({ includeArrayGridChildren: true });
		});

		it('should be able to work with a single field with no operator specified and return the correct response', async () => {
			const fieldValue = true;
			const fieldName = 'myCustomBooleanField';

			await setAndVerifyValue({
				keyPath: `pagesContainer.0.${fieldName}`,
				value: fieldValue
			});

			const { nodes, nodeRefs } = await odc.getNodesWithProperties({
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
				keyPath: `pagesContainer.0.${fieldName}`,
				value: fieldValue + 'ExtraToTestInWorksCorrect'
			});

			const { nodes } = await odc.getNodesWithProperties({
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

			const { nodes } = await odc.getNodesWithProperties({
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
			const { nodes } = await odc.getNodesWithProperties({
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

	describe('findNodesAtLocation', function () {
		let nodeTreeResponse;
		before(async () => {
			nodeTreeResponse = await odc.storeNodeReferences({
				includeArrayGridChildren: true,
				includeBoundingRectInfo: true
			});
		});

		it('should sort the matching nodes with the center closest to specified location first', async () => {
			const { matches } = await odc.findNodesAtLocation({
				x: 100,
				y: 100,
				nodeTreeResponse: nodeTreeResponse
			});
			expect(matches[0].id).to.equal('rect2');
		});

		it('should not match nodes that are not visible', async () => {
			const { matches } = await odc.findNodesAtLocation({
				x: 100,
				y: 100,
				nodeTreeResponse: nodeTreeResponse
			});
			for (const match of matches) {
				expect(match.id).to.not.equal('invisibleRect');
			}
		});

		it('Should return proper ArrayGrid child for a MarkupGrid', async () => {
			const { matches } = await odc.findNodesAtLocation({
				x: 700,
				y: 150,
				nodeTreeResponse: nodeTreeResponse
			});
			expect(matches[0].keyPath).to.equal('#pagesContainerGroup.0.#markupGrid.1.#rect');
		});

		it('Should return proper ArrayGrid child for a RowList', async () => {
			const { matches } = await odc.findNodesAtLocation({
				x: 500,
				y: 600,
				nodeTreeResponse: nodeTreeResponse
			});
			expect(matches[0].keyPath).to.equal('#pagesContainerGroup.0.#rowListWithoutCustomTitleComponent.1.items.1.#rect');
		});
	});

	describe('responsivenessTesting', function () {
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
			const { periods, testingTotals } = await odc.getResponsivenessTestingData();
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
			const { periods, testingTotals } = await odc.getResponsivenessTestingData();
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
			await odc.disableScreenSaver({ disableScreensaver: true });
		});

		it('should work reenabling', async () => {
			await odc.disableScreenSaver({ disableScreensaver: false });
		});
	});

	describe('getValue', function () {
		it('found should be true if key path was found and has timeTaken as a number', async () => {
			const { found, timeTaken } = await odc.getValue({ base: 'scene', keyPath: '' });
			expect(found).to.be.true;
			expect(timeTaken).to.be.a('number');
		});

		it('should still work if keyPath was not provided', async () => {
			const { value } = await odc.getValue({ base: 'scene' });
			expect(value.subtype).to.equal('MainScene');
		});

		it('should default to having scene as base', async () => {
			const { value } = await odc.getValue({});
			expect(value.subtype).to.equal('MainScene');
		});

		it('found should be false if key path was not found', async () => {
			const { found } = await odc.getValue({ keyPath: 'invalid' });
			expect(found).to.be.false;
		});

		it('should work with getChild', async () => {
			const { value } = await odc.getValue({ keyPath: '1' });
			expect(value.id).to.eq('poster');
		});

		it('should work with negative getChild', async () => {
			const { value } = await odc.getValue({ keyPath: '-1' });
			expect(value.id).to.eq('pagesContainerGroup');
		});

		it('should work with findnode', async () => {
			const { value } = await odc.getValue({ keyPath: '#subchild3' });
			expect(value.id).to.eq('subchild3');
		});

		it('should not find a child if it is not beneath the parent node', async () => {
			const { value } = await odc.getValue({ keyPath: '#subchild3.#testTarget' });
			expect(value?.id).to.be.undefined;
		});

		it('should work with findNode.getChild', async () => {
			const { value } = await odc.getValue({ keyPath: '#testTarget.0' });
			expect(value.id).to.eq('child1');
		});

		it('should work with findNode.getChild.getChild', async () => {
			const { value } = await odc.getValue({ keyPath: '#testTarget.1.1' });
			expect(value.id).to.eq('subchild2');
		});

		it('should work with findNode.getChild.findNode', async () => {
			const { value } = await odc.getValue({ keyPath: '#testTarget.1.#subchild1' });
			expect(value.id).to.eq('subchild1');
		});

		it('should be able to get a value on a valid field', async () => {
			const { value } = await odc.getValue({ base: 'global', keyPath: 'AuthManager.isLoggedIn' });
			expect(value).to.be.false;
		});

		it('should work with array values', async () => {
			const { value } = await odc.getValue({ base: 'global', keyPath: 'arrayValue.0.name' });
			expect(value).to.equal('firstItem');
		});

		it('should work with negative array values', async () => {
			const { value } = await odc.getValue({ base: 'global', keyPath: 'arrayValue.-1.name' });
			expect(value).to.equal('lastItem');
		});

		it('should not include children by default', async () => {
			const { value } = await odc.getValue({});
			expect(value.children).to.be.undefined;
		});

		it('should not include children if maxChildDepth set to zero', async () => {
			const { value } = await odc.getValue({ responseMaxChildDepth: 0 });
			expect(value.children).to.be.undefined;
		});

		it('should include children to specified depth', async () => {
			const { value } = await odc.getValue({ responseMaxChildDepth: 2 });
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
			const { value } = await odc.getValue({ base: 'nodeRef', keyPath: `${key}` });
			expect(value.id).to.equal(storeNode.id);
			expect(value.subtype).to.equal(storeNode.subtype);
		});

		it('should be able to retrieve a RowList item component', async () => {
			const { value } = await odc.getValue({
				keyPath: '#pagesContainerGroup.0.#rowListWithCustomTitleComponent.1.items.2'
			});
			expect(value.subtype).to.equal('RowListItemComponent');
		});

		it('should be able to retrieve a RowList item component\'s children', async () => {
			const { value } = await odc.getValue({
				keyPath: '#pagesContainerGroup.0.#rowListWithCustomTitleComponent.1.items.2.#rect'
			});

			expect(value.id).to.equal('rect');
		});

		it('should be able to retrieve a RowList title component', async () => {
			const { value } = await odc.getValue({
				keyPath: '#pagesContainerGroup.0.#rowListWithCustomTitleComponent.1.title'
			});
			expect(value.subtype).to.equal('RowListRowTitleComponent');
		});

		it('should be able to retrieve a MarkupGrid item component', async () => {
			const { value } = await odc.getValue({
				keyPath: '#pagesContainerGroup.0.#markupGrid.1'
			});
			expect(value.itemContent.id).to.equal('item 1');
		});

		describe('Brightscript interface function calls', function () {
			describe('getParent()', () => {
				it('should work on node item', async () => {
					const { value } = await odc.getValue({ keyPath: '#poster.getParent()' });
					expect(value.subtype).to.equal('MainScene');
				});

				it('should gracefully fallback if called on nonsupported type', async () => {
					const { found } = await odc.getValue({ keyPath: 'intValue.getParent()' });
					expect(found).to.false;
				});
			});

			describe('count()', () => {
				it('should work on array item', async () => {
					const { value } = await odc.getValue({ base: 'global', keyPath: 'arrayValue.count()' });
					expect(value).to.equal(3);
				});

				it('should work on AA item', async () => {
					const { value } = await odc.getValue({ base: 'global', keyPath: 'arrayValue.0.count()' });
					expect(value).to.equal(1);
				});

				it('should work on node item', async () => {
					const { value } = await odc.getValue({ base: 'global', keyPath: 'AuthManager.count()' });
					expect(value).to.equal(6);
				});

				it('should gracefully fallback if called on nonsupported type', async () => {
					const { found } = await odc.getValue({ base: 'global', keyPath: 'intValue.count()' });
					expect(found).to.false;
				});
			});

			describe('keys()', () => {
				it('should work on AA item', async () => {
					const { value } = await odc.getValue({ base: 'global', keyPath: 'arrayValue.0.keys()' });
					expect(value).to.be.instanceof(Array);
					expect(value[0]).to.equal('name');
				});

				it('should work on node item', async () => {
					const { value } = await odc.getValue({ base: 'global', keyPath: 'AuthManager.keys()' });
					expect(value).to.be.instanceof(Array);
					expect(value[0]).to.equal('change');
				});

				it('should gracefully fallback if called on nonsupported type', async () => {
					const { found } = await odc.getValue({ base: 'global', keyPath: 'intValue.keys()' });
					expect(found).to.false;
				});
			});

			describe('len()', () => {
				it('should work on string item', async () => {
					const { value } = await odc.getValue({ base: 'global', keyPath: 'stringValue.len()' });
					expect(value).to.equal(11);
				});

				it('should gracefully fallback if called on nonsupported type', async () => {
					const { found } = await odc.getValue({ base: 'global', keyPath: 'intValue.len()' });
					expect(found).to.false;
				});
			});

			describe('getChildCount()', () => {
				it('should work on node item', async () => {
					const { value } = await odc.getValue({ keyPath: '#pagesContainerGroup.getChildCount()' });
					expect(value).to.equal(1);
				});

				it('should gracefully fallback if called on nonsupported type', async () => {
					const { found } = await odc.getValue({ base: 'global', keyPath: 'intValue.getChildCount()' });
					expect(found).to.false;
				});
			});

			describe('threadinfo()', () => {
				it('should work on node item', async () => {
					const { value } = await odc.getValue({ keyPath: 'threadinfo()' });
					const currentThread = value.currentThread;
					expect(currentThread.name).to.equal('MainScene');
					expect(currentThread.type).to.equal('Render');
				});

				it('should gracefully fallback if called on nonsupported type', async () => {
					const { found } = await odc.getValue({ base: 'global', keyPath: 'intValue.threadinfo()' });
					expect(found).to.false;
				});
			});

			describe('getFieldTypes()', () => {
				it('should work on node item', async () => {
					const { value } = await odc.getValue({ keyPath: 'getFieldTypes()' });
					const expectedValues = {
						allowBackgroundTask: 'boolean',
						backExitsScene: 'boolean',
						backgroundColor: 'color',
						backgroundUri: 'uri',
						change: 'std::type_index',
						childRenderOrder: 'std::type_index',
						clippingRect: 'rect2d',
						currentDesignResolution: 'std::type_index',
						dialog: 'std::type_index',
						enableRenderTracking: 'boolean',
						focusable: 'boolean',
						focusedChild: 'std::type_index',
						id: 'string',
						inheritParentOpacity: 'boolean',
						inheritParentTransform: 'boolean',
						limitBackgroundToUIResolution: 'boolean',
						muteAudioGuide: 'boolean',
						opacity: 'float',
						pagesContainer: 'node',
						palette: 'std::type_index',
						renderPass: 'integer',
						renderTracking: 'std::type_index',
						rotation: 'float',
						scale: 'vector2d',
						scaleRotateCenter: 'vector2d',
						translation: 'vector2d',
						visible: 'boolean'
					};
					expect(Object.keys(value).length).to.equal(Object.keys(expectedValues).length);
					for (const key in expectedValues) {
						expect(value[key]).to.equal(expectedValues[key]);
					}
				});

				it('should gracefully fallback if called on nonsupported type', async () => {
					const { found } = await odc.getValue({ base: 'global', keyPath: 'intValue.getFieldTypes()' });
					expect(found).to.false;
				});
			});

			describe('subtype()', () => {
				it('should work on node item', async () => {
					const { value } = await odc.getValue({ keyPath: '#rowListWithCustomTitleComponent.subtype()' });
					expect(value).to.equal('RowList');
				});

				it('should gracefully fallback if called on nonsupported type', async () => {
					const { found } = await odc.getValue({ base: 'global', keyPath: 'intValue.subtype()' });
					expect(found).to.false;
				});
			});

			describe('boundingRect()', () => {
				it('should work on node item', async () => {
					const { value } = await odc.getValue({ keyPath: '#rowListWithCustomTitleComponent.boundingRect()' });
					expect(value.height).to.equal(430);
					expect(value.width).to.equal(1950);
					expect(value.x).to.equal(135);
					expect(value.y).to.equal(685);
				});

				it('should gracefully fallback if called on nonsupported type', async () => {
					const { found } = await odc.getValue({ base: 'global', keyPath: 'intValue.boundingRect()' });
					expect(found).to.false;
				});
			});

			describe('localBoundingRect()', () => {
				it('should work on node item', async () => {
					const { value } = await odc.getValue({ keyPath: '#rowListWithCustomTitleComponent.localBoundingRect()' });
					expect(value.height).to.equal(430);
					expect(value.width).to.equal(1950);
					expect(value.x).to.equal(-15);
					expect(value.y).to.equal(-15);
				});

				it('should gracefully fallback if called on nonsupported type', async () => {
					const { found } = await odc.getValue({ base: 'global', keyPath: 'intValue.localBoundingRect()' });
					expect(found).to.false;
				});
			});

			describe('sceneBoundingRect()', () => {
				it('should work on node item', async () => {
					const { value } = await odc.getValue({ keyPath: '#rowListWithCustomTitleComponent.sceneBoundingRect()' });
					expect(value.height).to.equal(430);
					expect(value.width).to.equal(1950);
					expect(value.x).to.equal(135);
					expect(value.y).to.equal(685);
				});

				it('should gracefully fallback if called on nonsupported type', async () => {
					const { found } = await odc.getValue({ base: 'global', keyPath: 'intValue.sceneBoundingRect()' });
					expect(found).to.false;
				});
			});

			describe('sceneSubBoundingRect()', () => {
				it('should work on node item', async () => {
					const { value } = await odc.getValue({ keyPath: '#rowListWithCustomTitleComponent.sceneSubBoundingRect(item1_1)' });
					expect(value.height).to.equal(150);
					expect(value.width).to.equal(300);
					expect(value.x).to.equal(480);
					expect(value.y).to.equal(936);
				});

				it('should gracefully fallback if called on nonsupported type', async () => {
					const { found } = await odc.getValue({ base: 'global', keyPath: 'intValue.sceneSubBoundingRect(item0_1)()' });
					expect(found).to.false;
				});
			});
		});
	});

	describe('getValues', function () {
		it('should work with multiple values and should return the timeTaken value', async () => {
			const { results, timeTaken } = await odc.getValues({
				requests: {
					subchild1: { keyPath: '#testTarget.1.#subchild1' },
					subchild2: { keyPath: '#testTarget.1.1' }
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
				keyPath: '#pagesContainerGroup.#loginButton'
			});
			const { node } = await odc.getFocusedNode();
			expect(node).to.be.ok;
			expect(node!.id).to.equal('loginButton');
		});

		it('should not return the node if includeNode is false', async () => {
			await odc.focusNode({
				keyPath: '#pagesContainerGroup.#loginButton',
			});
			const { node } = await odc.getFocusedNode({ includeNode: false });
			expect(node).to.be.not.be.ok;
		});

		it('should not include children by default', async () => {
			const { node } = await odc.getFocusedNode();
			expect(node).to.be.ok;
			expect(node!.children).to.be.undefined;
		});

		it('should not include children if maxChildDepth is set to zero', async () => {
			const { node } = await odc.getFocusedNode({ responseMaxChildDepth: 0 });
			expect(node).to.be.ok;
			expect(node!.children).to.be.undefined;
		});

		it('should include children to specified depth', async () => {
			const { node } = await odc.getFocusedNode({ responseMaxChildDepth: 1 });
			expect(node).to.be.ok;
			expect(node?.children).to.not.be.empty;
			for (const child of node?.children ?? []) {
				// We only requested 1 so make sure it only returned a single level
				expect(child.children).to.be.undefined;
			}
		});

		it('should not include ref field by default', async () => {
			const { ref } = await odc.getFocusedNode();
			expect(ref).to.not.be.ok;
		});

		it('should fail if invalid key supplied or we did not store first', async () => {
			try {
				await odc.getFocusedNode({ nodeRefKey: 'na', includeRef: true });
			} catch (e) {
				// failed as expected
				return;
			}
			assert.fail('Should have thrown an exception');
		});

		it('should return correct ref if requested', async () => {
			const storeResult = await odc.storeNodeReferences();
			const { node, ref } = await odc.getFocusedNode({ includeRef: true });
			expect(ref).to.be.ok;
			expect(node).to.be.ok;
			expect(storeResult.flatTree[ref!].subtype).to.equal(node!.subtype);
			expect(storeResult.flatTree[ref!].id).to.equal(node!.id);
		});

		it('should return focused arrayGrid child if requested', async () => {
			const storeResult = await odc.storeNodeReferences({ includeArrayGridChildren: true });
			await odc.focusNode({
				keyPath: '#rowListWithCustomTitleComponent'
			});
			const { node, ref } = await odc.getFocusedNode({
				includeRef: true,
				returnFocusedArrayGridChild: true
			});
			expect(ref).to.be.ok;
			expect(node).to.be.ok;
			expect(storeResult.flatTree[ref!].subtype).to.equal(node!.subtype);
			expect(node!.itemContent.id).to.equal('row 0  item 0');

			// Reset back to login button for focus
			await odc.focusNode({
				keyPath: '#pagesContainerGroup.#loginButton'
			});
		});

		it('should include correct keyPath field', async () => {
			const expectedKeyPath = '#pagesContainerGroup.0.#loginButton';
			await odc.focusNode({ keyPath: expectedKeyPath });
			const { keyPath } = await odc.getFocusedNode();
			expect(keyPath).to.equal(expectedKeyPath);
		});
	});

	describe('hasFocus', function () {
		it('should return true when current node has focus', async () => {
			const args: ODC.FocusNodeArgs = { keyPath: '#pagesContainerGroup.#loginButton' };
			await odc.focusNode(args);
			const hasFocus = await odc.hasFocus(args);
			expect(hasFocus).to.be.true;
		});

		it('should return false when current node does not have focus', async () => {
			expect(await odc.hasFocus({ keyPath: '#child1' })).to.be.false;
		});
	});

	describe('isInFocusChain', function () {
		it('should return true when current node is in focus chain', async () => {
			const args: ODC.FocusNodeArgs = { keyPath: '#pagesContainerGroup.#loginButton' };
			await odc.focusNode(args);
			const isInFocusChain = await odc.isInFocusChain(args);
			expect(isInFocusChain).to.be.true;
		});

		it('should return false when current node is not in focus chain', async () => {
			expect(await odc.isInFocusChain({ keyPath: '#child1' })).to.be.false;
		});
	});

	describe('focusNode', function () {
		it('should successfully set focus on the requested node', async () => {
			const args: ODC.FocusNodeArgs = { keyPath: '#pagesContainerGroup' };
			await odc.focusNode(args);
			const hasFocus = await odc.hasFocus(args);
			expect(hasFocus).to.be.true;
		});

		it('should return an error when keypath does not point to a node', async () => {
			try {
				await odc.focusNode({ keyPath: 'stringValue' });
			} catch (e) {
				// failed as expected
				return;
			}
			assert.fail('Should have thrown an exception');
		});
	});

	describe('createChild', function () {
		const baseKeyPath = '#temporaryNodesGroup';
		this.afterEach(async () => {
			const { value: childCount } = await odc.getValue({
				keyPath: `${baseKeyPath}.getChildCount()`
			});
			if (childCount > 0) {
				await odc.removeNodeChildren({
					keyPath: baseKeyPath,
					index: 0,
					count: -1
				});
			}
		});

		it('should successfully create a child on the specified parent', async () => {
			// Make sure there are no children to start
			const { value: startingChildCount } = await odc.getValue({
				keyPath: `${baseKeyPath}.getChildCount()`
			});
			expect(startingChildCount).to.equal(0);

			// Add our child
			const childId = utils.addRandomPostfix('child');
			const customFieldValue = utils.addRandomPostfix('customFieldValue');
			await odc.createChild({
				keyPath: baseKeyPath,
				subtype: 'Group',
				fields: {
					id: childId,
					customField: customFieldValue
				}
			});

			// Make sure it got added to the right parent
			const { value: childCount } = await odc.getValue({
				keyPath: `${baseKeyPath}.getChildCount()`
			});
			expect(childCount).to.equal(1);

			// Make sure it added the fields we requested
			const { value: child, found } = await odc.getValue({
				keyPath: `${baseKeyPath}.#${childId}`
			});
			expect(found).to.be.true;
			expect(child.customField).to.equal(customFieldValue);
		});

		it('should fail if the subtype for the child does not exist', async () => {
			try {
				await odc.createChild({
					keyPath: baseKeyPath,
					subtype: 'IDoNotExist'
				});
			} catch (e) {
				// failed as expected
				return;
			}
			throw new Error('Should have thrown an exception');
		});
	});

	describe('removeNode', function () {
		const baseKeyPath = '#temporaryNodesGroup';

		it('should successfully remove a node', async () => {
			// Add a child node
			const nodeId = utils.addRandomPostfix('node');
			await odc.createChild({
				keyPath: baseKeyPath,
				subtype: 'Group',
				fields: {
					id: nodeId
				}
			});

			// Make sure the child got added
			const { value: startingChildCount } = await odc.getValue({
				keyPath: `${baseKeyPath}.getChildCount()`
			});
			expect(startingChildCount).to.equal(1);

			// Remove the node
			await odc.removeNode({
				keyPath: `${baseKeyPath}.#${nodeId}`
			});

			// Make sure it got removed
			const { value: childCount } = await odc.getValue({
				keyPath: `${baseKeyPath}.getChildCount()`
			});
			expect(childCount).to.equal(0);
		});
	});

	describe('removeNodeChildren', function () {
		it('should successfully delete the child at the specified index', async () => {
			// Add a child node
			const nodeId = utils.addRandomPostfix('node');
			const baseKeyPath = '#temporaryNodesGroup';
			await odc.setValue({
				field: '',
				keyPath: baseKeyPath,
				value: {
					children: [{
						subtype: 'Group',
						id: nodeId
					}]
				}
			});

			// Verify it got added correctly
			const { value: childCount } = await odc.getValue({
				keyPath: `${baseKeyPath}.getChildCount()`
			});
			expect(childCount).to.equal(1);

			const { value: child } = await odc.getValue({
				keyPath: `${baseKeyPath}.0`
			});
			expect(child.id).to.equal(nodeId);

			await odc.removeNodeChildren({
				keyPath: baseKeyPath,
				index: 0
			});

			const { value: newChildCount } = await odc.getValue({
				keyPath: `${baseKeyPath}.getChildCount()`
			});
			expect(newChildCount).to.equal(0);
		});

		it('should successfully delete the specified count of nodes starting at the provided index', async () => {
			// Add the child nodes
			const nodeIds = [] as string[];
			const children = [] as any[];

			for (let i = 1; i < 5; i++) {
				const nodeId = utils.addRandomPostfix('node');
				nodeIds.push(nodeId);
				children.push({
					subtype: 'Group',
					id: nodeId
				});
			}

			const baseKeyPath = '#temporaryNodesGroup';
			await odc.setValue({
				field: '',
				keyPath: baseKeyPath,
				value: {
					children: children
				}
			});

			// Verify it got added correctly
			const { value: childCount } = await odc.getValue({
				keyPath: `${baseKeyPath}.getChildCount()`
			});
			expect(childCount).to.equal(nodeIds.length);

			const { value: firstChildBefore } = await odc.getValue({
				keyPath: `${baseKeyPath}.0`
			});
			expect(firstChildBefore.id).to.equal(nodeIds[0]);

			await odc.removeNodeChildren({
				keyPath: baseKeyPath,
				index: 1,
				count: 3
			});

			const { value: newChildCount } = await odc.getValue({
				keyPath: `${baseKeyPath}.getChildCount()`
			});
			expect(newChildCount).to.equal(1);

			const { value: firstChildAfter } = await odc.getValue({
				keyPath: `${baseKeyPath}.0`
			});
			expect(firstChildAfter.id).to.equal(nodeIds[0]);

			// Cleanup our last remaining child
			await odc.removeNodeChildren({
				keyPath: baseKeyPath,
				index: 0,
				count: 1
			});
		});

		it('should successfully remove all children if -1 is given', async () => {
			// Add the child nodes
			const nodeIds = [] as string[];
			const children = [] as any[];

			for (let i = 1; i < 5; i++) {
				const nodeId = utils.addRandomPostfix('node');
				nodeIds.push(nodeId);
				children.push({
					subtype: 'Group',
					id: nodeId
				});
			}

			const baseKeyPath = '#temporaryNodesGroup';
			await odc.setValue({
				field: '',
				keyPath: baseKeyPath,
				value: {
					children: children
				}
			});

			// Verify it got added correctly
			const { value: childCount } = await odc.getValue({
				keyPath: `${baseKeyPath}.getChildCount()`
			});
			expect(childCount).to.equal(nodeIds.length);

			await odc.removeNodeChildren({
				keyPath: baseKeyPath,
				index: 0,
				count: -1
			});

			const { value: newChildCount } = await odc.getValue({
				keyPath: `${baseKeyPath}.getChildCount()`
			});
			expect(newChildCount).to.equal(0);
		});

		it('should return an error when keypath does not point to a node', async () => {
			try {
				await odc.removeNodeChildren({
					keyPath: 'stringValue',
					index: 0
				});
			} catch (e) {
				// failed as expected
				return;
			}
			assert.fail('Should have thrown an exception');
		});
	});

	describe('isShowingOnScreen', function () {
		const baseKeyPath = '#temporaryNodesGroup';

		afterEach(async function () {
			await odc.removeNodeChildren({
				keyPath: baseKeyPath,
				index: 0
			});

			const { value: childCount } = await odc.getValue({
				keyPath: `${baseKeyPath}.getChildCount()`
			});
			expect(childCount).to.equal(0);
		});

		it('should return isShowing=false if parent node visible=false', async () => {
			// Add a testing node structure
			const nodeId = utils.addRandomPostfix('node');

			await odc.setValue({
				field: '',
				keyPath: baseKeyPath,
				value: {
					children: [{
						subtype: 'Group',
						visible: 'false',
						children: [{
							subtype: 'Group',
							id: nodeId
						}]
					}]
				}
			});

			// Verify it got added correctly
			const { value: childCount } = await odc.getValue({
				keyPath: `${baseKeyPath}.getChildCount()`
			});
			expect(childCount).to.equal(1);

			const { isShowing } = await odc.isShowingOnScreen({
				keyPath: `${baseKeyPath}.#${nodeId}`
			});
			expect(isShowing).to.be.false;
		});

		it('should return isShowing=false if parent node opacity=0', async () => {
			// Add a testing node structure
			const nodeId = utils.addRandomPostfix('node');

			await odc.setValue({
				field: '',
				keyPath: baseKeyPath,
				value: {
					children: [{
						subtype: 'Group',
						opacity: 0,
						children: [{
							subtype: 'Group',
							children: [{
								subtype: 'Group',
								id: nodeId
							}]
						}]
					}]
				}
			});

			// Verify it got added correctly
			const { value: childCount } = await odc.getValue({
				keyPath: `${baseKeyPath}.getChildCount()`
			});
			expect(childCount).to.equal(1);

			const { isShowing } = await odc.isShowingOnScreen({
				keyPath: `${baseKeyPath}.#${nodeId}`
			});
			expect(isShowing).to.be.false;
		});

		it('should return isShowing=false if node visible=false', async () => {
			// Add a testing node structure
			const nodeId = utils.addRandomPostfix('node');

			await odc.setValue({
				field: '',
				keyPath: baseKeyPath,
				value: {
					children: [{
						children: [{
							subtype: 'Rectangle',
							id: nodeId,
							visible: false
						}]
					}]
				}
			});

			// Verify it got added correctly
			const { value: childCount } = await odc.getValue({
				keyPath: `${baseKeyPath}.getChildCount()`
			});
			expect(childCount).to.equal(1);

			const { isShowing } = await odc.isShowingOnScreen({
				keyPath: `${baseKeyPath}.#${nodeId}`
			});
			expect(isShowing).to.be.false;
		});

		it('should return isShowing=false if node opacity=0', async () => {
			// Add a testing node structure
			const nodeId = utils.addRandomPostfix('node');

			await odc.setValue({
				field: '',
				keyPath: baseKeyPath,
				value: {
					children: [{
						children: [{
							subtype: 'Rectangle',
							id: nodeId,
							opacity: 0
						}]
					}]
				}
			});

			// Verify it got added correctly
			const { value: childCount } = await odc.getValue({
				keyPath: `${baseKeyPath}.getChildCount()`
			});
			expect(childCount).to.equal(1);

			const { isShowing } = await odc.isShowingOnScreen({
				keyPath: `${baseKeyPath}.#${nodeId}`
			});
			expect(isShowing).to.be.false;
		});

		it('should return isShowing=false if node width=0', async () => {
			// Add a testing node structure
			const nodeId = utils.addRandomPostfix('node');

			await odc.setValue({
				field: '',
				keyPath: baseKeyPath,
				value: {
					children: [{
						children: [{
							subtype: 'Rectangle',
							id: nodeId,
							width: 0,
							height: 100,
							translation: [100, 100]
						}]
					}]
				}
			});

			// Verify it got added correctly
			const { value: childCount } = await odc.getValue({
				keyPath: `${baseKeyPath}.getChildCount()`
			});
			expect(childCount).to.equal(1);

			const { isShowing, isFullyShowing } = await odc.isShowingOnScreen({
				keyPath: `${baseKeyPath}.#${nodeId}`
			});
			expect(isShowing).to.be.false;
			expect(isFullyShowing).to.be.false;
		});

		it('should return isShowing=false if node height=0', async () => {
			// Add a testing node structure
			const nodeId = utils.addRandomPostfix('node');

			await odc.setValue({
				field: '',
				keyPath: baseKeyPath,
				value: {
					children: [{
						children: [{
							subtype: 'Rectangle',
							id: nodeId,
							width: 100,
							height: 0,
							translation: [100, 100]
						}]
					}]
				}
			});

			// Verify it got added correctly
			const { value: childCount } = await odc.getValue({
				keyPath: `${baseKeyPath}.getChildCount()`
			});
			expect(childCount).to.equal(1);

			const { isShowing, isFullyShowing } = await odc.isShowingOnScreen({
				keyPath: `${baseKeyPath}.#${nodeId}`
			});
			expect(isShowing).to.be.false;
			expect(isFullyShowing).to.be.false;
		});

		it('should return isShowing=false if node is located off screen (negative x)', async () => {
			// Add a testing node structure
			const nodeId = utils.addRandomPostfix('node');

			await odc.setValue({
				field: '',
				keyPath: baseKeyPath,
				value: {
					children: [{
						children: [{
							subtype: 'Rectangle',
							id: nodeId,
							width: 1000,
							height: 1000,
							translation: [-3000, 0]
						}]
					}]
				}
			});

			// Verify it got added correctly
			const { value: childCount } = await odc.getValue({
				keyPath: `${baseKeyPath}.getChildCount()`
			});
			expect(childCount).to.equal(1);

			const { isShowing, isFullyShowing } = await odc.isShowingOnScreen({
				keyPath: `${baseKeyPath}.#${nodeId}`
			});
			expect(isShowing).to.be.false;
			expect(isFullyShowing).to.be.false;
		});

		it('should return isShowing=false if node is located off screen (negative y)', async () => {
			// Add a testing node structure
			const nodeId = utils.addRandomPostfix('node');

			await odc.setValue({
				field: '',
				keyPath: baseKeyPath,
				value: {
					children: [{
						children: [{
							subtype: 'Rectangle',
							id: nodeId,
							width: 1000,
							height: 1000,
							translation: [0, -3000]
						}]
					}]
				}
			});

			// Verify it got added correctly
			const { value: childCount } = await odc.getValue({
				keyPath: `${baseKeyPath}.getChildCount()`
			});
			expect(childCount).to.equal(1);

			const { isShowing, isFullyShowing } = await odc.isShowingOnScreen({
				keyPath: `${baseKeyPath}.#${nodeId}`
			});
			expect(isShowing).to.be.false;
			expect(isFullyShowing).to.be.false;
		});

		it('should return isShowing=false if node is located off screen (positive x)', async () => {
			// Add a testing node structure
			const nodeId = utils.addRandomPostfix('node');

			await odc.setValue({
				field: '',
				keyPath: baseKeyPath,
				value: {
					children: [{
						children: [{
							subtype: 'Rectangle',
							id: nodeId,
							width: 1000,
							height: 1000,
							translation: [3000, 0]
						}]
					}]
				}
			});

			// Verify it got added correctly
			const { value: childCount } = await odc.getValue({
				keyPath: `${baseKeyPath}.getChildCount()`
			});
			expect(childCount).to.equal(1);

			const { isShowing, isFullyShowing } = await odc.isShowingOnScreen({
				keyPath: `${baseKeyPath}.#${nodeId}`
			});
			expect(isShowing).to.be.false;
			expect(isFullyShowing).to.be.false;
		});

		it('should return isShowing=false if node is located off screen (positive y)', async () => {
			// Add a testing node structure
			const nodeId = utils.addRandomPostfix('node');

			await odc.setValue({
				field: '',
				keyPath: baseKeyPath,
				value: {
					children: [{
						children: [{
							subtype: 'Rectangle',
							id: nodeId,
							width: 1000,
							height: 1000,
							translation: [0, 3000]
						}]
					}]
				}
			});

			// Verify it got added correctly
			const { value: childCount } = await odc.getValue({
				keyPath: `${baseKeyPath}.getChildCount()`
			});
			expect(childCount).to.equal(1);

			const { isShowing, isFullyShowing } = await odc.isShowingOnScreen({
				keyPath: `${baseKeyPath}.#${nodeId}`
			});
			expect(isShowing).to.be.false;
			expect(isFullyShowing).to.be.false;
		});

		it('should return isShowing=false if parent node is located off screen (negative x)', async () => {
			// Add a testing node structure
			const nodeId = utils.addRandomPostfix('node');

			await odc.setValue({
				field: '',
				keyPath: baseKeyPath,
				value: {
					children: [{
						translation: [-3000, 0],
						children: [{
							subtype: 'Rectangle',
							id: nodeId,
							width: 1000,
							height: 1000
						}]
					}]
				}
			});

			// Verify it got added correctly
			const { value: childCount } = await odc.getValue({
				keyPath: `${baseKeyPath}.getChildCount()`
			});
			expect(childCount).to.equal(1);

			const { isShowing, isFullyShowing } = await odc.isShowingOnScreen({
				keyPath: `${baseKeyPath}.#${nodeId}`
			});
			expect(isShowing).to.be.false;
			expect(isFullyShowing).to.be.false;
		});

		it('should return isShowing=false if parent node is located off screen (negative y)', async () => {
			// Add a testing node structure
			const nodeId = utils.addRandomPostfix('node');

			await odc.setValue({
				field: '',
				keyPath: baseKeyPath,
				value: {
					children: [{
						translation: [0, -3000],
						children: [{
							subtype: 'Rectangle',
							id: nodeId,
							width: 1000,
							height: 1000
						}]
					}]
				}
			});

			// Verify it got added correctly
			const { value: childCount } = await odc.getValue({
				keyPath: `${baseKeyPath}.getChildCount()`
			});
			expect(childCount).to.equal(1);

			const { isShowing, isFullyShowing } = await odc.isShowingOnScreen({
				keyPath: `${baseKeyPath}.#${nodeId}`
			});
			expect(isShowing).to.be.false;
			expect(isFullyShowing).to.be.false;
		});

		it('should return isShowing=false if parent node is located off screen (positive x)', async () => {
			// Add a testing node structure
			const nodeId = utils.addRandomPostfix('node');

			await odc.setValue({
				field: '',
				keyPath: baseKeyPath,
				value: {
					children: [{
						translation: [3000, 0],
						children: [{
							subtype: 'Rectangle',
							id: nodeId,
							width: 1000,
							height: 1000
						}]
					}]
				}
			});

			// Verify it got added correctly
			const { value: childCount } = await odc.getValue({
				keyPath: `${baseKeyPath}.getChildCount()`
			});
			expect(childCount).to.equal(1);

			const { isShowing, isFullyShowing } = await odc.isShowingOnScreen({
				keyPath: `${baseKeyPath}.#${nodeId}`
			});
			expect(isShowing).to.be.false;
			expect(isFullyShowing).to.be.false;
		});

		it('should return isShowing=false if parent node is located off screen (positive y)', async () => {
			// Add a testing node structure
			const nodeId = utils.addRandomPostfix('node');

			await odc.setValue({
				field: '',
				keyPath: baseKeyPath,
				value: {
					children: [{
						translation: [0, 3000],
						children: [{
							subtype: 'Rectangle',
							id: nodeId,
							width: 1000,
							height: 1000
						}]
					}]
				}
			});

			// Verify it got added correctly
			const { value: childCount } = await odc.getValue({
				keyPath: `${baseKeyPath}.getChildCount()`
			});
			expect(childCount).to.equal(1);

			const { isShowing, isFullyShowing } = await odc.isShowingOnScreen({
				keyPath: `${baseKeyPath}.#${nodeId}`
			});
			expect(isShowing).to.be.false;
			expect(isFullyShowing).to.be.false;
		});

		it('should return isShowing=true and isFullyShowing=false if node is partially offscreen', async () => {
			// Add a testing node structure
			const nodeId = utils.addRandomPostfix('node');

			await odc.setValue({
				field: '',
				keyPath: baseKeyPath,
				value: {
					children: [{
						children: [{
							subtype: 'Rectangle',
							id: nodeId,
							width: 1000,
							height: 1000,
							translation: [-500, -500]
						}]
					}]
				}
			});

			// Verify it got added correctly
			const { value: childCount } = await odc.getValue({
				keyPath: `${baseKeyPath}.getChildCount()`
			});
			expect(childCount).to.equal(1);

			const { isShowing, isFullyShowing } = await odc.isShowingOnScreen({
				keyPath: `${baseKeyPath}.#${nodeId}`
			});
			expect(isShowing).to.be.true;
			expect(isFullyShowing).to.be.false;
		});

		it('should return isShowing=true and isFullyShowing=true if node is fully offscreen', async () => {
			// Add a testing node structure
			const nodeId = utils.addRandomPostfix('node');

			await odc.setValue({
				field: '',
				keyPath: baseKeyPath,
				value: {
					children: [{
						children: [{
							subtype: 'Rectangle',
							id: nodeId,
							width: 500,
							height: 500,
							translation: [500, 500]
						}]
					}]
				}
			});

			// Verify it got added correctly
			const { value: childCount } = await odc.getValue({
				keyPath: `${baseKeyPath}.getChildCount()`
			});
			expect(childCount).to.equal(1);

			const { isShowing, isFullyShowing } = await odc.isShowingOnScreen({
				keyPath: `${baseKeyPath}.#${nodeId}`
			});
			expect(isShowing).to.be.true;
			expect(isFullyShowing).to.be.true;
		});
	});

	describe('isSubtype', function () {
		it('should return true if self subtype matches by default', async () => {
			const isSubtype = await odc.isSubtype({
				keyPath: '#pagesContainerGroup',
				subtype: 'Group'
			});
			expect(isSubtype).to.be.true;
		});

		it('should return false if self subtype matches and matchOnSelfSubtype=false', async () => {
			const isSubtype = await odc.isSubtype({
				keyPath: '#pagesContainerGroup',
				matchOnSelfSubtype: false,
				subtype: 'Group'
			});
			expect(isSubtype).to.be.false;
		});

		it('should return false if subtype does not match', async () => {
			const isSubtype = await odc.isSubtype({
				keyPath: '#pagesContainerGroup',
				subtype: 'RowList'
			});
			expect(isSubtype).to.be.false;
		});

		it('should throw an error if node does not exist', async () => {
			try {
				await odc.isSubtype({
					keyPath: '#doesNotExist',
					subtype: 'Group'
				});
			} catch (e) {
				// failed as expected
				return;
			}
			assert.fail('Should have thrown an exception');
		});
	});

	describe('setValue', function () {
		it('should be able to set a key on global', async () => {
			await setAndVerifyValue({
				base: 'global',
				keyPath: 'booleanValue',
				value: false,
				expectedStartingValue: true
			});
		});

		it('should be able set a value on a node and succeed', async () => {
			await setAndVerifyValue({
				base: 'global',
				keyPath: 'AuthManager.isLoggedIn',
				value: true,
				expectedStartingValue: false
			});
		});

		it('should be able to set a key on an AA stored on a node', async () => {
			await setAndVerifyValue({
				base: 'global',
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

			const { found, value } = await odc.getValue({ keyPath: nodeKey, responseMaxChildDepth: 1 });
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
				value: updateValue
			});

			const { value } = await odc.getValue({ responseMaxChildDepth: 1 });

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
				keyPath: '#pagesContainerGroup',
				field: '',
				value: updateValue
			});

			const { value } = await odc.getValue({ keyPath: '#pagesContainerGroup', responseMaxChildDepth: 1 });

			const lastNode = value.children.pop();
			expect(lastNode.id).to.equal(nodeKey);
		});

		it('should work updating an array value', async () => {
			const nodeKey = utils.addRandomPostfix('node');

			const updateValue = utils.addRandomPostfix('first');

			const sharedArgs = {
				base: 'global' as const,
				keyPath: 'arrayValue.0.name',
			};
			await odc.setValue({
				...sharedArgs,
				value: updateValue
			});

			const { value } = await odc.getValue(sharedArgs);
			expect(value).to.equal(updateValue);
		});

		it('should still work if we are updating an array item as the last key', async () => {
			const updateValue = { name: 'newLastItem' };
			const sharedArgs = {
				base: 'global' as const,
				keyPath: 'arrayValue.-1',
			};
			await odc.setValue({
				...sharedArgs,
				value: updateValue
			});

			const { value } = await odc.getValue(sharedArgs);
			expect(value.name).to.equal(updateValue.name);
		});

		it('should work if we are making a new aa value', async () => {
			const updateValue = { name: 'newAAValue' };
			const baseKeyPath = 'emptyAAValue';
			const sharedArgs = {
				base: 'global' as const,
				keyPath: `${baseKeyPath}.test`,
			};
			await odc.setValue({
				...sharedArgs,
				value: updateValue
			});

			const { value } = await odc.getValue(sharedArgs);
			expect(value.name).to.equal(updateValue.name);

			await setAndVerifyValue({
				base: 'global' as const,
				keyPath: baseKeyPath,
				value: {}
			});
		});


		it('should work if we are adding multiple levels of a new aa value', async () => {
			const updateValue = 'newAAValue';
			const baseKeyPath = 'emptyAAValue';
			const sharedArgs = {
				base: 'global' as const,
				keyPath: `${baseKeyPath}.test.name`,
			};
			await odc.setValue({
				...sharedArgs,
				value: updateValue
			});

			const { value } = await odc.getValue(sharedArgs);
			expect(value).to.equal(updateValue);

			await setAndVerifyValue({
				base: 'global' as const,
				keyPath: baseKeyPath,
				value: {}
			});
		});

		it('should work if we are adding multiple levels of a new aa value', async () => {
			const updateValue = 'newAAValue';
			const sharedArgs = {
				base: 'global' as const,
				keyPath: 'emptyAAValue.emptyAAValueemptyAAValuetest.name',
			};
			await odc.setValue({
				...sharedArgs,
				value: updateValue
			});

			const { value } = await odc.getValue(sharedArgs);
			expect(value).to.equal(updateValue);

			await setAndVerifyValue({
				base: 'global' as const,
				keyPath: 'emptyAAValue',
				value: {}
			});
		});

		it('should work if we are adding multiple levels of a new array value', async () => {
			const updateValue = 'newArrayValue';
			const baseKeyPath = 'emptyAAValue';
			const sharedArgs = {
				base: 'global' as const,
				keyPath: `${baseKeyPath}.arrayTest.0.1`,
			};
			await odc.setValue({
				...sharedArgs,
				value: updateValue
			});

			const { value } = await odc.getValue(sharedArgs);
			expect(value).to.equal(updateValue);

			await setAndVerifyValue({
				base: 'global' as const,
				keyPath: baseKeyPath,
				value: {}
			});
		});

		it('should work if we are adding a new array value', async () => {
			const updateValue = 'newArrayValue';
			const baseKeyPath = 'emptyAAValue';
			const sharedArgs = {
				base: 'global' as const,
				keyPath: `${baseKeyPath}.arrayTest.0`,
			};
			await odc.setValue({
				...sharedArgs,
				value: updateValue
			});

			const { value } = await odc.getValue(sharedArgs);
			expect(value).to.equal(updateValue);

			await setAndVerifyValue({
				base: 'global' as const,
				keyPath: baseKeyPath,
				value: {}
			});
		});

		it('properly strips non ascii input', async () => {
			const expectedValue = 'I do not explode on unicode characters';
			await odc.setValue({
				base: 'global',
				keyPath: 'stringValue',
				value: expectedValue + '🔍'
			});
			const { value } = await odc.getValue({
				base: 'global',
				keyPath: 'stringValue'
			});
			expect(value).to.equal(expectedValue);
		});
	});

	describe('onFieldChangeOnce', function () {
		it('should fail if given invalid keyPath', async () => {
			try {
				await odc.onFieldChangeOnce({ keyPath: 'does.not.exist', retryTimeout: 200 });
			} catch (e) {
				// failed as expected
				return;
			}
			assert.fail('Should have thrown an exception');
		});

		it('should succeed if given a valid node for its parent keyPath and should return timeTaken value', async () => {
			const args = { base: 'global', keyPath: 'AuthManager.isLoggedIn' } as ODC.BaseKeyPath;
			await setAndVerifyValue({ ...args, value: false });
			const observePromise = odc.onFieldChangeOnce({ ...args });
			await setAndVerifyValue({ ...args, value: true });
			const { value, observerFired, timeTaken } = await observePromise;
			expect(value).to.be.true;
			expect(observerFired).to.be.true;
			expect(timeTaken).to.be.a('number');
		});

		it('should succeed if provided a field', async () => {
			const args = { base: 'global', keyPath: 'AuthManager', field: 'isLoggedIn' } as ODC.BaseKeyPath;
			await setAndVerifyValue({ ...args, value: false });
			const observePromise = odc.onFieldChangeOnce({ ...args });
			await setAndVerifyValue({ ...args, value: true });
			const { value, observerFired, timeTaken } = await observePromise;
			expect(value).to.be.true;
			expect(observerFired).to.be.true;
			expect(timeTaken).to.be.a('number');
		});

		it('should wait for value to match if requested and should work with simple match property', async () => {
			const args = { base: 'global', keyPath: 'stringValue' } as ODC.BaseKeyPath;
			const expectedValue = utils.addRandomPostfix('secondValue');
			const observePromise = odc.onFieldChangeOnce({ ...args, match: expectedValue });
			await setAndVerifyValue({ ...args, value: utils.addRandomPostfix('firstValue') });
			await setAndVerifyValue({ ...args, value: expectedValue });
			const { value, observerFired } = await observePromise;
			expect(value).to.equal(expectedValue);
			expect(observerFired).to.be.true;
		});

		it('if the match key path does not exist it should throw an error', async () => {
			const args = { base: 'global', keyPath: 'stringValue' } as ODC.BaseKeyPath;
			const observePromise = odc.onFieldChangeOnce({ ...args, match: { keyPath: 'invalid.key.path', value: 'willNeverMatch' } }, { timeout: 400 });
			const setValuePromise = setAndVerifyValue({ ...args, value: utils.addRandomPostfix('trigger') });
			try {
				await Promise.all([observePromise, setValuePromise]);
			} catch (e) {
				return;
			}
			assert.fail('Should have thrown an exception');
		});

		it('it should allow match on other key paths and wait until that value matches', async () => {
			const stringKeyPath = {
				base: 'global' as ODC.BaseType,
				keyPath: 'stringValue'
			};

			const match = {
				base: 'global' as ODC.BaseType,
				keyPath: 'intValue',
				value: utils.randomInteger()
			};
			await setAndVerifyValue({ ...match, value: utils.randomInteger() });
			const observePromise = odc.onFieldChangeOnce({ ...stringKeyPath, match: match });
			await setAndVerifyValue({ ...stringKeyPath, value: utils.addRandomPostfix('firstValue') });
			await setAndVerifyValue(match);
			const expectedValue = utils.addRandomPostfix('secondValue');
			await setAndVerifyValue({ ...stringKeyPath, value: expectedValue } as any);
			const { value, observerFired } = await observePromise;
			expect(value).to.equal(expectedValue);
			expect(observerFired).to.be.true;
		});

		it('if a match value is provided and the value already equals what we are looking for, it should return right away', async () => {
			const args = {
				base: 'global' as ODC.BaseType,
				keyPath: 'stringValue',
				match: {
					base: 'global' as ODC.BaseType,
					keyPath: 'intValue',
					value: utils.randomInteger()
				}
			};
			await setAndVerifyValue(args.match);
			const { observerFired } = await odc.onFieldChangeOnce(args);
			expect(observerFired).to.be.false;
		});

		it('should still work after a restart of the application', async () => {
			await ecp.sendLaunchChannel({
				params: { contentId: 'deeplink' },
				verifyLaunch: false
			});
			const { observerFired } = await odc.onFieldChangeOnce({
				base: 'global',
				keyPath: 'launchComplete'
			});
			expect(observerFired).to.be.true;
		});
	});

	describe('onFieldChangeRepeat', function () {
		it('check multiple onFieldChangeRepeat requests running simultaneously, match tested', async () => {
			
			//RESET COUNTER
			await odc.setValue({
				base: 'global',
				keyPath: 'repeatingTimerFireCount',
				value: 0,
			});

			const args1 = { base: 'global', keyPath: 'repeatingTimerFireCount' } as ODC.BaseKeyPath;
			const args2 = { base: 'global', keyPath: 'repeatingTimerFireCount', match: 2 } as ODC.BaseKeyPath;
			const args3 = { base: 'global', keyPath: 'repeatingTimerFireCount', match: 7 } as ODC.BaseKeyPath;

			let events1: object[] = [];
			let events2: object[] = [];
			let events3: object[] = [];
			
			const cancelRequest1 = await odc.onFieldChangeRepeat({ ...args1 },{timeout:(20*1000)}, (response)=>{
				if(response["json"] != null && response.json["value"]!= null){
					events1.push(response);
				}
				return;
			});

			const cancelRequest2 = await odc.onFieldChangeRepeat({ ...args2 },{timeout:(20*1000)}, (response)=>{
				if(response["json"] != null && response.json["value"]!= null){
					events2.push(response);
				}
				return;
			});

			const cancelRequest3 = await odc.onFieldChangeRepeat({ ...args3 },{timeout:(20*1000)}, (response)=>{
				if(response["json"] != null && response.json["value"]!= null){
					events3.push(response);
				}
				return;
			});

			await utils.sleep(3000);
			expect(events1.length).to.be.lessThan(4); //We expect to have 3

			let cancelResponse1 = await cancelRequest1();
			let cancelMessage1 = cancelResponse1.json.success.message;
			expect(cancelMessage1).to.be.a('string');

			await utils.sleep(3*1000);
			expect(events1.length).to.be.lessThan(4); //We expect to have 3

			let cancelResponse2 = await cancelRequest2();
			let cancelMessage2 = cancelResponse2.json.success.message;
			expect(cancelMessage2).to.be.a('string');
			await utils.sleep(2*1000);

			let cancelResponse3 = await cancelRequest3();
			let cancelMessage3 = cancelResponse3.json.success.message;
			expect(cancelMessage3).to.be.a('string');
			expect(events1.length).to.be.lessThan(4); //We expect to have 6
			expect(events2.length).to.be.equal(1); //We expect to have 1
			expect(events3.length).to.be.equal(1); //We expect to have 1
		});

		it('should only receive the event where the value is 3', async () => {
			
			//RESET COUNTER
			await odc.setValue({
				base: 'global',
				keyPath: 'repeatingTimerFireCount',
				value: 0,
			});

			const args = { base: 'global', keyPath: 'repeatingTimerFireCount', match: 3 } as ODC.BaseKeyPath;
			let events: object[] = [];
			const cancelRequest = await odc.onFieldChangeRepeat({ ...args },{timeout:(20*1000)}, (response)=>{
				if(response["json"] != null && response.json["value"]!= null){
					events.push(response);
				}
				return;
			});
			await utils.sleep(4*1000);
			expect(events).to.be.an('array');
			expect(events).to.have.lengthOf(1);
			let cancelResult = await cancelRequest();
			let cancelMessage = cancelResult.json.success.message;
			expect(cancelMessage).to.be.a('string');
		});

		it('should have some events on the events array', async () => {
			const args = { base: 'global', keyPath: 'repeatingTimerFireCount' } as ODC.BaseKeyPath;
			let events: object[] = [];
			const cancelRequest = await odc.onFieldChangeRepeat({ ...args },{timeout:(20*1000)}, (response)=>{
				if(response["json"] != null && response.json["value"]!= null){
					events.push(response);
				}
				return;
			});
			await utils.sleep(3*1000);
			expect(events).to.be.an('array');
			expect(events).to.not.be.empty;
			let cancelResult = await cancelRequest();
			let cancelMessage = cancelResult.json.success.message;
			expect(cancelMessage).to.be.a('string');
		});

		it('check multiple onFieldChangeRepeat requests running simultaneously', async () => {
			
			//RESET COUNTER
			await odc.setValue({
				base: 'global',
				keyPath: 'repeatingTimerFireCount',
				value: 0,
			});

			//Same args for both requests
			const args = { base: 'global', keyPath: 'repeatingTimerFireCount' } as ODC.BaseKeyPath;
			
			let events1: object[] = [];
			let events2: object[] = [];

			const cancelRequest1 = await odc.onFieldChangeRepeat({ ...args },{timeout:(20*1000)}, (response)=>{
				if(response["json"] != null && response.json["value"]!= null){
					events1.push(response);
				}
				return;
			});
			
			const cancelRequest2 = await odc.onFieldChangeRepeat({ ...args },{timeout:(20*1000)}, (response)=>{
				if(response["json"] != null && response.json["value"]!= null){
					events2.push(response);
				}
				return;
			});

			await utils.sleep(3*1000); //Wait 3 seconds
			expect(events1).to.be.an('array');
			expect(events1).to.not.be.empty;

			let cancelResponse1 = await cancelRequest1();
			let cancelMessage1 = cancelResponse1.json.success.message;
			expect(cancelMessage1).to.be.a('string');

			await utils.sleep(4*1000); //Wait more 3 seconds
			expect(events2).to.be.an('array');
			expect(events2.length).to.be.greaterThan(3); //We expect to have 6

			let cancelResponse2 = await cancelRequest2();
			let cancelMessage2 = cancelResponse2.json.success.message;
			expect(cancelMessage2).to.be.a('string');

		});

	});

	describe('callFunc', function () {
		it('should fail if given invalid keyPath', async () => {
			try {
				await odc.callFunc({ keyPath: 'does.not.exist', funcName: 'trigger' });
			} catch (e) {
				// failed as expected
				return;
			}
			assert.fail('Should have thrown an exception');
		});

		it(`should work with funcs that don't take any arguments`, async () => {
			const args = { base: 'global', keyPath: 'AuthManager.isLoggedIn' } as ODC.BaseKeyPath;
			await setAndVerifyValue({ ...args, value: false });
			await odc.callFunc({ base: 'global', keyPath: 'AuthManager', funcName: 'loginUserNoArgs' });
			const { value } = await odc.getValue(args);
			expect(value).to.be.true;
		});

		it('should work with funcs taking params and has timeTaken as a number', async () => {
			const { value, timeTaken } = await odc.callFunc({ funcName: 'multiplyNumbers', funcParams: [3, 5] });
			expect(value).to.be.equal(15);
			expect(timeTaken).to.be.a('number');
		});
	});

	describe('getComponentGlobalAAKeyPath', function () {
		it(`should return the specified key path`, async () => {
			const { value } = await odc.getComponentGlobalAAKeyPath({
				componentGlobalAAKeyPath: 'testingGetGlobalAA'
			});
			expect(value).to.equal('yup it works');
		});

		it(`should work with the full key path logic`, async () => {
			const { value } = await odc.getComponentGlobalAAKeyPath({
				componentGlobalAAKeyPath: 'top.subtype()'
			});
			expect(value).to.equal('MainScene');
		});

		it(`should return null if value does not exist`, async () => {
			const { value } = await odc.getComponentGlobalAAKeyPath({
				componentGlobalAAKeyPath: 'does.not.exist'
			});
			expect(value).to.be.null;
		});
	});

	describe('setComponentGlobalAAKeyPath', function () {
		it(`should be able to set values at the specified key path`, async () => {
			const keyPath = 'testingGetGlobalAAWrite';
			const randomValue = utils.randomStringGenerator();
			const result = await odc.setComponentGlobalAAKeyPath({
				componentGlobalAAKeyPath: keyPath,
				componentGlobalAAKeyPathValue: randomValue
			});
			expect(result.value).to.be.true;

			const { value } = await odc.getComponentGlobalAAKeyPath({
				componentGlobalAAKeyPath: keyPath
			});

			expect(value).to.equal(randomValue);
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

			await odc.writeRegistry({
				values: {
					[firstSectionName]: {
						[firstKey]: firstKeyValue,
						[secondKey]: secondKeyValue
					},
					[secondSectionName]: {
						[thirdKey]: thirdKeyValue,
						[fourthKey]: fourthKeyValue
					}
				}
			});
		});

		afterEach(async function () {
			await odc.deleteRegistrySections({ sections: [firstSectionName, secondSectionName] });
		});

		describe('registryRead', function () {
			it('should return all registry values if no params passed in', async () => {
				const { values } = await odc.readRegistry();

				const firstSection = values[firstSectionName];
				expect(firstSection[firstKey]).to.equal(firstKeyValue);
				expect(firstSection[secondKey]).to.equal(secondKeyValue);

				const secondSection = values[secondSectionName];
				expect(secondSection[thirdKey]).to.equal(thirdKeyValue);
				expect(secondSection[fourthKey]).to.equal(fourthKeyValue);
			});

			it('should return the requested registry values if arrays provided', async () => {
				const { values } = await odc.readRegistry({
					values: {
						[firstSectionName]: [secondKey],
						[secondSectionName]: [thirdKey, fourthKey]
					}
				});

				const firstSection = values[firstSectionName];
				expect(firstSection[firstKey]).to.be.undefined;
				expect(firstSection[secondKey]).to.equal(secondKeyValue);

				const secondSection = values[secondSectionName];
				expect(secondSection[thirdKey]).to.equal(thirdKeyValue);
				expect(secondSection[fourthKey]).to.equal(fourthKeyValue);
			});

			it('should return the requested registry value if string passed in', async () => {
				const { values } = await odc.readRegistry({
					values: {
						[firstSectionName]: firstKey
					}
				});

				const firstSection = values[firstSectionName];
				expect(firstSection[firstKey]).to.equal(firstKeyValue);
				expect(firstSection[secondKey]).to.be.undefined;

				expect(values[secondSectionName]).to.be.undefined;
			});
		});

		describe('registryWrite', function () {
			it('should successfully be able to write and delete a section field', async () => {
				await odc.writeRegistry({
					values: {
						[firstSectionName]: {
							[firstKey]: firstKeyValue
						}
					}
				});

				const { values } = await odc.readRegistry({
					values: {
						[firstSectionName]: firstKey
					}
				});
				expect(values[firstSectionName][firstKey]).to.be.equal(firstKeyValue);

				await odc.writeRegistry({
					values: {
						[firstSectionName]: {
							[firstKey]: null
						}
					}
				});

				const { values: valuesAfterDelete } = await odc.readRegistry({
					values: {
						[firstSectionName]: firstKey
					}
				});
				expect(valuesAfterDelete[firstSectionName][firstKey]).to.be.undefined;
			});
		});

		describe('deleteRegistrySections', function () {
			it('should delete all values in the specified registry section if string provided', async () => {
				await odc.deleteRegistrySections({ sections: firstSectionName });
				const { values } = await odc.readRegistry({
					values: {
						[firstSectionName]: [],
						[secondSectionName]: []
					}
				});

				const firstSection = values[firstSectionName];
				expect(firstSection[firstKey]).to.be.undefined;
				expect(firstSection[secondKey]).to.be.undefined;

				const secondSection = values[secondSectionName];
				expect(secondSection[thirdKey]).to.equal(thirdKeyValue);
				expect(secondSection[fourthKey]).to.equal(fourthKeyValue);
			});

			it('should delete all values in the specified registry sections if arrays provided', async () => {
				await odc.deleteRegistrySections({ sections: [firstSectionName, secondSectionName] });

				const { values } = await odc.readRegistry({
					values: {
						[firstSectionName]: [],
						[secondSectionName]: []
					}
				});

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
				const { values } = await odc.readRegistry({
					values: {
						[firstSectionName]: [],
						[secondSectionName]: []
					}
				});

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
				const odcConfig = odc['config'];
				if (odcConfig?.OnDeviceComponent) {
					odcConfig.OnDeviceComponent.restoreRegistry = true;
				}

				// This also triggers storing of the current values first
				await odc.deleteEntireRegistry();
				await odc.shutdown();
				if (odcConfig?.OnDeviceComponent) {
					odcConfig.OnDeviceComponent.restoreRegistry = false;
				}
				const { values } = await odc.readRegistry();
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
				const { list } = await odc.getVolumeList();

				for (const volume of standardVolumes) {
					expect(list.includes(volume), `list did not contain '${volume}'`).to.be.true;
				}
			});
		});

		describe('getDirectoryListing', function () {
			it('should return a list of files for the selected directories', async () => {
				let pathsReturned = 0;
				for (const volume of standardVolumes) {
					const { list } = await odc.getDirectoryListing({
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
				const { type } = await odc.statPath({
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
			const { binaryPayload } = await odc.readFile({
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

			const { binaryPayload: actualBinaryPayload } = await odc.readFile({
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

	describe('getApplicationStartTime', function () {
		it('should return an application start time close to current time', async () => {
			const { startTime } = await odc.getApplicationStartTime();

			const currentTime = Date.now();

			expect(startTime).to.be.lessThan(currentTime);
			expect(startTime).to.be.greaterThan(currentTime - 10 * 60 * 1000);
			await odc.getApplicationStartTime();
		});
	});

	describe('edgeCases', function () {
		it('Does not stack overflow if we receive a large number of requests at the same time', async () => {
			const promises = [] as Promise<any>[];
			for (let i = 0; i < 200; i++) {
				const promise = odc.setValue({
					base: 'global',
					keyPath: 'intValue',
					value: i
				});
				promises.push(promise);
			}
			await Promise.all(promises);
		});
	});

	async function setAndVerifyValue(args: { expectedStartingValue?: any } & ODC.SetValueArgs) {
		if (args.expectedStartingValue !== undefined) {
			const { value: actualStartingValue } = await odc.getValue(args);
			expect(actualStartingValue).to.equal(args.expectedStartingValue, `${args.base}.${args.keyPath} did not match expected value before set`);
		}
		const { timeTaken } = await odc.setValue(args);
		const { value: actualValue } = await odc.getValue(args);
		expect(actualValue).to.deep.equal(args.value, `${args.base}.${args.keyPath} did not match expected value after set`);
		expect(timeTaken).to.be.a('number', 'timeTaken was not a number when returned from setValue');
	}
});
