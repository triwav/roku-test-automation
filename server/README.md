# Roku Test Automation Client Library
> Client Side Component of the roku automation test framework.

## Installation

OS X & Linux:

```sh
npm install roku-test-automation --save
```

## Usage example
await ecp.sendKeyPressSequence([ecp.Key.HOME, ecp.Key.HOME]);
await ecp.sendLaunchChannel();
await ecp.sendText('username');