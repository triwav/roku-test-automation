import * as assert from 'assert';
import * as chai from 'chai';

import { RokuDevice } from './RokuDevice';

const expect = chai.expect;

describe('RokuDevice', function () {
	let device: RokuDevice;
	beforeEach(() => {
		device = new RokuDevice('192.168.10.134', '5536');
		device.setProxy('http://192.168.10.40:8888');
	});

	this.timeout(10000);

	describe('sendECP', () => {
		it('should work for POST requests', async () => {
			await device.sendECP('keypress/Home', {}, '');
		});
	});

	describe('getScreenshot', () => {
		it('should work', async () => {
			await device.getScreenshot('output.png');
		});
	});
});
