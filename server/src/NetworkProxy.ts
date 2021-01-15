import { ApplicationRequestProxy, OnProxyRequestCallback, OnProxyResponseCallback } from 'http-network-proxy';
import * as portfinder from 'portfinder';
import { ConfigOptions, OnDeviceComponent, utils } from '.';

export class NetworkProxy {
	public port?: number;
	private config?: ConfigOptions;
	private odc: OnDeviceComponent;

	constructor(odc: OnDeviceComponent, config?: ConfigOptions) {
		this.odc = odc;
		this.config = config;
	}

	public getConfig() {
		if (!this.config) {
			const config = utils.getConfigFromEnvironment();
			utils.validateRTAConfigSchema(config);
			this.config = config;
		}
		return this.config?.NetworkProxy;
	}

	public async start(configFilePath?: string) {
		const {host} = await this.odc.getServerHost();
		const config = this.getConfig();

		if (!this.port) {
			if(config?.port) {
				this.port = config.port;
			} else {
				this.port = await portfinder.getPortPromise();
			}
		}
		const proxyAddress = `${host}:${this.port}`;

		await this.odc.writeRegistry({
			values: {
				rokuTestAutomation: {
					proxyAddress: proxyAddress
				}
			}
		});

		if (config?.forwardProxy) {
			ApplicationRequestProxy.forwardProxy = config.forwardProxy;
		}

		return ApplicationRequestProxy.start(this.port, configFilePath);
	}

	public async stop() {
		await this.odc.writeRegistry({
			values: {
				rokuTestAutomation: {
					proxyAddress: null
				}
			}
		});
		return ApplicationRequestProxy.stop();
	}

	public reloadConfig(configFilePath) {
		return ApplicationRequestProxy.reloadConfig(configFilePath);
	}

	public addBreakPointListener(onProxyRequestCallback: OnProxyRequestCallback) {
		return ApplicationRequestProxy.addBreakPointListener(onProxyRequestCallback);
	}

	public observeRequest(url: string, onProxyResponseCallback: OnProxyResponseCallback) {
		return ApplicationRequestProxy.observeRequest(url, onProxyResponseCallback);
	}
}
