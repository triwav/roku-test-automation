import * as utils from '../src/utils';
const {device, ecp} = utils.setupFromConfigFile();

beforeEach(async function () {
	await ecp.sendKeyPressSequence([ecp.Key.HOME, ecp.Key.HOME]);
	await ecp.sendLaunchChannel();
	// Temporary until we have the on device component to let us know the application is ready to go
	await utils.sleep(3000);
});

describe('Login', function () {
	it('Should login successfully with correct credentials', async () => {
		await ecp.getActiveApp();

		// Navigate to login screen
		await ecp.sendKeyPressSequence([
			ecp.Key.RIGHT,
			ecp.Key.OK,
			ecp.Key.RIGHT,
			ecp.Key.DOWN,
			ecp.Key.OK
		]);

		await ecp.sendText('username');

		// Select next button
		await ecp.sendKeyPressSequence([
			ecp.Key.DOWN,
			ecp.Key.DOWN,
			ecp.Key.DOWN,
			ecp.Key.DOWN,
			ecp.Key.DOWN,
			ecp.Key.OK
		]);

		await ecp.sendText('pass');

		// Select next button
		await ecp.sendKeyPressSequence([
			ecp.Key.DOWN,
			ecp.Key.DOWN,
			ecp.Key.DOWN,
			ecp.Key.DOWN,
			ecp.Key.OK
		]);

		// Login user
		await ecp.sendKeyPress(ecp.Key.OK);

		// Give home page time to load
		await utils.sleep(2000);

		await device.getTestScreenshot(this);
	});
});
