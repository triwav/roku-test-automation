import * as chai from 'chai';
const expect = chai.expect;
import * as portfinder from 'portfinder';
import * as needle from 'needle';
import type * as http from 'http';
import * as express from 'express';

import { utils } from './utils';
import { ecp, odc, device, proxy } from '.';

describe('NetworkProxy', function () {
	let testServer: http.Server;
	let testServerPort: number;
	let serverReceivedRequest: any;
	let proxyPort: number;

	before(async () => {
		await device.deploy({
			rootDir: '../testProject',
			preventMultipleDeployments: true
		});

		// Set up the test server
		const app = express();
		app.use(express.json());

		app.post('/test', (req, res) => {
			// Capture the request body and headers
			serverReceivedRequest = req;

			res.type('json');
			res.json({ received: true });
		});

		const promise = new Promise((resolve) => {
			testServer = app.listen(0, () => {
				testServerPort = (testServer.address() as any).port;

				resolve(null);
			});
		});

		proxyPort = await portfinder.getPortPromise();
		await Promise.all([promise, proxy.start(proxyPort)]);
	});


	after(async () => {
		await proxy.stop();
		await new Promise((resolve, reject) => {
			if (testServer && testServer.listening) {
				testServer.close((err) => {
					if (!err) {
						resolve(null);
					}

					reject(err);
				});
			} else {
				resolve(null);
			}
		});
	});


	it('should be able to intercept a request off device', async () => {
		const originalRequestBody = {original: true};
		const testUrl = `http://127.0.0.1:${testServerPort}/test?key=value`;

		const removeCallback = proxy.addCallback({
			shouldProcess: (args) => {
				return args.url === testUrl;
			},
			processRequest: ({url, requestBody}) => {
				expect(!!requestBody).to.be.true;
				expect(url).to.equal(testUrl);

				return JSON.stringify({
					...requestBody,
					overrideRequest: true,
				});
			},
			processResponse: ({responseBuffer}) => {
				expect(serverReceivedRequest.body.overrideRequest).to.be.true;

				const serverResponse = JSON.parse(responseBuffer.toString());

				expect(serverResponse.received).to.be.true;

				return JSON.stringify({
					...serverResponse,
					overrideResponse: true
				});
			}
		});

		const options = {
			headers: { 'Content-Type': 'application/json'}
		};

		const promise = needle('post', `http://127.0.0.1:${proxyPort}/;${testUrl}`, JSON.stringify(originalRequestBody), options);
		const response = await utils.promiseTimeout(promise, 2000, 'Did not receive proxy request');

		expect(response.body.received).to.be.true;
		expect(response.body.overrideResponse).to.be.true;
		removeCallback();
	});


	it('should be able to intercept a request on device', async () => {
		let resolve;
		const promise = new Promise((res) => {
			resolve = res;
		});

		const imageHostName = 'picsum.photos';
		const randomQuery = Math.random().toString();
		const imagePath =  '/600/?r=' + randomQuery;
		const imageUrl = `http://${imageHostName}${imagePath}`;

		const removeCallback = proxy.addCallback({
			shouldProcess: ({url}) => {
				return imageUrl === url;
			},
			processRequest: ({url, path, hostname, query}) => {
				expect(hostname).to.equal(imageHostName);
				expect(path).to.equal(imagePath);
				expect(query?.r).to.equal(randomQuery);
				expect(url).to.equal(imageUrl);
			},
			processResponse: () => {
				resolve();
			}
		});

		await odc.callFunc({
			base: 'scene',
			keyPath: '',
			funcName: 'setPosterUrl',
			funcParams: [imageUrl]
		});
		await utils.promiseTimeout(promise, 2000, 'Did not receive proxy request from Roku device');

		removeCallback();
	});
});
