import * as utils from '../utils';
import { odc } from '../';
utils.setupEnvironmentFromConfigFile();

after(function () {
	odc.shutdown();
});
