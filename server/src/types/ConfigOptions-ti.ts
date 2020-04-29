/**
 * This module was automatically generated by `ts-interface-builder`
 */
import * as t from "ts-interface-checker";
// tslint:disable:object-literal-key-quotes

export const ConfigOptions = t.iface([], {
  "device": "DeviceConfigOptions",
  "channel": t.opt("ChannelConfigOptions"),
  "server": t.opt("ServerConfigOptions"),
  "defaults": t.opt("DefaultConfigOptions"),
});

export const DeviceConfigOptions = t.iface([], {
  "ip": "string",
  "password": "string",
  "debugProxy": t.opt("string"),
  "screenshotFormat": t.opt("ScreenshotFormat"),
});

export const ServerConfigOptions = t.iface([], {
  "callbackListenPort": "number",
});

export const ChannelConfigOptions = t.iface([], {
  "id": "string",
});

export const DefaultECPConfigOptions = t.iface([], {
  "keyPressDelay": "number",
});

export const DefaultConfigOptions = t.iface([], {
  "ecp": "DefaultECPConfigOptions",
});

export const ScreenshotFormat = t.union(t.lit('png'), t.lit('jpg'));

const exportedTypeSuite: t.ITypeSuite = {
  ConfigOptions,
  DeviceConfigOptions,
  ServerConfigOptions,
  ChannelConfigOptions,
  DefaultECPConfigOptions,
  DefaultConfigOptions,
  ScreenshotFormat,
};
export default exportedTypeSuite;