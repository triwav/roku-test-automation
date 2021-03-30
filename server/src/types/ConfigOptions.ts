import { ODC } from './OnDeviceComponentRequest';


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

	/** zero based index of which `devices` index to use. If not provided defaults to 0 */
	deviceIndex?: number;

	/** Useful for debugging port 80 and ECP communication between Roku and server. Use in the format like (127.0.0.1:8888). */
	proxy?: string;
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
	logLevel?: ODC.LogLevels;

	/** Enable debug logging on the server side */
	serverDebugLogging?: boolean;

	/**
	 * Before running any requests will pull the contents of the registry on the device and store it until ODC is shutdown.
	 * At which point it will clear the registry completely and write back the stored registry values that were previously stored.
	 */
	restoreRegistry?: boolean;
}

export interface NetworkProxyOptions {
	/** What port the proxy will run on. If not provided will find one itself */
	port?: number;

	/** Enable debug logging on the server side */
	serverDebugLogging?: boolean;

	/** Useful for visually debugging issues. Use in the format like (http://127.0.0.1:8888). DOES NOT WORK WITH RELATIVE REDIRECTS IN CHARLES!!! */
	forwardProxy?: string;
}
