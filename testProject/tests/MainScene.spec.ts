import * as chai from 'chai';
const expect = chai.expect;

import * as utils from '../../server/src/utils';
const {device, odc, ecp} = utils.setupFromConfigFile();

describe('MainScene', function () {
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
});
