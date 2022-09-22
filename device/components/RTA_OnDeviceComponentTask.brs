sub init()
	m.requestHeaderSize = 8 ' 4 byte string payload length and 4 byte binary payload length
	m.port = createObject("roMessagePort")
	m.top.observeFieldScoped("renderThreadResponse", m.port)
	m.top.functionName = "runTaskThread"
	m.top.control = "RUN"
	m.i = 0
end sub

sub setValidRequestTypes()
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
		"focusNodeAtKeyPath": {}
		"readRegistry": {
			"handler": processReadRegistryRequest
		}
		"writeRegistry": {
			"handler": processWriteRegistryRequest
		}
		"deleteRegistrySections": {
			"handler": processDeleteRegistrySectionsRequest
		}
		"fileSystemGetVolumeList": {
			"handler": processFileSystemGetVolumeListRequest
		}
		"fileSystemGetDirectoryListing": {
			"handler": processFileSystemGetDirectoryListingRequest
		}
		"fileSystemStat": {
			"handler": processFileSystemStatRequest
		}
		"fileSystemCreateDirectory": {
			"handler": processFileSystemCreateDirectoryRequest
		}
		"fileSystemDelete": {
			"handler": processFileSystemDeleteRequest
		}
		"fileSystemRename": {
			"handler": processFileSystemRenameRequest
		}
		"readFile": {
			"handler": processReadFileRequest
		}
		"writeFile": {
			"handler": processWriteFileRequest
		}
		"getServerHost": {
			"handler": processGetServerHostRequest
		}
	}
end sub

sub runTaskThread()
	setValidRequestTypes()

	address = createObject("roSocketAddress")
	address.setPort(9000)

	listenSocket = createObject("roStreamSocket")
	listenSocketId = listenSocket.getID().toStr()
	listenSocket.setMessagePort(m.port)
	listenSocket.setAddress(address)
	listenSocket.notifyReadable(true)
	listenSocket.listen(4)
	m.clientSockets = {}

	receivingRequests = {}
	m.activeRequests = {}

	while true
		' If you want to waste three days debugging set this back to 0 :|
		message = wait(1000, m.port)
		if message <> Invalid then
			messageType = type(message)
			if messageType = "roSocketEvent" then
				messageSocketId = message.getSocketID().toStr()
				if messageSocketId = listenSocketId then
					if listenSocket.isReadable() then
						clientSocket = listenSocket.accept()
						if clientSocket = Invalid then
							logError("Connection accept failed")
						else
							clientSocket.notifyReadable(true)
							m.clientSockets[clientSocket.getID().toStr()] = clientSocket
						end if
					end if
				else
					clientSocket = m.clientSockets[messageSocketId]
					bufferLength = clientSocket.getCountRcvBuf()
					if bufferLength > 0 then
						receivingRequest = receivingRequests[messageSocketId]
						if receivingRequest <> invalid then
							' This is an existing request and we're now receiving more info for it
							if receiveDataForRequest(receivingRequest, bufferLength) then
								receivingRequests.delete(messageSocketId)
								verifyAndHandleRequest(receivingRequest)
							end if
						else
							ba = createObject("roByteArray")
							ba[m.requestHeaderSize - 1] = 0

							' Read our request header to know how big our request is
							clientSocket.receive(ba, 0, m.requestHeaderSize)
							bufferLength -= m.requestHeaderSize
							receivingRequest = {
								"stringLength": unpackInt32LE(ba, 0)
								"binaryLength": unpackInt32LE(ba, 4)
								"stringPayload": ""
								"binaryPayload": createObject("roByteArray")
								"socket": clientSocket
							}
							receivingRequests[messageSocketId] = receivingRequest

							if bufferLength > 0 AND receiveDataForRequest(receivingRequest, bufferLength) then
								receivingRequests.delete(messageSocketId)
								verifyAndHandleRequest(receivingRequest)
							end if
						end if
					else
						logInfo("Client closed connection")
						clientSocket.close()
						m.clientSockets.delete(messageSocketId)
					end if
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
			else
				logWarn(messageType + " type not handled")
			end if
		end if
	end while
