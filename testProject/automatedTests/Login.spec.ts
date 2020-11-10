import { ecp, odc, utils } from 'roku-test-automation';
import { waitForApplicationLoad } from './common';
import * as chai from 'chai';
const expect = chai.expect;

describe('Login', async function () {
	it('should login a user successfully', async () => {
		await waitForApplicationLoad()

		// Select login button
		await ecp.sendKeyPress(ecp.Key.OK);

		// Select email button
		await ecp.sendKeyPress(ecp.Key.OK);

		await ecp.sendText('bfleighty@gmail.com')

		// Navigate down to OK button and click it
		await ecp.sendKeyPressSequence([
			ecp.Key.DOWN,
			ecp.Key.DOWN,
			ecp.Key.DOWN,
			ecp.Key.DOWN,
			ecp.Key.OK
		])

		// Navigate down to password button and click it
		await ecp.sendKeyPressSequence([
			ecp.Key.DOWN,
			ecp.Key.OK
		])

		await ecp.sendText('12345678')

		// Navigate down to OK button and click it
		await ecp.sendKeyPressSequence([
			ecp.Key.DOWN,
			ecp.Key.DOWN,
			ecp.Key.DOWN,
			ecp.Key.DOWN,
			ecp.Key.OK
		])

		// Navigate down to submit button and click it
		await ecp.sendKeyPressSequence([
			ecp.Key.DOWN,
			ecp.Key.OK
		])

		await odc.observeField({keyPath: 'AuthManager.isLoggedIn', match: true});
		const node = await odc.getFocusedNode()
		expect(node.id).to.equal('rowList');
		expect(node.subtype).to.equal('RowList');
	});
});
