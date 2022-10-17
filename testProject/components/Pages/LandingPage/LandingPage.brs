sub init()
	m.loginButton = m.top.findNode("loginButton")
	m.rowListWithoutCustomTitleComponent = m.top.findNode("rowListWithoutCustomTitleComponent")
	m.rowListWithCustomTitleComponent = m.top.findNode("rowListWithCustomTitleComponent")

	m.rowListWithoutCustomTitleComponent.content = makeRowListContent()
	m.rowListWithCustomTitleComponent.content = makeRowListContent()

	observeField(m.loginButton, "buttonSelected", "onLoginButtonSelected")
end sub

sub onLoginButtonSelected()
	loginPage = m.top.getScene().pagesContainer.createChild("LoginPage")
	setFocus(loginPage)
end sub

function makeRowListContent()
	content = createObject("roSGNode", "ContentNode")
	for rowIndex = 0 to 1
		row = content.createChild("ContentNode")
		row.title = "row " + rowIndex.toStr()
		row.id = row.title
		itemCount = 1
		if rowIndex MOD 2 = 1 then
			itemCount = 8
		end if
		for itemIndex = 0 to itemCount - 1
			item = row.createChild("ContentNode")
			item.title = "row " + rowIndex.toStr() + "  item " + itemIndex.toStr()
			item.id = item.title
		end for
	end for
	return content
end function
