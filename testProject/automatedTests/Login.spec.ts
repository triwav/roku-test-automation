import { ecp, odc, utils } from 'rOku-test-automation';
import { waitForApplicationLoad } from './common';
import * as chai from 'chai';
const expect = chai.expect;

describe('Login', async function () {
	it('should login a user successfully', async () => {
		await waitForApplicationLoad()

		// Select login button
		await ecp.sendKeypress(ecp.Key.Ok);

		// Select email button
		await ecp.sendKeypress(ecp.Key.Ok);

		await ecp.sendText('bob@hotmail.com')

		// Navigate Down to Ok button and click it
		await ecp.sendKeypressSequence([
			ecp.Key.Down,
			ecp.Key.Down,
			ecp.Key.Down,
			ecp.Key.Down,
			ecp.Key.Ok
		])

		// Navigate Down to password button and click it
		await ecp.sendKeypressSequence([
			ecp.Key.Down,
			ecp.Key.Ok
		])

		await ecp.sendText('12345678')

		// Navigate Down to Ok button and click it
		await ecp.sendKeypressSequence([
			ecp.Key.Down,
			ecp.Key.Down,
			ecp.Key.Down,
			ecp.Key.Down,
			ecp.Key.Ok
		])

		// Navigate Down to submit button and click it
		await ecp.sendKeypressSequence([
			ecp.Key.Down,
			ecp.Key.Ok
		])

		await odc.onFieldChangeOnce({
			base: 'global',
			keyPath: 'AuthManager.isLoggedIn',
			match: true
		});
		const {node} = await odc.getFocusedNode()
		expect(node?.id).to.equal('rowList');
		expect(node?.subtype).to.equal('RowList');
	});
});
