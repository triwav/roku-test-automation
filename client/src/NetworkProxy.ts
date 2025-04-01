import * as express from 'express';
import { createProxyMiddleware, responseInterceptor } from 'http-proxy-middleware';
import * as url from 'url';
import type * as http from 'http';
import * as portfinder from 'portfinder';
import type { ConfigOptions, OnDeviceComponent} from '.';
const stoppable = require('stoppable');
import { utils } from '.';

export class NetworkProxy {
	private savedProxyAddress?: string;
	private enabledProxyAddress?: string;
	private config?: ConfigOptions;
	private odc: OnDeviceComponent;
	private server?: http.Server;
	private app = express();
	private callbacks: NetworkProxyCallback[] = [];

	constructor(odc: OnDeviceComponent, config?: ConfigOptions) {
		if (config) {
			this.setConfig(config);
		}
		this.odc = odc;
	}


	public setConfig(config: ConfigOptions) {
		utils.validateRTAConfigSchema(config);
		this.config = config;
	}


	/** Get the full RTA config */
	public getRtaConfig() {
		if (!this.config) {
			this.config = utils.getConfigFromEnvironmentOrConfigFile();
		}
		return this.config;
	}


	/** Get the NetworkProxy config from the full RTA config. */
	public getConfig() {
		return this.getRtaConfig()?.NetworkProxy;
	}


	/** Starts the proxy server and sets the registry on the Roku to start sending requests to the proxy server */
	public async start(proxyPort?: number) {
		const {host} = await this.odc.getServerHost();
		const config = this.getConfig();

		if(!proxyPort) {
			proxyPort = config?.port;

			if (!proxyPort) {
				proxyPort = await portfinder.getPortPromise();
			}

			if (!proxyPort) {
				throw utils.makeError('NetworkProxyOptionsPortNotSet', `NetworkProxyOptions.port not set in config file`);
			}
		}

		const apiProxy = createProxyMiddleware({
			// This value is not used but is mandatory.
			target: '*',
			changeOrigin: true,
			followRedirects: true,
			preserveHeaderKeyCase: true,
			pathRewrite: this.rewritePath.bind(this),
			router: this.rewriteHost.bind(this),
			on: {
				proxyReq: this.onProxyReq.bind(this),
				proxyRes: this.onProxyRes.bind(this),
				error: (err) => {
					this.debugLog('Proxy Error:', err);
					// IMPROVEMENT: In future expose it as a callback.
				}
			},

			// This is required to allow overriding the response body
			selfHandleResponse: true,
		});

		this.server = this.app
			// This lets us see the json body of the request in the proxy middleware
			.use(express.json())
			.use('*', apiProxy)
			.listen(proxyPort);

		// We are using stoppable to avoid getting in a state where a request is still pending but we are done with our test and can't end the script because the server is still running.
		stoppable(this.server, 0);

		const proxyAddress = `${host}:${proxyPort}`;
		this.savedProxyAddress = proxyAddress;
		await this.setRokuProxyAddress(proxyAddress);
		this.debugLog(`Proxy started on ${proxyAddress}`);
	}


	/** Stops requests from being proxied but doesn't shutdown the proxy server */
	public async pause() {
		try {
			await this.setRokuProxyAddress(null);
		} catch(e) {
			await this.stop();
			throw e;
		}
	}


	/** Starts sending requests through the proxy again after a call to pause() */
	public resume() {
		if (!this.savedProxyAddress) {
			throw utils.makeError('ProxyNotStarted', `Proxy not started yet. Call start() instead`);
		}

		return this.setRokuProxyAddress(this.savedProxyAddress);
	}


	/** Used to add callback. Returns a function to allow easily removing afterwards */
	public addCallback(callback: NetworkProxyCallback) {
		this.callbacks.push(callback);

		return () => {
			this.removeCallback(callback);
		};
	}


	private removeCallback(callback: NetworkProxyCallback) {
		const index = this.callbacks.indexOf(callback);
		if (index > -1) {
			this.callbacks.splice(index, 1);
		}
	}


	/** Used to remove all callbacks */
	public removeAllCallbacks() {
		this.callbacks = [];
	}


	private async setRokuProxyAddress(proxyAddress: string | null) {
		try {
			await this.odc.writeRegistry({
				values: {
					rokuTestAutomation: {
						proxyAddress: proxyAddress
					}
				}
			}, {
				timeout: 2000
			});

			if (!proxyAddress) {
				this.enabledProxyAddress = undefined;
			} else {
				this.enabledProxyAddress = proxyAddress;
			}
		} catch(e) {
			await this.stop();
		}
	}


	public async stop() {
		if (!this.enabledProxyAddress) {
			this.debugLog('Proxy was not running');
			// If we weren't running nothing to stop
			return;
		}

		await this.setRokuProxyAddress(null);
		await new Promise((resolve) => {
			if (!this.server) {
				resolve(null);
				return;
			}

			// Added with stoppable so have to call this way as Typescript doesn't know about it.
			this.server['stop']();

			this.server.close(() => {
				resolve(null);
			});

			this.savedProxyAddress = undefined;
		});

		this.debugLog('Proxy stopped');
	}


	private debugLog(message: string, ...args) {
		if (this.getConfig()?.clientDebugLogging) {
			console.log(`[NetworkProxy] ${message}`, ...args);
		}
	}


