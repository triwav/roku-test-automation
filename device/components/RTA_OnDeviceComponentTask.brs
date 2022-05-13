sub init()
	m.port = createObject("roMessagePort")
	m.top.observeFieldScoped("renderThreadResponse", m.port)
	m.top.functionName = "runTaskThread"
	m.top.control = "RUN"
end sub

function getVersion() as String
	' TODO update from package.json
	return "1.0.0"
end function

function getCallbackUrl(request as Object) as String
	url = "http://" + request.callbackHost + ":" + request.callbackPort.toStr() + "/callback/" + request.id
	return url
end function

sub runTaskThread()
	m.activeTransfers = {}
	m.validRequestTypes = {
		"callFunc": {}
		"deleteNodeReferences": {}
		"getFocusedNode": {}
		"getNodesInfoAtKeyPaths": {}
		"getValueAtKeyPath": {}
		"getValuesAtKeyPaths": {}
		"hasFocus": {}
		"isInFocusChain": {}
		"observeField": {}
		"setValueAtKeyPath": {}
		"storeNodeReferences": {}
		"disableScreensaver": {}
		"readRegistry": {
			"handler": processReadRegistryRequest
		}
		"writeRegistry": {
			"handler": processWriteRegistryRequest
		}
		"deleteRegistrySections": {
			"handler": processDeleteRegistrySectionsRequest
		}
		"getServerHost": {
			"handler": processGetServerHostRequest
		}
	}

	address = createObject("roSocketAddress")
	address.setPort(9000)

	udpSocket = createObject("roDatagramSocket")
	udpSocketId = stri(udpSocket.getID())
	udpSocket.setMessagePort(m.port)
	udpSocket.setAddress(address)
	udpSocket.notifyReadable(true)
	m.activeRequests = {}

	while true
		' If you want to waste three days debugging set this back to 0 :|
		message = wait(1, m.port)
		if message <> Invalid then
			messageType = type(message)
			if messageType = "roSocketEvent" then
				messageSocketId = stri(message.getSocketID())
				if messageSocketId = udpSocketId
					if udpSocket.isReadable() then
						receivedString = udpSocket.receiveStr(udpSocket.getCountRcvBuf())
						verifyAndHandleRequest(receivedString, udpSocket)
					end if
				else
					logWarn("Received roSocketEvent for unknown socket")
				end if
			else if messageType = "roSGNodeEvent" then
				fieldName = message.getField()
				if message.getField() = "renderThreadResponse" then
					response = message.getData()
					request = m.activeRequests[response.id]
					m.activeRequests.delete(response.id)
					sendBackResponse(request, response)
				else
					logWarn(fieldName + " not handled")
				end if
			else if messageType = "roUrlEvent" then
				id = message.getSourceIdentity().toStr()
				http = m.activeTransfers[id]
				m.activeTransfers.delete(id)
				logDebug("Sent callback to: " + http.getUrl() + " and received response code: " + message.getResponseCode().toStr())
			else
				logWarn(messageType + " type not handled")
			end if
		end if
	end while
end sub

sub verifyAndHandleRequest(receivedString as String, socket as Object)
	request = parseJson(receivedString)
	if NOT isAA(request) then
		logError("Received message did not contain valid request " + receivedString)
		return
	end if

	setLogLevel(getStringAtKeyPath(request, "settings.logLevel"))

	if (NOT isInteger(request.callbackPort)) then
		logError("Received message did not have callbackPort " + receivedString)
		return
	end if

	requestId = request.id
	if (NOT isNonEmptyString(requestId)) then
		logError("Received message did not have id " + receivedString)
		return
	end if

	receiveAddress = socket.getReceivedFromAddress()
	request["callbackHost"] = receiveAddress.getHostName()

	socket.setSendToAddress(receiveAddress)
	bytesSent = socket.sendStr(formatJson({
		"id": requestId
	}))
	if bytesSent = -1 then
		logError("Could not send ack back")
		return
	end if

	componentVersion = getVersion()
	requestVersion = getStringAtKeyPath(request, "version")

	if requestVersion <> componentVersion then
		sendBackError(request, "Request version " + requestVersion + " did not match component version " + componentVersion)
		return
	end if

	if NOT isAA(request.args) then
		sendBackError(request, "No args supplied for request type '" + requestType + "'")
		return
	end if

	requestType = getStringAtKeyPath(request, "type")
	requestConfig = m.validRequestTypes[requestType]
	if requestConfig <> Invalid then
		handler = requestConfig.handler
		if isFunction(handler) then
			handler(request)
			return
		end if

		requestId = request.id

		if m.activeRequests[requestId] <> Invalid then
			logVerbose("Ignoring request id " + requestId + ". Already received and running")
			return
		end if

		m.activeRequests[request.id] = request
		m.top.renderThreadRequest = request
	else
		sendBackError(request, "request type '" + requestType + "' not currently handled")
	end if
