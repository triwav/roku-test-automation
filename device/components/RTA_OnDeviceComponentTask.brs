sub init()
	m.requestHeaderSize = 8 ' 4 byte string payload length and 4 byte binary payload length
	m.port = createObject("roMessagePort")
	m.top.observeFieldScoped("renderThreadResponse", m.port)
	m.top.functionName = "runTaskThread"
	m.top.control = "RUN"
end sub

sub setValidRequestTypes()
	m.validTaskRequestTypes = {
		"readRegistry": {
			"handler": processReadRegistryRequest
		}
		"writeRegistry": {
			"handler": processWriteRegistryRequest
		}
		"deleteRegistrySections": {
			"handler": processDeleteRegistrySectionsRequest
		}
		"getVolumeList": {
			"handler": processGetVolumeListRequest
		}
		"getDirectoryListing": {
			"handler": processGetDirectoryListingRequest
		}
		"statPath": {
			"handler": processStatPathRequest
		}
		"createDirectory": {
			"handler": processCreateDirectoryRequest
		}
		"deleteFile": {
			"handler": processDeleteFileRequest
		}
		"renameFile": {
			"handler": processRenameFileRequest
		}
		"readFile": {
			"handler": processReadFileRequest
		}
		"writeFile": {
			"handler": processWriteFileRequest
		}
		"getApplicationStartTime": {
			"handler": processGetApplicationStartTimeRequest
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

	m.listenSocket = createObject("roStreamSocket")
	m.listenSocketId = m.listenSocket.getID().toStr()
	m.listenSocket.setMessagePort(m.port)
	m.listenSocket.setAddress(address)
	m.listenSocket.notifyReadable(true)
	m.listenSocket.listen(4)
	m.clientSockets = {}

	m.receivingRequests = {}
	m.activeRequests = {}

	while true
		' If you want to waste three days debugging set this back to 0 :|
		message = wait(1000, m.port)
		if message <> Invalid then
			messageType = type(message)
			if messageType = "roSocketEvent" then
				handleSocketEvent(message)
			else if messageType = "roSGNodeEvent" then
				handleNodeEvent(message)
			else
				RTA_logWarn(messageType + " type not handled")
			end if
		end if
	end while
end sub

sub handleSocketEvent(message as Object)
	messageSocketId = message.getSocketID().toStr()

	' If the socketId matches our listen socketId this is a new connection being established
	if messageSocketId = m.listenSocketId then
		if m.listenSocket.isReadable() then
			socket = m.listenSocket.accept()
			if socket = Invalid then
				RTA_logError("Connection accept failed")
			else
				' We setup notification for when the new connection is readable
				socket.notifyReadable(true)
				m.clientSockets[socket.getId().toStr()] = socket
			end if
		end if
	else
		' We are relying on the fact that we will continue to get a roSocketEvent until the buffer is empty instead of recursive code to handle receiving the data
		handleClientSocketEvent(messageSocketId)
	end if
end sub

sub closeSocket(messageSocketId)
	socket = m.clientSockets[messageSocketId]
	socket.close()
	m.clientSockets.delete(messageSocketId)
end sub

sub handleClientSocketEvent(messageSocketId as String)
	socket = m.clientSockets[messageSocketId]
	receivingRequest = m.receivingRequests[messageSocketId]

	if receivingRequest = invalid then
		ba = createObject("roByteArray")
		ba[m.requestHeaderSize - 1] = 0

		' Read our request header to know how big our request is
		received = socket.receive(ba, 0, m.requestHeaderSize)
		if received = 0 then
			closeSocket(messageSocketId)
		else if received = m.requestHeaderSize then
			binaryLength = unpackInt32LE(ba, 4)
			receivingRequest = {
				"stringLength": unpackInt32LE(ba, 0)
				"binaryLength": binaryLength
				"stringPayload": ""
				"binaryPayload": createObject("roByteArray")
				"binaryBytesReceived": 0 ' We use an extra field here as you can't pull part of a roByteArray to another
				"socketId": messageSocketId
			}
			if binaryLength > 0 then
				receivingRequest.binaryPayload[binaryLength - 1] = 0
			end if

			m.receivingRequests[messageSocketId] = receivingRequest
		else
			RTA_logInfo("Received invalid roSocketEvent due to Roku OS 13.0 bug ignoring event")
		end if
	else
		' We don't want to try and do multiple receives during one roSocketEvent as there is always a possibility we only got 8 bytes of data for the header so don't try to load more than the header the first event
		if receiveDataForRequest(receivingRequest, socket) then
			' We've received the whole request so handle it now
			m.receivingRequests.delete(messageSocketId)
			verifyAndHandleRequest(receivingRequest)
		end if
	end if
end sub

sub handleNodeEvent(message)
	fieldName = message.getField()
	if message.getField() = "renderThreadResponse" then
		response = message.getData()
		request = m.activeRequests[response.id]
		if request = invalid then return 'Just to play safe, however it is not supossed to happen
		'If request is of the type onFieldChangeRepeat we do not delete the request from the active ones.
		if request <> invalid and request.json <> invalid and request.json.type <> invalid and request.json.type = "onFieldChangeRepeat" then	
			RTA_logVerbose("Request not deleted from m.activeRequests because is of type onFieldChangeRepeat")
		else
			if request <> invalid and request.json <> invalid and request.json.type <> invalid and request.json.type = "cancelOnFieldChangeRepeat" and m.activeRequests[request.json.args.cancelRequestId] <> invalid then
				RTA_logVerbose("Canceled Request with ID ", request.json.args.cancelRequestId)
				m.activeRequests.delete(request.json.args.cancelRequestId)
			end if
			m.activeRequests.delete(response.id)
		end if
		sendResponseToClient(request, response)
	else
		RTA_logWarn(fieldName + " not handled")
	end if
end sub

' Returns number of bytes remaining in buffer if request was fully received or -1 if more data still needs to be received
function receiveDataForRequest(request as Object, socket as Object) as Boolean
	receivedStringLength = request.stringPayload.len()

	' Check if we are going to receive binary or string data
	if receivedStringLength = request.stringLength then
		' We've already received entire string payload so the rest is the binary payload
		binaryLength = request.binaryLength

		bytesReceived = socket.receive(request.binaryPayload, request.binaryBytesReceived, binaryLength - request.binaryBytesReceived)
		if bytesReceived = 0 then
			closeSocket(request.socketId)
		else if bytesReceived > 0 then
			request.binaryBytesReceived += bytesReceived
		end if

		if binaryLength = request.binaryBytesReceived then
			return true
		end if
	else
		receivedString = socket.receiveStr(request.stringLength - receivedStringLength)
		if receivedString.len() = 0 then
			closeSocket(request.socketId)
		end if
		request.stringPayload += receivedString
		if request.stringPayload.len() = request.stringLength AND request.binaryLength = request.binaryBytesReceived then
			' Doing extra check here to avoid an extra socket event if empty binary request (most are)
			return true
		end if
	end if

	return false
end function


sub verifyAndHandleRequest(request)
	json = parseJson(request.stringPayload)
	if NOT RTA_isAA(json) then
		RTA_logError("Received message did not contain valid request " + request.stringPayload)
		return
	end if
	request.json = json

	requestId = json.id
	if NOT RTA_isNonEmptyString(requestId) then
		RTA_logError("Received message did not have id " + request.stringPayload)
		return
	end if

	requestType = RTA_getStringAtKeyPath(json, "type")

	requestArgs = json.args
	if NOT RTA_isAA(requestArgs) then
		sendBackError(json, "No args supplied for request type '" + requestType + "'")
		return
	end if

	if requestType = "setSettings" then
		setLogLevel(RTA_getStringAtKeyPath(requestArgs, "logLevel"))
	end if

	if m.activeRequests[requestId] <> Invalid then
		RTA_logError("Ignoring request id " + requestId + ". Already received and running")
		return
	end if

	requestTypeConfig = m.validTaskRequestTypes[requestType]
	if requestTypeConfig <> Invalid then
		' If there is a handler, this request type is handled on the task thread
		handler = requestTypeConfig.handler
		if RTA_isFunction(handler) then
			request.timespan = createObject("roTimespan")
			handler(request)
			return
		end if
	end if

	m.activeRequests[requestId] = request
	m.top.renderThreadRequest = json
end sub

sub processReadRegistryRequest(request as Object)
	args = request.json.args
	values = args.values
	if NOT RTA_isAA(values) OR values.isEmpty() then
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

		if RTA_isString(sectionRequestedValues) then
			sectionRequestedValues = [sectionRequestedValues]
		else if NOT RTA_isArray(sectionRequestedValues) OR sectionRequestedValues.isEmpty() then
			sectionRequestedValues = sec.getKeyList()
		end if
		outputValues[section] = sec.readMulti(sectionRequestedValues)
	end for

	sendResponseToClient(request, {
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

	sendResponseToClient(request, {})
end sub

sub processDeleteRegistrySectionsRequest(request as Object)
	args = request.json.args
	registry = createObject("roRegistry")

	sections = args.sections
	if RTA_isString(sections) then
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

	sendResponseToClient(request, {})
end sub

sub processGetVolumeListRequest(request as Object)
	sendResponseToClient(request, {
		"list": createObject("roFileSystem").getVolumeList().toArray()
	})
end sub

sub processGetDirectoryListingRequest(request as Object)
	args = request.json.args
	path = RTA_getStringAtKeyPath(args, "path")
	sendResponseToClient(request, {
		"list": createObject("roFileSystem").getDirectoryListing(path).toArray()
	})
end sub

sub processStatPathRequest(request as Object)
	args = request.json.args
	path = RTA_getStringAtKeyPath(args, "path")
	fs = createObject("roFileSystem")
	if NOT fs.exists(path) then
		sendBackError(request, "No file or directory exists at path: '" + path + "'")
	else
		fileInfo = fs.stat(path)
		' Have to convert the roDateTime to be able to json encode
		fileInfo.ctime = fileInfo.ctime.asSeconds()
		fileInfo.mtime = fileInfo.mtime.asSeconds()
		sendResponseToClient(request, fileInfo)
	end if
end sub

sub processCreateDirectoryRequest(request as Object)
	args = request.json.args
	path = RTA_getStringAtKeyPath(args, "path")
	if createObject("roFileSystem").createDirectory(path) then
		sendResponseToClient(request, {})
	else
		sendBackError(request, "Failed to create directory path: '" + path + "'")
	end if
end sub

sub processDeleteFileRequest(request as Object)
	args = request.json.args
	path = RTA_getStringAtKeyPath(args, "path")

	path = RTA_getStringAtKeyPath(args, "path")
	if createObject("roFileSystem").delete(path) then
		sendResponseToClient(request, {})
	else
		sendBackError(request, "Failed to delete path: '" + path + "'")
	end if
end sub

sub processRenameFileRequest(request as Object)
	args = request.json.args
	fromPath = RTA_getStringAtKeyPath(args, "fromPath")
	toPath = RTA_getStringAtKeyPath(args, "toPath")
	if createObject("roFileSystem").rename(fromPath, toPath) then
		sendResponseToClient(request, {})
	else
		sendBackError(request, "Failed renaming fromPath: '" + fromPath + "' toPath: '" + toPath + "'")
	end if
end sub

sub processReadFileRequest(request as Object)
	args = request.json.args
	path = RTA_getStringAtKeyPath(args, "path")
	ba = createObject("roByteArray")
	if ba.readFile(path) then
		sendResponseToClient(request, {}, ba)
	else
		sendBackError(request, "Failed reading file path: '" + path + "'")
	end if
end sub

sub processWriteFileRequest(request as Object)
	args = request.json.args
	path = RTA_getStringAtKeyPath(args, "path")
	if request.binaryPayload.writeFile(path) then
		sendResponseToClient(request, {})
	else
		sendBackError(request, "Failed writing file path: '" + path + "'")
	end if
end sub

sub processGetApplicationStartTimeRequest(request as Object)
	if m.appManager = Invalid then
		m.appManager = createObject("roAppManager")
	end if

	date = createObject("roDateTime")
	currentTime& = date.asSeconds()
	currentTime& = currentTime& * 1000 + date.getMilliseconds()
	startTimeDifference = m.appManager.getUptime().totalMilliseconds()
	startTime = currentTime& - startTimeDifference

	sendResponseToClient(request, {
		"startTime": startTime
	})
end sub

sub processGetServerHostRequest(request as Object)
	socket = m.clientSockets[request.socketId]
	if socket <> invalid then
		sendResponseToClient(request, {
			"host": socket.getReceivedFromAddress().getHostName()
		})
	end if
end sub

sub sendBackError(request as Object, message as String)
	RTA_logError(message)
	sendResponseToClient(request, RTA_buildErrorResponseObject(message))
end sub

sub sendResponseToClient(request as Object, response as Object, binaryPayloadByteArray = Invalid as Dynamic)
	if request.timespan <> Invalid then
		response["timeTaken"] = request.timespan.totalMilliseconds()
		request.delete("timeTaken")
	end if

	json = request.json
	if response.id = Invalid then
		response.id = json.id
	end if

	stringPayload = formatJson(response)

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

	socket = m.clientSockets[request.socketId]
	bytesRemaining = ba.count()
	currentIndex = 0

	if socket = invalid OR NOT socket.eOK() then
		RTA_logError("Could not send back response for requestType: " + json.type, stringPayload)
		return
	else
		if stringPayload.len() < 1024 then
			RTA_logDebug("Sending back response for requestType: " + json.type, stringPayload)
		else
			RTA_logDebug("Sending back large response (id: " + json.id + ", requestType: " + json.type + ", timeTaken: " + response.timeTaken.toStr() + ")")
		end if
	end if

	while bytesRemaining > 0
		bytesSent = socket.send(ba, currentIndex, bytesRemaining)
		if bytesSent > 0 then
			bytesRemaining -= bytesSent
			currentIndex += bytesSent
		end if

		while socket.getCountSendBuf() > 0
			if NOT socket.eOK() then
				RTA_logError("Failed in the middle of sending requestType: " + json.type, stringPayload)
			end if
			sleep(1)
		end while
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
