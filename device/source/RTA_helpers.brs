function RTA_injectProxy(url as String) as String
	sec = createObject("roRegistrySection", "rokuTestAutomation")
	proxyAddress = sec.read("proxyAddress")
	if proxyAddress <> "" then
		url = "http://" + proxyAddress + "/;" + url
	end if
	print "RTA_injectProxy" url
	return url
end function
