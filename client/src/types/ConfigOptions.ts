import type * as ODC from './OnDeviceComponent';

export interface ConfigOptions {
	/** strictly for schema validation not used internally */
	$schema?: string;
	RokuDevice: RokuDeviceConfigOptions;
	ECP?: ECPConfigOptions;
	OnDeviceComponent?: OnDeviceComponentConfigOptions;
	NetworkProxy?: NetworkProxyOptions;
	Suitest?: SuitestOptions;
}

export interface RokuDeviceConfigOptions {
	devices: DeviceConfigOptions[];

	/** zero based index of which `devices` index to use. If not provided defaults to 0 */
	deviceIndex?: number;

	/** Useful for debugging port 80 and ECP communication between Roku and client. Use in the format like (127.0.0.1:8888). */
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
	properties?: {}; // eslint-disable-line @typescript-eslint/ban-types

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

	/** Enable debug logging on the client side */
	clientDebugLogging?: boolean;

	/** Allows specifying the default base that will be used if one was not provided in the args for a request */
	defaultBase?: ODC.BaseType

	/**
	 * Before running any requests will pull the contents of the registry on the device and store it until ODC is shutdown.
	 * At which point it will clear the registry completely and write back the stored registry values that were previously stored.
	 */
	restoreRegistry?: boolean;

	/** We normally pull the telnet logs if the request timed out. If the telnet connection is already in use then this just adds additional noise in the output */
	disableTelnet?: boolean

	/** We normally try to include the line that the actual ODC call originated from. When not used specifically for testing this isn't needed as much and has a small over head as we have to throw and exception to get the line */
	disableCallOriginationLine?: boolean

	/** The resolution we will use when specifying pixel values. If not specified defaults to `fhd` */
	uiResolution?: 'fhd' | 'hd'
}

export interface NetworkProxyOptions {
	/** What port the proxy will run on. If not provided will find one itself */
	port?: number;

	/** Enable debug logging on the client side */
	clientDebugLogging?: boolean;

	/** Useful for visually debugging issues. Use in the format like (http://127.0.0.1:8888). DOES NOT WORK WITH RELATIVE REDIRECTS IN CHARLES!!! */
	forwardProxy?: string;
}

export interface SuitestOptions {
	/** Path to your application */
	applicationPath?: string;

	/** TokenId for API access as supplied by Suitest */
	tokenId?: string;

	/** Token password for API access as supplied by Suitest */
	tokenPassword?: string;

	/** AppId of the application we're retrieving tests from from Suitest */
	appId?: string

	/** The version of the application we're retrieving for */
	version?: string;
}