end sub

function receiveDataForRequest(request as Object, bufferLength as Integer) as Boolean
	socket = request.socket
	' Check if we are going to receive binary or string data
	if request.stringPayload.len() = request.stringLength then
		if bufferLength > 0 then
			ba = createObject("roByteArray")
			ba[bufferLength - 1] = 0
			socket.receive(ba, 0, bufferLength)
			request.binaryPayload.append(ba)
		end if

		if request.binaryLength = request.binaryPayload.count() then
			return true
		end if
		return false
	else
		' Figure out amount to pull from the buffer for string
		if bufferLength > request.stringLength then
			receiveLength = request.stringLength
		else
			receiveLength = bufferLength
		end if
		request["stringPayload"] += socket.receiveStr(receiveLength)
		bufferLength -= receiveLength
		return receiveDataForRequest(request, bufferLength)
	end if
end function


sub verifyAndHandleRequest(request)
	json = parseJson(request.stringPayload)
	if NOT isAA(json) then
		logError("Received message did not contain valid request " + request.stringPayload)
		return
	end if
	request.json = json

	requestId = json.id
	if NOT isNonEmptyString(requestId) then
		logError("Received message did not have id " + request.stringPayload)
		return
	end if

	' TODO look into changing how we do this to avoid overhead associated
	setLogLevel(getStringAtKeyPath(json, "settings.logLevel"))

	requestType = getStringAtKeyPath(json, "type")
	if NOT isAA(json.args) then
		sendBackError(json, "No args supplied for request type '" + requestType + "'")
		return
	end if

	requestTypeConfig = m.validRequestTypes[requestType]
	if requestTypeConfig <> Invalid then
		' If there is a handler this request type is handled on the task thread
		handler = requestTypeConfig.handler
		if isFunction(handler) then
			handler(request)
			return
		end if

		if m.activeRequests[requestId] <> Invalid then
			logError("Ignoring request id " + requestId + ". Already received and running")
			return
		end if

		m.activeRequests[requestId] = request
		m.top.renderThreadRequest = json
	else
		sendBackError(request, "request type '" + requestType + "' not currently handled")
	end if
end sub

sub processReadRegistryRequest(request as Object)
	args = request.json.args
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
		else if NOT isArray(sectionRequestedValues) OR sectionRequestedValues.isEmpty() then
			sectionRequestedValues = sec.getKeyList()
		end if
		outputValues[section] = sec.readMulti(sectionRequestedValues)
	end for

	sendBackResponse(request, {
		"values": outputValues
	})
end sub

sub processWriteRegistryRequest(request as Object)
	args = request.json.args
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
			if sectionItemKeys[key] = Invalid then
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
	args = request.json.args
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

sub processFileSystemGetVolumeListRequest(request as Object)
	sendBackResponse(request, {
		"list": createObject("roFileSystem").getVolumeList().toArray()
	})
end sub

sub processFileSystemGetDirectoryListingRequest(request as Object)
	args = request.json.args
	path = getStringAtKeyPath(args, "path")
	sendBackResponse(request, {
		"list": createObject("roFileSystem").getDirectoryListing(path).toArray()
	})
end sub

sub processFileSystemStatRequest(request as Object)
	args = request.json.args
	path = getStringAtKeyPath(args, "path")
	fs = createObject("roFileSystem")
	if NOT fs.exists(path) then
		sendBackError(request, "No file or directory exists at path: '" + path + "'")
	else
		fileInfo = fs.stat(path)
		' Have to convert the roDateTime to be able to json encode
		fileInfo.ctime = fileInfo.ctime.asSeconds()
		fileInfo.mtime = fileInfo.mtime.asSeconds()
		sendBackResponse(request, fileInfo)
	end if
end sub

