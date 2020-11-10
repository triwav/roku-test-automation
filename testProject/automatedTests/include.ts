import { device, odc, utils } from 'roku-test-automation';

before(async () => {
	utils.setupEnvironmentFromConfigFile('../server/rta-config.json');

	console.log('deploying app');
	await device.deploy();
});

after(async function () {
	await odc.shutdown();
});
