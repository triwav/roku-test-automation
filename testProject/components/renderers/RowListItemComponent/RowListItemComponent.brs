sub init()
	m.title = m.top.findNode("title")
end sub

sub onItemContentChange(msg)
	content = msg.getData()
	m.title.text = content.title
end sub
