import * as utils from './utils';
export { utils };

import { ECP } from './ECP';
const ecp = new ECP();
export { ECP, ecp };

import { OnDeviceComponent } from './OnDeviceComponent';
const odc = new OnDeviceComponent();
export { OnDeviceComponent, odc };

import { RokuDevice } from './RokuDevice';
const device = new RokuDevice();
export { RokuDevice, device };

export * from './types/ActiveAppResponse';
export * from './types/ConfigOptions';
export * from './types/ECPKeys';
export * from './types/OnDeviceComponentRequest';
