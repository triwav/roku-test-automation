import { utils } from '../utils';
import { proxy, odc } from '../';
utils.setupEnvironmentFromConfigFile(undefined, 0);
// const wtf = require('wtfnode');

process.on('unhandledRejection', (reason) => {
	console.error(reason);
	process.exit(1);
});

after(async function () {
	await proxy.stop();
	await odc.shutdown();
	// console.log(wtf.dump());
});
