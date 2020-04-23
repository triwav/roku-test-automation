import * as chai from 'chai';
const expect = chai.expect;

import * as utils from '../../server/src/utils';
const {device, odc, ecp} = utils.setupFromConfigFile();

describe('MainScene', function () {
	it('should work with findnode', async () => {
		const value = await odc.getValueAtKeyPath('scene', 'testTarget');
		expect(value.id).to.eq('testTarget');
	});

	it('should work with getChild.findNode', async () => {
		const value = await odc.getValueAtKeyPath('scene', '0.subchild3');
		expect(value.id).to.eq('subchild3');
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
		const value = await odc.getValueAtKeyPath('scene', 'testTarget.0.subchild1');
		expect(value.id).to.eq('subchild1');
	});
});
