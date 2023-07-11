sub setFocus(node as Object)
	' print m.top.subtype() " " m.top.id " set focus to " node.subtype() " " node.id
	node.setFocus(true)
end sub

sub observeField(node as Object, field as String, callback as String)
	node.observeFieldScoped(field, callback)
end sub

' Application side helper to ease injecting RTA proxy
function injectProxy(url)
	valueType = type(RTA_injectProxy) 'bs:disable-line: 1001
	if (valueType = "roFunction") OR (valueType = "Function") then
		url = RTA_injectProxy(url) 'bs:disable-line: 1001
	else
		print "Proxy was not injected for url '" url "'"
	end if

	return url
end function
