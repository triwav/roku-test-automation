import * as chai from 'chai';
const expect = chai.expect;

import * as utils from '../../server/src/utils';
const {device, odc, ecp} = utils.setupFromConfigFile();

describe('AuthManager', function () {
	it('user should not be logged on load', async () => {
		const value = await odc.getValueAtKeyPath('global', 'authManager.isLoggedIn');
		expect(value).to.eq(false);
	});
});
