sub init()
	m.subchild2 = m.top.findNode("subchild2")
	m.subchild2.setFocus(true)
	m.odc = createObject("roSGNode", "RTA_OnDeviceComponent")
	m.global.addFields({
		"AuthManager": createObject("roSGNode", "AuthManager")
		"booleanValue": true
		"stringValue": "stringValue"
		"intValue": 1
		"arrayValue": [{ "name": "firstItem" }, { "name": "secondItem" }, { "name": "lastItem" }]
	})
end sub

function multiplyNumbers(a as Dynamic, b as Dynamic) as Dynamic
	return a * b
end function
