sub init()
	m.subchild2 = m.top.findNode("subchild2")
	m.subchild2.setFocus(true)
	m.odc = createNode("RTA_OnDeviceComponent")
	m.global.addFields({
		"AuthManager": createNode("AuthManager")
		"booleanValue": true
		"stringValue": "stringValue"
		"intValue": 1
	})
end sub

function multiplyNumbers(a as Dynamic, b as Dynamic) as Dynamic
	return a * b
end function
