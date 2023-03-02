import { utils } from './utils';
export { utils };

import { ECP } from './ECP';
const ecp = new ECP();
export { ECP, ecp };

import { RokuDevice } from './RokuDevice';
const device = new RokuDevice();
export { RokuDevice, device };

import { OnDeviceComponent } from './OnDeviceComponent';
const odc = new OnDeviceComponent(device);
export { OnDeviceComponent, odc };

import { NetworkProxy } from './NetworkProxy';
const proxy = new NetworkProxy(odc);
export { NetworkProxy, proxy };

import { Suitest } from './Suitest';
const suitest = new Suitest(ecp, odc);
export { Suitest, suitest };

export * from './types/ActiveAppResponse';
export * from './types/ConfigOptions';
export * from './types/MediaPlayerResponse';
export * from './types/OnDeviceComponentRequest';
