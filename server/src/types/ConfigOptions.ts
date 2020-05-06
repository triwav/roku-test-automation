export interface ConfigOptions {
	device: DeviceConfigOptions;
	channel?: ChannelConfigOptions;
	server?: ServerConfigOptions;
	defaults?: DefaultConfigOptions;
}

export interface DeviceConfigOptions {
	ip: string;
	password: string;
	debugProxy?: string;
	odc?: {
		logLevel?: 'off' | 'error' | 'warn' | 'info' | 'debug' | 'verbose';
	};
	screenshotFormat?: ScreenshotFormat;
}

export interface ServerConfigOptions {
	callbackListenPort: number;
}

export interface ChannelConfigOptions {
	id: string;
}

export interface DefaultECPConfigOptions {
	keyPressDelay: number;
}

export interface DefaultConfigOptions {
	ecp: DefaultECPConfigOptions;
}

export declare type ScreenshotFormat = 'png' | 'jpg';
