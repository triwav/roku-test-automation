sub init()
	m.testingGetGlobalAA = "yup it works"
	#if ENABLE_RTA
		m.odc = createObject("roSGNode", "RTA_OnDeviceComponent")
	#else
		' vscode_rdb_on_device_component_entry
	#end if

	m.top.pagesContainer = m.top.findNode("pagesContainerGroup")

	m.poster = m.top.findNode("poster")

	loopingNode = createObject("roSGNode", "Group")
	loopingNode.update({
		"loopingNode": loopingNode
	}, true)

	loopNodeChildNode = createObject("roSGNode", "Group")
	loopNodeChildNode.update({
		"aaContainingLoop": {
			"loopingNode": loopNodeChildNode
		}
	}, true)

	loopAASingleChildNode = createObject("roSGNode", "Group")
	loop = {}
	loop["loop"] = loop
	loopAASingleChildNode.update({
		"aaContainingLoop": loop
	}, true)

	loopArraySingleChildNode = createObject("roSGNode", "Group")
	loop = []
	loop.push(loop)
	loopArraySingleChildNode.update({
		"arrayContainingLoop": loop
	}, true)


	loopAAChildNode = createObject("roSGNode", "Group")
	loop = {}
	loop["loop"] = loop
	loopAAChildNode.update({
		"aaContainingLoop": {
			"loop": loop
			"nonLoopingValue": true
		}
	}, true)

	loopArrayChildNode = createObject("roSGNode", "Group")
	loop = []
	loop.push("nonLoopingValue")
	loop.push(loop)
	loopArrayChildNode.update({
		"arrayContainingLoop": loop
	}, true)

	m.global.addFields({
		"AuthManager": createObject("roSGNode", "AuthManager")
		"booleanValue": true
		"stringValue": "stringValue"
		"intValue": 1
		"emptyAAValue": {}
		"arrayValue": [{ "name": "firstItem" }, { "name": "secondItem" }, { "name": "lastItem" }]
		"launchComplete": false,
		"repeatingTimerFireCount": 0
		"loopingNode": loopingNode
		"loopNodeChild": loopNodeChildNode
		"loopAAChild": loopAAChildNode
		"loopArrayChild": loopArrayChildNode
		"loopAASingleChildNode": loopAASingleChildNode
		"loopArraySingleChildNode": loopArraySingleChildNode
	})

	m.timer = createObject("roSGNode", "Timer")
	m.timer.observeFieldScoped("fire", "onTimerFired")
	m.timer.duration = 1.5
	m.timer.control = "start"

	landingPage = m.top.pagesContainer.createChild("LandingPage")
	setFocus(landingPage)

	'To test the onFieldChangeRepeat
	m.repeatingTimer = createObject("roSGNode","Timer")
	m.repeatingTimer.observeFieldScoped("fire", "onRepeatingTimerFired")
	m.repeatingTimer.duration = 1
	m.repeatingTimer.repeat = true
	m.repeatingTimer.control = "start"
end sub

sub onRepeatingTimerFired()
	m.global.repeatingTimerFireCount++
end sub

sub onTimerFired()
	m.global.launchComplete = true
end sub

function multiplyNumbers(a as Dynamic, b as Dynamic) as Dynamic
	return a * b
end function

function setPosterUrl(url as String) as Dynamic
	m.poster.uri = injectProxy(url)
end function