end sub

sub processReadRegistryRequest(request as Object)
	args = request.args
	values = args.values
	if NOT isAA(values) OR values.isEmpty() then
		sections = createObject("roRegistry").getSectionList()
		values = {}
		for each section in sections
			values[section] = {}
		end for
	end if

	outputValues = {}
	for each section in values
		sec = createObject("roRegistrySection", section)
		if sec = Invalid then
			sendBackError(request, "Could not create registry section '" + section + "'")
			return
		end if
		sectionRequestedValues = values[section]

		if isString(sectionRequestedValues) then
			sectionRequestedValues = [sectionRequestedValues]
		else if NOT isArray(sectionRequestedValues) OR sectionRequestedValues.isEmpty()
			sectionRequestedValues = sec.getKeyList()
		end if
		outputValues[section] = sec.readMulti(sectionRequestedValues)
	end for

	sendBackResponse(request, {
		"values": outputValues
	})
end sub

sub processWriteRegistryRequest(request as Object)
	args = request.args
	values = args.values
	for each section in values
		sec = createObject("roRegistrySection", section)
		if sec = Invalid then
			sendBackError(request, "Could not create registry section '" + section + "'")
			return
		end if

		' Have to clear out null values or it will cause the write to fail
		sectionItemKeys = values[section]
		for each key in sectionItemKeys
			if sectionItemKeys[key] = Invalid
				sec.delete(key)
				sectionItemKeys.delete(key)
			end if
		end for

		sectionValues = values[section]

		if NOT sectionValues.isEmpty() AND NOT sec.writeMulti(sectionValues) then
			sendBackError(request, "Could not write values for registry section '" + section + "'")
			return
		end if
	end for

	if NOT createObject("roRegistry").flush() then
		sendBackError(request, "Failed flushing registry")
		return
	end if

	sendBackResponse(request, {})
end sub

sub processDeleteRegistrySectionsRequest(request as Object)
	args = request.args
	registry = createObject("roRegistry")

	sections = args.sections
	if isString(sections) then
		sections = [sections]
	end if

	if sections.isEmpty() then
		if args.allowEntireRegistryDelete then
			sections = registry.getSectionList()
		else
			sendBackError(request, "Delete request did not pass in any sections")
		end if
	end if

	for each section in sections
		if NOT registry.delete(section) then
			sendBackError(request, "Failed deleting registry section '" + section + "'")
			return
		end if
	end for

	if NOT registry.flush() then
		sendBackError(request, "Failed flushing registry")
		return
	end if

	sendBackResponse(request, {})
end sub

sub processGetServerHostRequest(request as Object)
	sendBackResponse(request, {
		"host": request.callbackHost
	})
end sub

sub sendBackError(request as Object, message as String)
	logError(message)
	sendBackResponse(request, buildErrorResponseObject(message))
end sub

sub sendBackResponse(request as Object, response as Dynamic)
	if NOT isBoolean(response.success) then response.success = true
	response["requestType"] = request.type
	formattedResponse = formatJson(response)

	callbackUrl = getCallbackUrl(request)
	http = createObject("roUrlTransfer")
	http.setUrl(callbackUrl)
	http.setPort(m.port)
	http.addHeader("Content-Type", "application/json")
	logDebug("Sending callback to: " + callbackUrl + " with body: ", formattedResponse)
	if NOT http.asyncPostFromString(formattedResponse) then
		logError("Could not send callback")
	end if
	m.activeTransfers[http.getIdentity().toStr()] = http
end sub
