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
		const section = 'NetworkProxy';
		if (!this.config) {
			const config = utils.getConfigFromEnvironment();
			utils.validateRTAConfigSchema(config, [section]);
			this.config = config;
		}
		const configSection = this.config?.[section];
		return configSection;
	}

	public async start(configFilePath: string = 'charlesRewrite.xml') {
		const {host} = await this.odc.getServerHost();

		if (!this.port) {
			this.port = await portfinder.getPortPromise();
		}
		const proxyAddress = `${host}:${this.port}`;

		await this.odc.writeRegistry({
			values: {
				rokuTestAutomation: {
					proxyAddress: proxyAddress
				}
			}
		});
		return ApplicationRequestProxy.start(this.port, configFilePath);
	}

	public stop() {
		return ApplicationRequestProxy.stop();
	}

	public reloadConfig(configFilePath: string = 'charlesRewrite.xml') {
		return ApplicationRequestProxy.reloadConfig(configFilePath);
	}

	public addBreakPointListener(onProxyRequestCallback: OnProxyRequestCallback) {
		return ApplicationRequestProxy.addBreakPointListener(onProxyRequestCallback);
	}

	public observeRequest(url: string, onProxyResponseCallback: OnProxyResponseCallback) {
		return ApplicationRequestProxy.observeRequest(url, onProxyResponseCallback);
	}
}
