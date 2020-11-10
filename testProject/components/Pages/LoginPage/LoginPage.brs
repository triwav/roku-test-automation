sub init()
	m.EMAIL_DEFAULT_TEXT = "email"
	m.PASSWORD_DEFAULT_TEXT = "password"

	m.layoutGroup = m.top.findNode("layoutGroup")
	m.emailButton = m.top.findNode("emailButton")
	m.passwordButton = m.top.findNode("passwordButton")
	m.submitButton = m.top.findNode("submitButton")

	m.focusNode = m.emailButton
	m.index = 1

	observeField(m.emailButton, "buttonSelected", "onEmailButtonSelected")
	observeField(m.passwordButton, "buttonSelected", "onPasswordButtonSelected")
	observeField(m.submitButton, "buttonSelected", "onSubmitButtonSelected")

	m.emailButton.text = m.EMAIL_DEFAULT_TEXT
	m.passwordButton.text = m.PASSWORD_DEFAULT_TEXT
end sub

sub onDialogButtonSelected(event)
	dialog = event.getRoSGNode()
	dialog.close = true
end sub

sub onEmailButtonSelected()
	dialog = CreateObject("roSgNode", "KeyboardDialog")
	dialog.title = "Enter your email address"
	dialog.buttons = ["OK"]

	observeField(dialog, "wasClosed", "onEmailDialogWasClosed")
	observeField(dialog, "buttonSelected", "onDialogButtonSelected")
	m.top.getScene().dialog = dialog
end sub

sub onEmailDialogWasClosed(event)
	dialog = event.getRoSGNode()
	if dialog.text = "" then
		m.emailButton.text = m.EMAIL_DEFAULT_TEXT
	else
		m.emailButton.text = dialog.text
	end if
end sub

sub onPasswordButtonSelected()
	dialog = CreateObject("roSgNode", "KeyboardDialog")
	dialog.title = "Enter your password"
	dialog.buttons = ["OK"]

	observeField(dialog, "wasClosed", "onPasswordDialogWasClosed")
	observeField(dialog, "buttonSelected", "onDialogButtonSelected")
	m.top.getScene().dialog = dialog
end sub

sub onPasswordDialogWasClosed(event)
	dialog = event.getRoSGNode()
	if dialog.text = "" then
		m.passwordButton.text = m.PASSWORD_DEFAULT_TEXT
	else
		m.passwordButton.text = dialog.text
	end if
end sub

sub onSubmitButtonSelected()
	m.global.authManager.callFunc("loginUser", Invalid)
	homePage = m.top.getScene().pagesContainer.createChild("HomePage")
	setFocus(homePage)
end sub

function onKeyEvent(key as String, press as Boolean) as Boolean
	if press then return false

	if key = "down" AND m.index < 3 then
		m.index++
		setFocus(m.layoutGroup.getChild(m.index))
		return true
	else if key = "up" AND m.index <> 0 then
		m.index--
		setFocus(m.layoutGroup.getChild(m.index))
		return true
	end if
end function
