import * as utils from '../utils';

after(async function () {
	await utils.shutdownAll();
});
