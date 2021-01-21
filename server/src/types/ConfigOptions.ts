import { ODCLogLevels } from './OnDeviceComponentRequest';

export enum ConfigBaseKeyEnum {
	ECP,
	NetworkProxy,
	OnDeviceComponent,
	RokuDevice
}
export type ConfigBaseKeyTypes = keyof typeof ConfigBaseKeyEnum;

export interface ConfigOptions {
	/** strictly for schema validation not used internally */
	$schema?: string;
	RokuDevice: RokuDeviceConfigOptions;
	ECP?: ECPConfigOptions;
	OnDeviceComponent?: OnDeviceComponentConfigOptions;
	NetworkProxy?: NetworkProxyOptions;
}

export interface RokuDeviceConfigOptions {
	devices: DeviceConfigOptions[];
	deviceIndex?: number;
}

export interface DeviceConfigOptions {
	/** The IP address or hostname of the target Roku device. */
	host: string;

	/** The password for logging in to the developer portal on the target Roku device */
	password: string;

	/** If not overridden at the call site how long to wait before assuming a request failed */
	defaultTimeout?: number;

	/** Multiplier applied to request timeouts for all requests including those with an explicit value. Can be used in combination with defaultTimeout */
	timeoutMultiplier?: number;

	/** User defined list of properties for this device (name, isLowEnd, etc) */
	properties?: {};

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

export interface OnDeviceComponentConfigOptions {
	/** Device side log output level */
	logLevel?: ODCLogLevels;
	/**
	 * Before running any requests will pull the contents of the registry on the device and store it until ODC is shutdown.
	 * At which point it will clear the registry completely and write back the stored registry values that were previously stored.
	 */
	restoreRegistry?: boolean;
}

export interface NetworkProxyOptions {
	port?: number;

	/** Useful for visually debugging issues. Use in the format like (http://127.0.0.1:8888). DOES NOT WORK WITH RELATIVE REDIRECTS IN CHARLES!!! */
	forwardProxy?: string;
}
