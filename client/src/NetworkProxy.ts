import type { OnProxyRequestCallback, OnProxyResponseCallback } from 'http-network-proxy';
import { ApplicationRequestProxy } from 'http-network-proxy';
import type { ConfigOptions, OnDeviceComponent} from '.';
import { utils } from '.';

export class NetworkProxy {
	private proxyAddress?: string;
	private config?: ConfigOptions;
	private odc: OnDeviceComponent;

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

	/** Provides a way to get the whole config not just this classes' Config */
	public getRtaConfig() {
		if (!this.config) {
			this.config = utils.getConfigFromEnvironmentOrConfigFile();
		}
		return this.config;
	}

	public getConfig() {
		return this.getRtaConfig()?.NetworkProxy;
	}

	/** Starts the proxy server and reads in the Charles config file and tells the Roku to start sending requests to the proxy server */
	public async start(configFilePath?: string) {
		const {host} = await this.odc.getServerHost();
		const config = this.getConfig();

		ApplicationRequestProxy.forwardProxy = config?.forwardProxy;

		const proxy = await ApplicationRequestProxy.start(config?.port, configFilePath);
		this.debugLog(`Proxy started on port ${proxy.port}`);
		this.proxyAddress = `${host}:${proxy.port}`;
		await this.setRokuProxyAddress(this.proxyAddress);
		return proxy;
	}

	/** Stops requests from being proxied but doesn't shutdown the proxy server */
	public async pause() {
		try {
			return this.setRokuProxyAddress(null);
		} catch(e) {
			await ApplicationRequestProxy.stop();
			throw e;
		}
	}

	/** Starts sending requests through the proxy again after a call to stop() */
	public resume() {
		if (!this.proxyAddress) {
			return utils.makeError('ProxyNotStarted', `Proxy not started yet. Call start() instead`);
		}

		return this.setRokuProxyAddress(this.proxyAddress);
	}

	private async setRokuProxyAddress(proxyAddress: string | null) {
		try {
			return await this.odc.writeRegistry({
				values: {
					rokuTestAutomation: {
						proxyAddress: proxyAddress
					}
				}
			}, {
				timeout: 2000
			});
		} catch(e) {
			await ApplicationRequestProxy.stop();
		}
	}

	public async stop() {
		if (!this.proxyAddress) {
			this.debugLog('Proxy was not running');
			// If we weren't running nothing to stop
			return;
		}
		await this.pause();
		await ApplicationRequestProxy.stop();
		this.debugLog('Proxy stopped');
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

	private debugLog(message: string, ...args) {
		if (this.getConfig()?.clientDebugLogging) {
			console.log(`[NetworkProxy] ${message}`, ...args);
		}
	}
}
