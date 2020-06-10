import { ODCLogLevels } from './OnDeviceComponentRequest';

export interface ConfigOptions {
	/** strictly for schema validation not used internally */
	$schema?: string;
	devices: DeviceConfigOptions[];
	deviceIndex?: number;
	ecp?: ECPConfigOptions;
	odc?: ODCConfigOptions;
}

export interface DeviceConfigOptions {
	/** The IP address or hostname of the target Roku device. */
	host: string;

	/** The password for logging in to the developer portal on the target Roku device */
	password: string;

	/** User defined list of properties for this device (name, isLowEnd, etc) */
	properties: {};

	/** Devices default to jpg but if you've changed to png you'll need so supply this */
	screenshotFormat?: 'png' | 'jpg';
}

export interface ECPConfigOptions {
	default?: {
		/** The default keyPressDelay to use if not provided at the call site */
		keyPressDelay?: number;

		/** The default channel id to launch if one isn't passed in */
		launchChannelId?: string;
	};
}

export interface ODCConfigOptions {
	logLevel?: ODCLogLevels;
}
