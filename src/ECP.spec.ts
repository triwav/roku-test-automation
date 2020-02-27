import { ECP } from './ECP';

let ecp: ECP;
beforeEach(() => {
	ecp = new ECP();
});

describe('sendKeyPress', function () {
	ecp.sendKeyPress(ECP.Key.Home);
});
