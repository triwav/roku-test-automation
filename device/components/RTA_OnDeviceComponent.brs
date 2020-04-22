sub init()
	m.task = createNode("RTA_OnDeviceComponentTask")
	m.task.observeField("renderThreadRequest", "onRenderThreadRequestChange")
	m.task.control = "RUN"
end sub

sub onRenderThreadRequestChange(event as Object)
	request = event.getData()
	requestType = request.type
	if requestType = "getValueAtKeyPath" then
		response = processGetValueAtKeyPathRequest(request)
	end if
	sendBackResponse(request, response)
end sub

function processGetValueAtKeyPathRequest(request as Object, convertNodeType = true as Boolean) as Dynamic
	args = request.args
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
