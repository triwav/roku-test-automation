# Roku Test Automation

- [Intro](#intro)
- [v2.0 Changes](#v20-changes)
- [Integration](#integration)
- [Components](#components)
  - [`ECP`](#ecp)
  - [`OnDeviceComponent`](#ondevicecomponent)
    - [`getValue`](#getvalue)
    - [`getValues`](#getvalues)
    - [`getNodesInfo`](#getnodesinfo)
    - [`setValue`](#setvalue)
    - [`callFunc`](#callfunc)
    - [`getFocusedNode`](#getfocusednode)
    - [`hasFocus`](#hasfocus)
    - [`isInFocusChain`](#isinfocuschain)
    - [`onFieldChangeOnce`](#onfieldchangeonce)
    - [`getNodesWithProperties`](#getnodeswithproperties)
    - [`storeNodeReferences`](#storenodereferences)
    - [`deleteNodeReferences`](#deletenodereferences)
    - [`disableScreenSaver`](#disablescreensaver)
    - [`readRegistry`](#readregistry)
    - [`writeRegistry`](#writeregistry)
    - [`deleteRegistrySections`](#deleteregistrysections)
    - [`deleteEntireRegistry`](#deleteentireregistry)
  - [`RokuDevice`](#rokudevice)
  - [`NetworkProxy`](#networkproxy)
  - [`utils`](#utils)
    - [`setupEnvironmentFromConfigFile`](#setupenvironmentfromconfigfile)
    - [`getMatchingDevices`](#getmatchingdevices)
    - [`addRandomPostfix`](#addrandompostfix)
    - [`sleep`](#sleep)

## Intro

Roku Test Automation (RTA from here on out) helps with automating functional tests for Roku devices. It has quite a bit more capabilities than [Roku's first party option](https://developer.roku.com/docs/developer-program/dev-tools/automated-channel-testing/automated-testing-overview.md) and does not require a Go server in the middle to convert ECP commands.

## v2.0 Changes

Some incompatibility changes were made in v2.0. These include:

- Use of `AtKeyPath` was removed from all functions to shorten function call length
- `observeField()` has been renamed to `onFieldChangeOnce()`
- The default base has been changed from `global` to `scene`. A config value `defaultBase` has been added to the `OnDeviceComponent` config to allow switching this
- `getFocusedNode()` now returns an object like all the ODC commands other than `hasFocus()` and `isInFocusChain()`
- While never documented or designed to be used externally, the `getNodeReferences()` function was removed and replaced with `getNodesInfo`
- `callFunc()` will no longer automatically inject an `invalid` param if a `params` array was not provided.
- `getValues()` now returns each result inside a `results` object to avoid potential variable collision
- In v1.0 server was used to refer to the computer connecting to the Roku device. This is now the client and config settings related to this has been changed to reflect this
- ECPKeys was switched from upper case key names to pascal case key names and `OPTIONS` is now `Option`
- In an effort to provide clarity and to avoid shadowing cases, keys in keyPaths using a findNode selector will need to include a `#` leading character. As an example if you were trying to descend into the first child and then find a child node with an id of `poster` you will now need to have a keyPath of `0.#poster`

v2.0 also includes changing to using TCP sockets for all communication which should simplify setup communicating with Roku devices not on the same local network.

## Integration

In your project go ahead and install the npm module:

```sh
npm install roku-test-automation --save-dev
```

Once installed, the standard way for using RTA is via the singletons like

```ts
import { ecp, odc, device, utils } from 'roku-test-automation';
```

if you tried to actually use these in your code you would likely get an exception thrown as no config is currently setup.

Currently the only necessary part of the config is at least one device host and password. Here's a sample config you could use as a start:

```json
{
  "$schema": "https://raw.githubusercontent.com/triwav/roku-test-automation/master/client/rta-config.schema.json",
  "RokuDevice": {
    "devices": [
      {
        "host": "",
        "password": ""
      }
    ]
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

save that wherever you store config files for your project. Since device host and passwords are specific to you, you should likely also add it to your `.gitignore` file.

To keep a single config file and aid in running multiple tests at once, RTA reads its config from the environment variable `process.env.rtaConfig`. For a basic setup you can use the helper

```ts
utils.setupEnvironmentFromConfigFile('<PATH-TO-CONFIG-FILE>');
```

to setup the environment for you. To avoid having to do this in each test file you can setup a global include in the mocha section of your package.json as demonstrated in [`/testProject/package.json`](./testProject/package.json). Be sure to change the path to match where you put your include file.

If you're going to use the `OnDeviceComponent` then there are a number of files that need to be copied over into your app. If you're not using the [BrightScript Extension for VSCode](https://marketplace.visualstudio.com/items?itemName=celsoaf.brightscript) yet then now is a great time to try it out. If you are all you need to is add:

```json
{
  "src": ["${workspaceFolder}/node_modules/roku-test-automation/dist/device/**/*"],
  "dest": "/"
}
```

to your `bsconfig.json` or `launch.json` configuration files array. No need to keep the files in sync in the future when you upgrade this module.

RTA's RokuDevice also exposes a `deploy()` function for including these files and also turning on a `bs_const` for `ENABLE_RTA` if included in your manifest.

If you did all the steps above correct you should be ready to start making use of RTA's components.

## Components

### `ECP`

RTA contains most of the standard ECP commands including:

- Launching/deeplinking into a channel
- Sending keypress and keypress sequences to the device
- Sending text to the device
- Getting the current active app
- Getting the media player

In addition, with the recent requirement for login and logout scripts, the following methods have been added:  
`startRaspFileCreation`  
`finishRaspFileCreation`  
and a copy of [`utils.sleep`](#sleep) that also includes a pause in your rasp file.

---

### `OnDeviceComponent`

The core piece of RTA is the OnDeviceComponent. It functions similarly to [Roku's RALE](https://devtools.web.roku.com/roku-advanced-layout-editor/) in that you have a component that is initialized on the device as used in the testProject [here](https://github.com/triwav/roku-test-automation/blob/master/testProject/components/MainScene.brs#L4).

```vb
m.odc = createObject("RTA_OnDeviceComponent")
```

Once setup you can send requests to the device to either kick off an event or check whether the expected outcome occurred or both. The following is a list of all current request types:

#### `getValue`

> getValue(args: [ODC.GetValueArgs](./client/src/types/OnDeviceComponentRequest.ts#:~:text=export%20interface%20GetValueArgs), options: [ODC.RequestOptions](./client/src/types/OnDeviceComponentRequest.ts#:~:text=export%20interface%20RequestOptions)): {found: boolean, value}

At the heart of almost all requests internally is `getValue`. It serves as your entry point from which you execute other requests but can also be used by itself to return a requested value. `args` takes two properties:

- `base?: string` can be either `global`, `scene`, `nodeRef` or `focusedNode`. If not supplied it defaults to `global`
- `keyPath: string` builds off of the base and supplies the path to what you are interested in getting the value for. A simple example might be something like `AuthManager.isLoggedIn` which would let you check if a user is logged in or not. It can operate on much more than just keyed type fields though.

Array's can access index positions `array.0.id`. Nodes can access their children `node.0.id` as well as find nodes with a given id `node.idOfChildNodeToInspect`. The [`getValue` unit tests](./client/src/OnDeviceComponent.spec.ts#:~:text=%27getValue%27%2C%20function) provide a full list of what is possible for a key path.

```ts
await odc.getValue({
  base: 'global',
  keyPath: 'AuthManager.isLoggedIn',
});
```

**NOTE** as of v2.0 `keyPath` can also call a number of the Roku Brightscript interface functions on the appropriately typed objects. Currently these include:

- getParent()
- count()
- keys()
- len()
- getChildCount()
- threadinfo()
- getFieldTypes()
- subtype()
- boundingRect()
- localBoundingRect()
- sceneBoundingRect()

as an example:

```ts
await odc.getValue({
  keyPath: '#rowList.boundingRect()',
});
```

As of v2.0 you can now access ArrayGrid children. As an example to access the 3rd item component in the second row you would do:

```ts
await odc.getValue({
  keyPath: '#rowList.1.items.2',
});
```

Notice the special keyword `items` to identify we are accessing an item.

If you wanted to access the row title component for the second row you would do:

```ts
await odc.getValue({
  keyPath: '#rowList.1.title',
});

Again notice the special keyword `title` to identify we are accessing a title component.

For other single level ArrayGrid types like MarkupGrid you can simply do:

```ts
await odc.getValue({
  keyPath: '#markupGrid.1',
});
```

This would retrieve the second item component in the grid.

In addition as of v2.0 `keyPath` is no longer required if just accessing the base node

#### `getValues`

> getValues(args: [ODC.GetValuesArgs](./client/src/types/OnDeviceComponentRequest.ts#:~:text=export%20interface%20GetValuesArgs), options: [ODC.RequestOptions](./client/src/types/OnDeviceComponentRequest.ts#:~:text=export%20interface%20RequestOptions)): {results: {[key: string]: {found: boolean; value?: any; }}, timeTaken: number}

`getValues` allows you to retrieve multiple values with a single request. It takes one property for `args`:

- `requests`: `object` A list of the individual `getValue` args with a user supplied key that will be returned as the same key for the output results object.

The [`getValues` unit test](./client/src/OnDeviceComponent.spec.ts#:~:text=%27getValue%27%2C%20function) provides an example of its usage

#### `getNodesInfo`

> getNodesInfo(args: [ODC.GetNodesInfoArgs](./client/src/types/OnDeviceComponentRequest.ts#:~:text=export%20interface%20GetNodesInfoArgs), options: [ODC.RequestOptions](./client/src/types/OnDeviceComponentRequest.ts#:~:text=export%20interface%20RequestOptions)): results: {[key: string]: {
					subtype: string;
					fields: {
						[key: string]: {
							fieldType: string;
							type: string;
							value: any;
						}
					};
					children: {
						subtype: string;
					}[]
				}
			}

Sometimes it may be necessary to know the type of a field on a node. This is primarily used by the vscode extension for the SceneGraph Inspector but may be useful for external use as well.

#### `setValue`

> setValue(args: [ODC.SetValueArgs](./client/src/types/OnDeviceComponentRequest.ts#:~:text=export%20interface%20SetValueArgs), options: [ODC.RequestOptions](./client/src/types/OnDeviceComponentRequest.ts#:~:text=export%20interface%20RequestOptions)): {timeTaken: number}

Allows you to set a value at a key path. It takes the standard `base` and `keyPath` properties along with the following for `args`:

- `value: any` The value you want to set at the supplied `keyPath`. Setting is always done through [`update(value, true)`](https://developer.roku.com/en-ca/docs/references/brightscript/interfaces/ifsgnodechildren.md#updatefields-as-roassociativearray-addfields-as-boolean-as-void) so anything you can do there should be possible here as well.

```ts
await odc.setValue({
  base: 'global',
  keyPath: 'AuthManager.isLoggedIn',
  value: false,
});
```

#### `callFunc`

> callFunc(args: [ODC.CallFuncArgs](./client/src/types/OnDeviceComponentRequest.ts#:~:text=export%20interface%20CallFuncArgs), options: [ODC.RequestOptions](./client/src/types/OnDeviceComponentRequest.ts#:~:text=export%20interface%20RequestOptions)): {value: any, timeTaken: number}

Allows you to run [`callFunc`](https://developer.roku.com/en-gb/docs/developer-program/core-concepts/handling-application-events.md#functional-fields) on a node. It takes the standard `base` and `keyPath` properties along with the following for `args`:

- `funcName: string` the name of the interface function that you want to run
- `funcParams?: any[]` an array of params to pass to the function.

```ts
await odc.callFunc({
  base: 'global',
  keyPath: 'AuthManager',
  funcName: 'login',
  funcParams: [{ username: 'AzureDiamond', password: 'hunter2' }],
});
```

#### `getFocusedNode`

> getFocusedNode(args: [ODC.GetFocusedNodeArgs](./client/src/types/OnDeviceComponentRequest.ts#:~:text=export%20interface%20GetFocusedNodeArgs), options: [ODC.RequestOptions](./client/src/types/OnDeviceComponentRequest.ts#:~:text=export%20interface%20RequestOptions)): {node: NodeRepresentation, ref?: number, timeTaken: number}

Gets the currently focused node. `args` includes the following:

- `includeRef?: boolean` returns `ref` field in response that can be matched up with `storeNodeReferences` response for determining where we are in the node tree. Be sure to call storeNodeReferences first.
- `key: string` Key that the references were stored on. If one isn't provided we use the automatically generated one

```ts
let focusedNode = await odc.getFocusedNode();
```

#### `hasFocus`

> hasFocus(args: [ODC.HasFocusArgs](./client/src/types/OnDeviceComponentRequest.ts#:~:text=export%20interface%20HasFocusArgs), options: [ODC.RequestOptions](./client/src/types/OnDeviceComponentRequest.ts#:~:text=export%20interface%20RequestOptions)): boolean

Check if the node at the supplied key path has focus or not. It takes the standard `base` and `keyPath` properties.

#### `isInFocusChain`

> isInFocusChain(args: [ODC.IsInFocusChainArgs](./client/src/types/OnDeviceComponentRequest.ts#:~:text=export%20interface%20IsInFocusChainArgs), options: [ODC.RequestOptions](./client/src/types/OnDeviceComponentRequest.ts#:~:text=export%20interface%20RequestOptions)): boolean

Check if the node at the supplied key path is in the focus chain. It takes the standard `base` and `keyPath` properties.

```ts
const isBtnInFocusChain = await odc.isInFocusChain({
  keyPath: '#homePage.#mainButton',
});
```

#### `onFieldChangeOnce`

> onFieldChangeOnce(args: [ODC.OnFieldChangeOnceArgs](./client/src/types/OnDeviceComponentRequest.ts#:~:text=export%20interface%20OnFieldChangeOnceArgs), options: [ODC.RequestOptions](./client/src/types/OnDeviceComponentRequest.ts#:~:text=export%20interface%20RequestOptions)): {observerFired: boolean, value}

Instead of having to do an arbitrary delay or polling repeatedly for a field to match an expected value, you can use onFieldChangeOnce to setup an observer and be notified when the value changes. It takes the standard `base` and `keyPath` properties along with the following for `args`:

- `match?: any | {base, keyPath, value}`

Sometimes when you are observing a field you don't just want the first change. If you're looking for a specific value you can pass it for the match like:

```ts
await odc.onFieldChangeOnce({ keyPath: 'AuthManager.isLoggedIn', match: true });
```

In this case, `base` and `keyPath` for match are the same as those for the base level args. It's even more powerful than that though. You can also supply an object where the value your matching against actually comes from a totally different node than the one being observed.

One note, to simplify writing tests, if `match` is supplied and the value already matches it will not setup an observer but will just return right away. Without this you'd have to write something like:

```ts
const onFieldChangeOncePromise = odc.onFieldChangeOnce(...);
await odc.setValue(...);
const result = await onFieldChangeOncePromise;
```

to avoid a race condition that the value already changed by the time you setup your observer. Instead you can write your test like:

```ts
await odc.setValue(...);
const result = await odc.onFieldChangeOnce(...);
```

to help distinguish if the observer actually fired the property `observerFired` is returned in the response object

#### `getNodesWithProperties`

> getNodesWithProperties(args: [ODC.GetNodesWithPropertiesArgs](./client/src/types/OnDeviceComponentRequest.ts#:~:text=export%20interface%20OnGetNodesWithPropertiesArgs), options: [ODC.RequestOptions](./client/src/types/OnDeviceComponentRequest.ts#:~:text=export%20interface%20RequestOptions)): {nodes: ODC.NodeRepresentation[], nodeRefs, number[]}

If you are trying to find a node but are unsure of where it is in the tree you can use `getNodesWithProperties`. As an example, let's say you wanted to find all nodes with the a text field with the value of `Play Movie` you could do:

```ts
const result = await odc.getNodesWithProperties({
  properties: [{
    value: 'Play Movie',
    field: 'text'
  }]
});
```

You'll notice that `properties` is an array. If more than object is provided then each check will be done one after the other. Only nodes that match all properties will be returned.

By default an equal to check is performed. Let's take the previous case and say we wanted to match anything that just has `Play` in its text field we could do:

```ts
const result = await odc.getNodesWithProperties({
  properties: [{
    value: 'Play',
    operator: 'in',
    field: 'text'
  }]
});
```

There are number of comparison operators that can be used:
'=' | '!=' | '>' | '>=' | '<' | '<=' | 'in' | '!in' | 'equal' | 'notEqual' | 'greaterThan' | 'greaterThanEqualTo' | 'lessThan' | 'lessThanEqualTo'

**NOTE** Not all comparison types can be used on all types. For example `>=` can only be used on number types.

#### `storeNodeReferences`

> storeNodeReferences(args: [ODC.StoreNodeReferencesArgs](./client/src/types/OnDeviceComponentRequest.ts#:~:text=export%20interface%20StoreNodeReferencesArgs), options: [ODC.RequestOptions](./client/src/types/OnDeviceComponentRequest.ts#:~:text=export%20interface%20RequestOptions)): {timeTaken: number}

Creates a list of nodes in the currently running application by traversing the node tree. The returned node indexes can then be used as the base for other functions such as [getValue](#getvalue)

#### `deleteNodeReferences`

> deleteNodeReferences(args: [ODC.DeleteNodeReferencesArgs](./client/src/types/OnDeviceComponentRequest.ts#:~:text=export%20interface%20DeleteNodeReferencesArgs), options: [ODC.RequestOptions](./client/src/types/OnDeviceComponentRequest.ts#:~:text=export%20interface%20RequestOptions)): {timeTaken: number}

Deletes the list of nodes previously stored by [storeNodeReferences](#storeNodeReferences) on the specified key

#### `disableScreenSaver`

> disableScreenSaver(args: [ODC.DisableScreensaverArgs](./client/src/types/OnDeviceComponentRequest.ts#:~:text=export%20interface%20DisableScreensaverArgs), options: [ODC.RequestOptions](./client/src/types/OnDeviceComponentRequest.ts#:~:text=export%20interface%20RequestOptions)): {timeTaken: number}

Allows for disabling the screen saver in the application. While the screen saver is running communication between the on device component and server is not possible. This can help avoid these issues.

#### `readRegistry`

> readRegistry(args: [ODC.ReadRegistryArgs](./client/src/types/OnDeviceComponentRequest.ts#:~:text=export%20interface%20ReadRegistryArgs), options: [ODC.RequestOptions](./client/src/types/OnDeviceComponentRequest.ts#:~:text=export%20interface%20RequestOptions)): {values: { [section: string]: {[sectionItemKey: string]: string}}}

Allows for reading from the registry. If no specific sections are requested then it will return the entire contents of the registry.

#### `writeRegistry`

> writeRegistry(args: [ODC.WriteRegistryArgs](./client/src/types/OnDeviceComponentRequest.ts#:~:text=export%20interface%20WriteRegistryArgs), options: [ODC.RequestOptions](./client/src/types/OnDeviceComponentRequest.ts#:~:text=export%20interface%20RequestOptions))

Allows for writing to the registry. If `null` is passed for a sectionItemKey that key will be deleted. If `null` is passed for a section that entire section will be deleted.

#### `deleteRegistrySections`

> deleteRegistrySections(args: [ODC.DeleteRegistrySectionsArgs](./client/src/types/OnDeviceComponentRequest.ts#:~:text=export%20interface%20DeleteRegistrySectionsArgs), options: [ODC.RequestOptions](./client/src/types/OnDeviceComponentRequest.ts#:~:text=export%20interface%20RequestOptions))

Allows for deleting sections from the registry. Similar functionality can be achieved with `writeRegistry` passing null sections but helps to make it clearer if a mixed model isn't needed.

#### `deleteEntireRegistry`

> deleteEntireRegistry(args: [ODC.DeleteRegistrySectionsArgs](./client/src/types/OnDeviceComponentRequest.ts#:~:text=export%20interface%20DeleteRegistrySectionsArgs), options: [ODC.RequestOptions](./client/src/types/OnDeviceComponentRequest.ts#:~:text=export%20interface%20RequestOptions))

Provides a way to clear out all sections in registry. Uses `deleteRegistrySections` under the hood but makes it clearer what is being done.

---

### `RokuDevice`

Serves as the middle man for ECP requests and provides access to some of the capabilities provided by the Roku's built in web server. Currently creates and retrieves a screenshot as well as provides a helper for deploying.

---

### `NetworkProxy`

This class serves as a wrapper around the [http-network-proxy](https://www.npmjs.com/package/http-network-proxy) npm module. It is still in active development and will change some as testing shows necessary changes. At it's core the idea is to be able to take a [Charles](https://www.charlesproxy.com/) config file and use those same rules in your tests. The following methods are exposed:

- `start(configFilePath: string = 'charlesRewrite.xml')` - sets up the proxy, loads the provided config in and writes to the device's registry to get it ready to proxy requests.
- `stop()` - Used to shutdown the proxy port when you no longer want to proxy. Also sends an ODC request to the device
- `reloadConfig(configFilePath: string = 'charlesRewrite.xml')` - Gives the ability to reload the config without having to stop and restart the entire proxy
- `addBreakPointListener(onProxyRequestCallback: OnProxyRequestCallback)` - Allows you add a callback that will be called for every breakpoint Charles would have run into
- `observeRequest(url: string, onProxyResponseCallback: OnProxyResponseCallback)` - Provides a simplified way of receiving a callback when a url is accessed without needing to create a Charles config file for that case.

---

### `utils`

Contains a number of helpers that are mostly used internally but may also be of externally. [Be sure to checkout the file for a full list](./client/src/utils.ts). Below are few of the most useful ones for external use:

#### `setupEnvironmentFromConfigFile`

> setupEnvironmentFromConfigFile(configFilePath: string = 'rta-config.json', deviceSelector: {} | number = 0)

As mentioned in the integration section, the config needs to be setup in the environment before using some of the components. This takes a path to your config file as its first param and an optional `deviceSelector` param for its second. At its simplest you can give it an array index of the device you want to use. You can also pass an object as well though. If an object is supplied it will go through each key/value supplied and check them against the `properties` object to see if properties match. An example usage of this might that you want to segment your devices as `isLowEndDevice` true|false to allow you to run certain tests on only certain devices. It's user defined so feel free to use it however you'd like.

```ts
import { utils } from 'roku-test-automation';

// ...

utils.setupEnvironmentFromConfigFile('rta-config.json', { isLowEndDevice: true });
```

#### `getMatchingDevices`

> getMatchingDevices(config: ConfigOptions, deviceSelector: {}): {[key: string]: DeviceConfigOptions}

If you're wanting to run multiple tests at the same time then this helper is useful for getting a list of all devices that match your device characteristics so you split it among multiple runners

#### `addRandomPostfix`

> addRandomPostfix(message: string, length: number = 2)): string

A lot of times with tests it's useful to to append something to it to make sure a string is unique for each run/test.

#### `sleep`

> sleep(milliseconds: number)

While doing arbitrary waiting is almost never needed thanks to [`onFieldChangeOnce`](#onFieldChangeOnce), there might be some use cases for this.

```ts
import { utils } from 'roku-test-automation';

// ...

await utils.sleep(2000);
```
