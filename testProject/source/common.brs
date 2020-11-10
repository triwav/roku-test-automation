sub setFocus(node as Object)
	' print m.top.subtype() " " m.top.id " set focus to " node.subtype() " " node.id
	node.setFocus(true)
end sub

sub observeField(node as Object, field as String, callback as String)
	node.observeFieldScoped(field, callback)
end sub
