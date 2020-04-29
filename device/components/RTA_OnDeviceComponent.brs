sub init()
	m.task = createNode("RTA_OnDeviceComponentTask")
	m.task.observeField("renderThreadRequest", "onRenderThreadRequestChange")
	m.task.control = "RUN"
end sub

sub onRenderThreadRequestChange(event as Object)
	request = event.getData()
	requestType = request.type
	args = request.args
	if requestType = "getValueAtKeyPath" then
		response = processGetValueAtKeyPathRequest(args)
	else if requestType = "getValuesAtKeyPaths" then
		response = processGetValuesAtKeyPathsRequest(args)
	end if
	sendBackResponse(request, response)
end sub

function processGetValueAtKeyPathRequest(args as Object) as Object
	baseType = args.base
	if NOT isString(baseType) then
		return buildErrorResponseObject("getValueAtKeyPath had invalid base")
	end if

	if baseType = "global" then
		base = m.global
	else if baseType = "scene" then
		base = m.top.getScene()
	else
		return buildErrorResponseObject("getValueAtKeyPath could not handle base type of '" + baseType + "'")
	end if

	keyPath = args.keyPath
	if NOT isNonEmptyString(keyPath) then
		return buildErrorResponseObject("getValueAtKeyPath had invalid keyPath")
	end if
	value = getValueAtKeyPath(base, keyPath, "[[getValueAtKeyPath:VALUE_NOT_FOUND]]")

	return {
		"value": value
	}
end function

function processGetValuesAtKeyPathsRequest(args as Object) as Object
	requests = args.requests
	if NOT isNonEmptyAA(requests) then
		return buildErrorResponseObject("getValuesAtKeyPaths did not have have any requests")
	end if
	response = {}
	for each key in requests
		result = processGetValueAtKeyPathRequest(requests[key])
		if result.value = Invalid then
			return buildErrorResponseObject(result.error.message)
		end if
		response[key] = result.value
	end for
	return response
end function

sub sendBackResponse(request as Object, response as Object)
	response = recursivelyConvertValueToJsonCompatible(response)
	if NOT isBoolean(response.success) then response.success = true
	response.id = request.id
	m.task.renderThreadResponse = response
end sub

function recursivelyConvertValueToJsonCompatible(value as Object) as Object
	if isArray(value) then
		for i = 0 to getLastIndex(value)
			value[i] = recursivelyConvertValueToJsonCompatible(value[i])
		end for
	else if isAA(value) then
		for each key in value
			value[key] = recursivelyConvertValueToJsonCompatible(value[key])
		end for
	else if isNode(value) then
		subtype = value.subtype()
		value = value.getFields()
		value.subtype = subtype
		value.delete("focusedChild")
		value = recursivelyConvertValueToJsonCompatible(value)
	end if
	return value
end function
