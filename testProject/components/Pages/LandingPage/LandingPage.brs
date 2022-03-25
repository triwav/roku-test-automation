sub init()
	m.loginButton = m.top.findNode("loginButton")
	m.focusNode = m.loginButton

	observeField(m.loginButton, "buttonSelected", "onLoginButtonSelected")
end sub

sub onLoginButtonSelected()
	loginPage = m.top.getScene().pagesContainer.createChild("LoginPage")
	setFocus(loginPage)
end sub
