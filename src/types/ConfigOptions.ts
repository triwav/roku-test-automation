export interface ConfigOptions {
	device: DeviceConfigOptions;
	channel?: ChannelConfigOptions;
	defaults?: DefaultConfigOptions;
}

export interface DeviceConfigOptions {
	ip: string;
	password: string;
	proxy?: string;
	screenshotFormat?: ScreenshotFormat;
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
