# Roku Test Automation

## Intro

Roku Test Automation (RTA from here on out) helps with automating functional tests for Roku devices. It has quite a bit more capabilities than [Roku's first party option](https://developer.roku.com/docs/developer-program/dev-tools/automated-channel-testing/automated-testing-overview.md) and does not require a Go server in the middle to convert ECP commands.

## Integration

In your project go ahead and install the npm module:

```sh
npm install roku-test-automation --save-dev
```

Once installed, the standard way for using RTA is via the singletons `ecp`, like

```ts
import { ecp, odc, device, utils } from 'roku-test-automation';
```

if you tried to actually use these in your code you would likely get an exception thrown as no config is currently setup.

Currently the only necessary part of the config is at least one device host and password. Here's a sample config you could use as a start:

```json
{
	"RokuDevice": {
		"devices": [{
			"host": "",
			"password": ""
		}]
	},
	"ECP": {
		"default": {
			"launchChannelId": "dev"
		}
	},
	"OnDeviceComponent": {
		"logLevel": "info"
	}
}
```

save that wherever you store config files for your project. Since device host and passwords are specific to you, you should likely also add it to your .gitignore file.

To keep a single config file and aid in running multiple tests at once, RTA reads its config from the environment variable `process.env.rtaConfig`. For a basic setup you can use the helper

```ts
utils.setupEnvironmentFromConfigFile('<PATH-TO-CONFIG-FILE>')
```

 to setup the environment for you. To avoid having to do this in each test file you can setup a global include in your mocha package.json setup like:

 ```json
"mocha": {
	"timeout": 5000,
	"file": [
		"./src/test/include.ts"
	],
	"require": [
		"ts-node/register",
		"source-map-support/register"
	]
}
```

be sure to change the include.ts path to match where you put your include file.

If you're going to use the OnDeviceComponent then there are a number of files that need to be copied over into your app. If you're not using the [BrightScript Extension for VSCode](https://marketplace.visualstudio.com/items?itemName=celsoaf.brightscript) yet then now is a great time to try it out. If you are all you need to is add:

```json
{
"src": [
		"${workspaceFolder}/node_modules/roku-test-automation/dist/device/**/*"
	],
	"dest": "/"
}
```

to your bsconfig.json or launch.json configuration files array. No need to keep the files in sync in the future when you upgrade this module.

If you did this all the steps above correct you should be ready to start making use of RTA's components.

## Components

### **ECP**

RTA contains most of the standard ECP commands including:  

* Launching/deeplinking into a channel
* Sending keypress and keypress sequences to the device
* Sending text to the device
* Getting the current active app

### **OnDeviceComponent**

The core piece of RTA is the OnDeviceComponent. It functions similarly to [Roku's RALE](https://devtools.web.roku.com/roku-advanced-layout-editor/) in that you have a component that is initialized on the device as used in the testProject [here](https://github.com/triwav/roku-test-automation/blob/master/testProject/components/MainScene.brs#L4)  
`m.odc = createObject("RTA_OnDeviceComponent")`  
Once setup you can send requests to the device to either kick off something to check or check whether the expected outcome occurred. The following is list of all current request types:

---

**getValueAtKeyPath(args: [ODCGetValueAtKeyPathArgs](https://github.com/triwav/roku-test-automation/blob/master/server/src/types/OnDeviceComponentRequest.ts#L35), options: [ODCRequestOptions](https://github.com/triwav/roku-test-automation/blob/master/server/src/types/OnDeviceComponentRequest.ts#L84)): {found: boolean, value}**  
At the heart of almost all requests internally is getValueAtKeyPath. It serves as your entry point from which you execute other requests but can also be used by itself to return a requested value. `args` takes two properties:  
**`base`?: string** can be either `global` or `scene`. If not supplied it defaults to `global`  

**`keyPath`: string** builds off of the base and supplies the path to what you are interested in getting the value for. A simple example might be something like `AuthManager.isLoggedIn` which would let you check if a user is logged in or not. It can operate on much more than just keyed type fields though.  

 Array's can access index positions `array.0.id`.  
 Nodes can access their children `node.0.id` as well as find nodes with a given id `node.idOfChildNodeToInspect`.  
 The [getValueAtKeyPath unit tests](https://github.com/triwav/roku-test-automation/blob/master/server/src/OnDeviceComponent.spec.ts#L14) provide a full list of what is possible for a key path

---

 **getValuesAtKeyPaths(args: [ODCGetValuesAtKeyPathsArgs](https://github.com/triwav/roku-test-automation/blob/master/server/src/types/OnDeviceComponentRequest.ts#L40), options: [ODCRequestOptions](https://github.com/triwav/roku-test-automation/blob/master/server/src/types/OnDeviceComponentRequest.ts#L84)): {[key: string], found: boolean}**  
getValuesAtKeyPaths allows you to retrieve multiple values with a single request. It  takes one property for `args`:  
**`requests`: object** A list of the individual getValueAtKeyPath args with a user supplied key that will be returned as the same key for the output object.

The [getValuesAtKeyPaths unit test](https://github.com/triwav/roku-test-automation/blob/master/server/src/OnDeviceComponent.spec.ts#L59) provides an example of its usage

---

**setValueAtKeyPath(args: [ODCSetValueAtKeyPathArgs](https://github.com/triwav/roku-test-automation/blob/master/server/src/types/OnDeviceComponentRequest.ts#L76), options: [ODCRequestOptions](https://github.com/triwav/roku-test-automation/blob/master/server/src/types/OnDeviceComponentRequest.ts#L84)): {}**  
Allows you to set a value at a key path. It takes the standard `base` and `keyPath` properties along with the following for `args`:  
**`value`: any** The value you want to set at the supplied `keyPath`. Setting is always done through [update(value, true)](https://developer.roku.com/docs/references/brightscript/interfaces/ifsgnodechildren.md#updatefields-as-roassociativearray-as-void) so anything you can do there should be possible here as well.

---

**callFunc(args: [ODCCallFuncArgs](https://github.com/triwav/roku-test-automation/blob/master/server/src/types/OnDeviceComponentRequest.ts#L25), options: [ODCRequestOptions](https://github.com/triwav/roku-test-automation/blob/master/server/src/types/OnDeviceComponentRequest.ts#L84)): {value}**  
Allows you to run callFunc on a node. It takes the standard `base` and `keyPath` properties along with the following for `args`:  
**`funcName`: string** the name of the interface function that you want to run  

**`funcParams`?: any[]** an array of params to pass to the function. If not supplied (Invalid) will be passed for the params list.

---

**getFocusedNode(args: [ODCGetFocusedNodeArgs](https://github.com/triwav/roku-test-automation/blob/master/server/src/types/OnDeviceComponentRequest.ts#L33), options: [ODCRequestOptions](https://github.com/triwav/roku-test-automation/blob/master/server/src/types/OnDeviceComponentRequest.ts#L84)): ODCNodeRepresentation**  
Gets the currently focused node. `args` is currently empty but is still included for standardization and future expansion options.

---

**hasFocus(args: [ODCHasFocusArgs](https://github.com/triwav/roku-test-automation/blob/master/server/src/types/OnDeviceComponentRequest.ts#L51), options: [ODCRequestOptions](https://github.com/triwav/roku-test-automation/blob/master/server/src/types/OnDeviceComponentRequest.ts#L84)): boolean**  
Check if the node at the supplied key path has focus or not. It takes the standard `base` and `keyPath` properties.

---

**isInFocusChain(args: [ODCIsInFocusChainArgs](https://github.com/triwav/roku-test-automation/blob/master/server/src/types/OnDeviceComponentRequest.ts#L56), options: [ODCRequestOptions](https://github.com/triwav/roku-test-automation/blob/master/server/src/types/OnDeviceComponentRequest.ts#L84)): boolean**  
Check if the node at the supplied key path is in the focus chain. It takes the standard `base` and `keyPath` properties.

---

**observeField(args: [ODCObserveFieldArgs](https://github.com/triwav/roku-test-automation/blob/master/server/src/types/OnDeviceComponentRequest.ts#L63), options: [ODCRequestOptions](https://github.com/triwav/roku-test-automation/blob/master/server/src/types/OnDeviceComponentRequest.ts#L84)): {observerFired: boolean, value}**  
Instead of having to do an arbitrary delay or polling repeatedly for a field to match an expected value, you can use observeField to setup an observer and be notified when the value changes. It takes the standard `base` and `keyPath` properties along with the following for `args`:  
**`match`?: any | {base, keyPath, value}** sometimes when you are observing a field you don't just want the first change. You're looking for a specific value. In this case you can pass the value you're looking for match. In this case, `base` and `keyPath` are the same as those the base level args. It's even more powerful than that though. You can also supply an object where the value your matching against actually comes from a totally different node than the one being observed.

One note, to simplify writing tests, if `match` is supplied and the value already matches it will not setup an observer but will just return right away. Without this you'd have to write something like:

```ts
const observePromise = odc.observeField(...);
await odc.setValueAtKeyPath(...);
const result = await observePromise;
```

to avoid a race condition that the value already changed by the time you setup your observer. Instead you can write your test like:

```ts
await odc.setValueAtKeyPath(...);
const result = await odc.observeField(...);
```

to help distinguish if the observer actually fired the property `observerFired` is returned in the response object

### **RokuDevice**

Serves as the middle man for ECP requests and provides access to some of the capabilities provided by the Roku's built in web server. Currently only creating and retrieving a screenshot is included. Depending on usage, [roku-deploy](https://www.npmjs.com/package/roku-deploy) may eventually be integrated to offer side load capability as well.

### **utils**

Contains a number of helpers that are mostly used internally but may also be of externally. [Be sure to checkout the file for a full list.](https://github.com/triwav/roku-test-automation/blob/master/server/src/utils.ts). Below are few of the most useful ones for external use:

---

**setupEnvironmentFromConfigFile(configFilePath: string = 'rta-config.json', deviceSelector: {} | number = 0)**  
As mentioned in the integration section, the config needs to be setup in the environment before using some of the components. This takes a path to your config file as its first param and an optional `deviceSelector` param for its second. At its simplest you can give it an array index of the device you want to use. You can also pass an object as well though. If an object is supplied it will go through each key/value supplied and check them against the `properties` object to see if properties match. An example usage of this might that you want to segment your devices as `isLowEndDevice` true|false to allow you to run certain tests on only certain devices. It's user defined so feel free to use it however you'd like.

---

**getMatchingDevices(config: ConfigOptions, deviceSelector: {}): {[key: string]: DeviceConfigOptions}**  
If you're wanting to run multiple tests at the same time then this helper is useful for getting a list of all devices that match your device characteristics so you split it among multiple runners

---

**addRandomPostfix(message: string, length: number = 2)): string**  
A lot of times with that tests it's useful to to append something to it to make sure a string is unique.

---

**sleep(milliseconds: number)**  
While doing arbitrary waiting is almost never needed thanks to `observeField`, there might be some use cases for this.