	/**
	 * Below method is triggered by the middleware helps us to overwrite the host.
	 */
	private rewriteHost(req) {
		const urlParts = url.parse(req.originalUrl.replace('/;', ''));

		// Used to proxy request to Charles for development purposes
		const forwardProxy = this.getConfig()?.forwardProxy;
		if (forwardProxy) {
			const urlParts = url.parse(forwardProxy);
			return {
				host: urlParts.hostname ?? '',
				protocol: urlParts.protocol ?? '',
				port: +(urlParts.port ?? 8888)
			};
		}

		let port: number;
		if (urlParts.port) {
			port = +urlParts.port;
		} else if (urlParts.protocol === 'https:') {
			port = 443;
		} else {
			port = 80;
		}

		return {
			host: urlParts.hostname ?? '',
			protocol: urlParts.protocol ?? '',
			port: port
		};
	}


	/**
	 * Below method is triggered by the middleware that helps us to overwrite the path.
	 */
	private rewritePath(path, req) {
		const urlParts = url.parse(req.originalUrl.replace('/;', ''));
		path = urlParts.path || path;

		// If Charles proxy we want to use the original url instead
		if (this.getConfig()?.forwardProxy) {
			return req.originalUrl;
		}

		return path;
	}


	private getMatchingCallback(args: NetworkProxyCallbackShouldProcessArgs) {
		for (const callback of this.callbacks) {
			if (callback.shouldProcess(args)) {
				return callback;
			}
		}
	}


	private getCommonFields(req: express.Request) {
		const urlParts = url.parse(req.originalUrl.replace('/;', ''), true);

		const fields: Omit<NetworkProxyCallbackShouldProcessArgs, 'req'> = {
			method: req.method,
			protocol: urlParts.protocol ?? '',
			hostname: urlParts.hostname ?? '',
			path: urlParts.path ?? '',
			pathname: urlParts.pathname ?? '',
			query: urlParts.query,
			url: urlParts.href,
			requestBody: req.body
		};

		return fields;
	}


	/**
	 * Callback method triggered when a request is being proxied.
	 * All requests will be go through this method
	 */
	private onProxyReq(proxyReq: http.ClientRequest, req: express.Request, res: express.Response) {
		const args = {
			...this.getCommonFields(req),
			req: req,
			res: res,
			proxyReq: proxyReq
		};

		const callback = this.getMatchingCallback(args);

		if (!callback?.processRequest) {
			return;
		}

		let response = callback.processRequest({
			...args,
			removeCallback: () => {
				this.removeCallback(callback);
			}
		});
		if (response !== undefined) {
			if (typeof response === 'string') {
				response = Buffer.from(response);
			}

			proxyReq.setHeader('Content-Length', response.length);
			proxyReq.write(response);
			proxyReq.end();
		}
	}



	/**
	 * Callback method triggered when a req is been proxied completes.
	 * All requests will be go through this method
	 */
	private async onProxyRes(proxyRes: http.IncomingMessage, req: express.Request, res: express.Response) {
		const matchArgs = {
			...this.getCommonFields(req),
			proxyRes,
			req,
			res
		};

		const callback = this.getMatchingCallback(matchArgs);

		const internalOnProxyRes = responseInterceptor((responseBuffer, proxyRes, req, res) => {
			if (callback?.processResponse) {
				let response = callback?.processResponse({
					...matchArgs,
					responseBuffer: responseBuffer,
					removeCallback: () => {
						this.removeCallback(callback);
					}
				});
				if (response) {
					if (typeof response === 'string') {
						response = Buffer.from(response);
					}

					return Promise.resolve(response);
				}
			}

			// Have to return the initial response if we didn't already return a modified body or else response will not be sent to client
			return Promise.resolve(responseBuffer);
		});
		await internalOnProxyRes(proxyRes, req, res);
	}
}


export interface NetworkProxyCallback {
	/* Return true to signify that this request is handled by this callback. Required in order to trigger `processRequest` and/or `processResponse` to be fired for this specific request */
	shouldProcess: (args: NetworkProxyCallbackShouldProcessArgs) => boolean;

	/* Used to inspect and/or modify request. Return value will be used as the body in the request if provided */
	processRequest?: (args: NetworkProxyCallbackProcessRequestArgs) => Buffer | string | void;

	/* Used to inspect and/or modify response. Return value will be used as the body in the response if provided */
	processResponse?: (args: NetworkProxyCallbackProcessResponseArgs) => Buffer | string | void;
}


export interface NetworkProxyCallbackShouldProcessArgs {
	method: string;
	protocol: string;
	hostname: string;
	pathname: string;
	path: string;
	query?: {
		[key: string]: string[] | string | undefined;
	};
	url: string;
	requestBody?: any;
	req: http.IncomingMessage;
}


export interface NetworkProxyCallbackProcessRequestArgs extends NetworkProxyCallbackShouldProcessArgs {
	proxyReq: http.ClientRequest;
	res: http.ServerResponse;

	/* Allows removing the callback that matched shouldProcess first */
	removeCallback: () => void;
}


export interface NetworkProxyCallbackProcessResponseArgs extends NetworkProxyCallbackShouldProcessArgs {
	responseBuffer: Buffer;
	res: http.ServerResponse;
	proxyRes: http.IncomingMessage;

	/* Allows removing the callback that matched shouldProcess first */
	removeCallback: () => void;
}
