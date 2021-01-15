import { utils } from '../utils';
import { proxy, odc } from '../';
utils.setupEnvironmentFromConfigFile();

after(async function () {
	await proxy.stop();
	await odc.shutdown();
});
