sub init()
	m.focusNode = m.top

	m.top.observeField("focusedChild", "onFocusedChildChanged")
end sub

sub onFocusedChildChanged()
	if m.top.hasFocus() then
		setFocus(m.focusNode)
	end if
end sub
