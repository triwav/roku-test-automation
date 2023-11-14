sub init()
	m.label = m.top.findNode("label")
end sub

sub onContentChange(msg)
	content = msg.getData()
	m.label.text = "custom:" + content.title
end sub
