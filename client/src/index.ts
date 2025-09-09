import { utils } from './utils';
export { utils };

import { RokuDevice } from './RokuDevice';
const device = new RokuDevice();
export { RokuDevice, device };

import { ECP } from './ECP';
const ecp = new ECP(device);
export { ECP, ecp };

import { OnDeviceComponent } from './OnDeviceComponent';
const odc = new OnDeviceComponent(device);
export { OnDeviceComponent, odc };

import { NetworkProxy } from './NetworkProxy';
const proxy = new NetworkProxy(odc);
export { NetworkProxy, proxy };

import { Suitest } from './Suitest';
const suitest = new Suitest(ecp, odc);
export { Suitest, suitest };

export * from './types/AppUIResponse';
export * from './types/ActiveAppResponse';
export * from './types/ConfigOptions';
export * from './types/OnDeviceComponent';
export * from './types/MediaPlayerResponse';