sub processFileSystemCreateDirectoryRequest(request as Object)
	args = request.json.args
	path = getStringAtKeyPath(args, "path")
	if createObject("roFileSystem").createDirectory(path) then
		sendBackResponse(request, {})
	else
		sendBackError(request, "Failed to create directory path: '" + path + "'")
	end if
end sub

sub processFileSystemDeleteRequest(request as Object)
	args = request.json.args
	path = getStringAtKeyPath(args, "path")

	path = getStringAtKeyPath(args, "path")
	if createObject("roFileSystem").delete(path) then
		sendBackResponse(request, {})
	else
		sendBackError(request, "Failed to delete path: '" + path + "'")
	end if
end sub

sub processFileSystemRenameRequest(request as Object)
	args = request.json.args
	fromPath = getStringAtKeyPath(args, "fromPath")
	toPath = getStringAtKeyPath(args, "toPath")
	if createObject("roFileSystem").rename(fromPath, toPath) then
		sendBackResponse(request, {})
	else
		sendBackError(request, "Failed renaming fromPath: '" + fromPath + "' toPath: '" + toPath + "'")
	end if
end sub

sub processReadFileRequest(request as Object)
	args = request.json.args
	path = getStringAtKeyPath(args, "path")
	ba = createObject("roByteArray")
	if ba.readFile(path) then
		sendBackResponse(request, {}, ba)
	else
		sendBackError(request, "Failed reading file path: '" + path + "'")
	end if
end sub

sub processWriteFileRequest(request as Object)
	args = request.json.args
	path = getStringAtKeyPath(args, "path")
	if request.binaryPayload.writeFile(path) then
		sendBackResponse(request, {})
	else
		sendBackError(request, "Failed writing file path: '" + path + "'")
	end if
end sub

sub processGetServerHostRequest(request as Object)
	sendBackResponse(request, {
		"host": request.socket.getReceivedFromAddress().getHostName()
	})
end sub

sub sendBackError(request as Object, message as String)
	logError(message)
	sendBackResponse(request, buildErrorResponseObject(message))
end sub

sub sendBackResponse(request as Object, response as Object, binaryPayloadByteArray = Invalid as Dynamic)
	if NOT isBoolean(response.success) then response.success = true

	json = request.json
	if response.id = Invalid then
		response.id = json.id
	end if

	response["requestType"] = json.type  ' TODO See if we can't work around sending this for performance
	stringPayload = formatJson(response)
	logDebug("Sending back response: " + stringPayload)

	ba = createObject("roByteArray")
	ba[m.requestHeaderSize - 1] = 0
	packInt32LE(ba, 0, stringPayload.len())

	stringPayloadByteArray = createObject("roByteArray")
	stringPayloadByteArray.fromAsciiString(stringPayload)

	' In the same way we combine our buffers on the node side we're combining our byte arrays here to avoid potential added latency
	ba.append(stringPayloadByteArray)

	if binaryPayloadByteArray <> Invalid then
		packInt32LE(ba, 4, binaryPayloadByteArray.count())
		ba.append(binaryPayloadByteArray)
	end if

	socket = request.socket
	bytesRemaining = ba.count()
	currentIndex = 0
	while bytesRemaining > 0
		bytesSent = socket.send(ba, currentIndex, bytesRemaining)
		if bytesSent = -1 then
			sleep(1)
		else
			bytesRemaining -= bytesSent
			currentIndex += bytesSent
		end if
	end while
end sub

function unpackInt32LE(ba as Object, offset as Integer) as Integer
	value = ba[offset]
	value += ba[offset + 1] << 8
	value += ba[offset + 2] << 16
	value += ba[offset + 3] << 24
	return value
end function

sub packInt32LE(ba as Object, offset as Integer, value as Integer)
	ba[offset] = value AND 255
	ba[offset + 1] = value >> 8 AND 255
	ba[offset + 2] = value >> 16 AND 255
	ba[offset + 3] = value >> 24 AND 255
end sub
