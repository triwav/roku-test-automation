sub init()
	m.odc = createNode("RTA_OnDeviceComponent")
	m.global.addFields({
		"AuthManager": createNode("AuthManager")
	})
end sub
