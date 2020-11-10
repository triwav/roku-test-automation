sub init()
	#if ENABLE_RTA
		m.odc = createObject("roSGNode", "RTA_OnDeviceComponent")
	#end if

	m.top.pagesContainer = m.top.findNode("pagesContainer")

	m.poster = m.top.findNode("poster")

	m.global.addFields({
		"AuthManager": createObject("roSGNode", "AuthManager")
		"booleanValue": true
		"stringValue": "stringValue"
		"intValue": 1
		"arrayValue": [{ "name": "firstItem" }, { "name": "secondItem" }, { "name": "lastItem" }]
		"launchComplete": false
	})

	m.timer = createObject("roSGNode", "Timer")
	m.timer.observeFieldScoped("fire", "onTimerFired")
	m.timer.duration = 1.5
	m.timer.control = "start"

	landingPage = m.top.pagesContainer.createChild("LandingPage")
	setFocus(landingPage)
end sub

sub onTimerFired()
	m.global.launchComplete = true
end sub

function multiplyNumbers(a as Dynamic, b as Dynamic) as Dynamic
	return a * b
end function

function setPosterUrl(url as String) as Dynamic
	m.poster.uri = RTA_injectProxy(url)
end function
