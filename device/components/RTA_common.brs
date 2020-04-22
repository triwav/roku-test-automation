'*************************************************************************
'#region *** RTA HELPERS
'*************************************************************************

function buildErrorResponseObject(message as String) as Object
	return {
		"success": false
		"error": {
			"message": message
		}
	}
end function

'*************************************************************************
'#endregion *** RTA HELPERS
'*************************************************************************

'*************************************************************************
'#region *** TYPE CHECKING
'*************************************************************************

' /**
' * @description Checks if the supplied value is a valid Integer type
' * @param {Dynamic} value The variable to be checked
' * @return {Boolean} Results of the check
' */
function isInteger(value as Dynamic) as Boolean
	valueType = type(value)
	return (valueType = "Integer") OR (valueType = "roInt") OR (valueType = "roInteger") OR (valueType = "LongInteger")
end function

' /**
' * @description Checks if the supplied value is a valid Float type
' * @param {Dynamic} value The variable to be checked
' * @return {Boolean} Results of the check
' */
function isFloat(value as Dynamic) as Boolean
	valueType = type(value)
	return (valueType = "Float") OR (valueType = "roFloat")
end function

' /**
' * @description Checks if the supplied value is a valid Double type
' * @param {Dynamic} value The variable to be checked
' * @return {Boolean} Results of the check
' */
function isDouble(value as Dynamic) as Boolean
	valueType = type(value)
	return (valueType = "Double") OR (valueType = "roDouble") OR (valueType = "roIntrinsicDouble")
end function

' /**
' * @description Checks if the supplied value is a valid number type
' * @param {Dynamic} value The variable to be checked
' * @return {Boolean} Results of the check
' */
function isNumber(obj as Dynamic) as Boolean
	if isInteger(obj) then return true
	if isFloat(obj) then return true
	if isDouble(obj) then return true
	return false
end function

' /**
' * @description Checks if the supplied value is a valid String type
' * @param {Dynamic} value The variable to be checked
' * @return {Boolean} Results of the check
' */
function isString(value as Dynamic) as Boolean
	valueType = type(value)
	return (valueType = "String") OR (valueType = "roString")
end function

' /**
' * @description Checks if the supplied value is a valid String type and is not empty
' * @param {Dynamic} value The variable to be checked
' * @return {Boolean} Results of the check
' */
function isNonEmptyString(value as Dynamic) as Boolean
	if isString(value) AND value <> "" then return true
	return false
end function

' /**
' * @description Checks if the supplied value is a valid Array type
' * @param {Dynamic} value The variable to be checked
' * @return {Boolean} Results of the check
' */
function isArray(value as Dynamic) as Boolean
	return type(value) = "roArray"
end function

' /**
' * @description Checks if the supplied value is a valid Array type and not empty
' * @param {Dynamic} value The variable to be checked
' * @return {Boolean} Results of the check
' */
function isNonEmptyArray(value as Dynamic) as Boolean
	return (isArray(value) AND NOT value.isEmpty())
end function

' /**
' * @description Checks if the supplied value allows for key field access
' * @param {Dynamic} value The variable to be checked
' * @return {Boolean} Results of the check
' */
function isKeyedValueType(value as Dynamic) as Boolean
	return getInterface(value, "ifAssociativeArray") <> Invalid
end function

' /**
' * @description Checks if the supplied value is a valid AssociativeArray type
' * @param {Dynamic} value The variable to be checked
' * @return {Boolean} Results of the check
' */
function isAA(value as Dynamic) as Boolean
	return type(value) = "roAssociativeArray"
end function

' /**
' * @description Checks if the supplied value is a valid AssociativeArray type and is not empty
' * @param {Dynamic} value The variable to be checked
' * @return {Boolean} Results of the check
' */
function isNonEmptyAA(value as Dynamic) as Boolean
	return (isAA(value) AND NOT value.isEmpty())
end function

' /**
' * @description Checks if the supplied value is not Invalid or uninitialized
' * @param {Dynamic} value The variable to be checked
' * @return {Boolean} Results of the check
' */
function isNotInvalid(value as Dynamic) as Boolean
	return (type(value) <> "<uninitialized>" AND value <> Invalid)
end function

' /**
' * @description Checks if the supplied value is a valid Boolean type
' * @param {Dynamic} value The variable to be checked
' * @return {Boolean} Results of the check
' */
function isBoolean(value as Dynamic) as Boolean
	valueType = type(value)
	return (valueType = "Boolean") OR (valueType = "roBoolean")
end function

' /**
' * @description Checks if the supplied value is a valid Node type
' * @param {Dynamic} value The variable to be checked
' * @return {Boolean} Results of the check
' */
function isNode(value as Dynamic) as Boolean
	return type(value) = "roSGNode"
end function

'*************************************************************************
'#endregion *** TYPE CHECKING
'*************************************************************************

'*************************************************************************
'#region *** SG NODE UTILITIES
'*************************************************************************

function createNode(nodeType = "Node" as String) as Object
	return createObject("roSGNode", nodeType)
end function

'*************************************************************************
'#endregion *** SG NODE UTILITIES
'*************************************************************************

'*************************************************************************
'#region *** KEYED VALUE UTILITIES
'*************************************************************************

' /**
' * @description Used to find a nested value in an object
' * @param {Object} aa Object to drill down into.
' * @param {String} keyPath A dot notation based string to the expected value.
' * @param {Dynamic} fallback A return fallback value if the requested field could not be found or did not pass the validator function.
' * @param {Function} validator A function used to validate the output value matches what you expected.
' * @return {Dynamic} The result of the drill down process
' */
function getValueAtKeyPath(aa as Object, keyPath as String, fallback = Invalid as Dynamic, validator = isNotInvalid as Function) as Dynamic
	if NOT isKeyedValueType(aa) OR keyPath.isEmpty() then return fallback

	level = aa
	keys = keyPath.tokenize(".")
	while keys.count() > 1
		key = keys.shift()
		level = level[key]

		if NOT isKeyedValueType(level) then
			if isNonEmptyArray(level) then
				key = keys.shift()
				level = level[toNumber(key)]
				if keys.isEmpty() then
					if validator(level) = false then return fallback
					return level
				else if NOT isKeyedValueType(level) then
					return fallback
				end if
			else
				return fallback
			end if
		end if
	end while

	finalKey = keys.shift()
	value = level[finalKey]
	if NOT validator(value) then return fallback

	return value
end function

' /**
' * @description Used to find a nested String value in an object
' * @param {Object} aa Object to drill down into.
' * @param {String} keyPath A dot notation based string to the expected value.
' * @param {Dynamic} fallback A return fallback value if the requested field could not be found or did not pass the validator function.
' * @return {Dynamic} The result of the drill down process
' */
function getStringAtKeyPath(aa as Object, keyPath as String, fallback = "" as String)
	return getValueAtKeyPath(aa, keyPath, fallback, isNonEmptyString)
end function

'*************************************************************************
'#endregion *** KEYED VALUE UTILITIES
'*************************************************************************

'*************************************************************************
'#region *** ITERATION HELPERS
'*************************************************************************

' /**
' * @description Gets the highest available index
' * @param {Object} value Object to get the top index from.
' * @return {Integer} Result or -1 if not supported or empty.
' */
function getLastIndex(value as Object) as Integer
	if isNode(value) then
		return value.getChildCount() - 1
	else if isArray(value) OR isAA(value) then
		return value.count() - 1
	end if
	return -1
end function

'*************************************************************************
'#endregion *** ITERATION HELPERS
'*************************************************************************

'*************************************************************************
'#region *** LOGGING
'*************************************************************************

sub logVerbose(message as String, value = "nil" as Dynamic)
	_log(0, message, value)
end sub

sub logDebug(message as String, value = "nil" as Dynamic)
	_log(1, message, value)
end sub

sub logInfo(message as String, value = "nil" as Dynamic)
	_log(2, message, value)
end sub

sub logWarn(message as String, value = "nil" as Dynamic)
	_log(3, message, value)
end sub

sub logError(message as String, value = "nil" as Dynamic)
	_log(4, message, value)
end sub

sub _log(level as Integer, message as String, value = "nil" as Dynamic)
	levels = [
		"VERBOSE"
		"DEBUG"
		"INFO"
		"WARN"
		"ERROR"
	]
	print "[RTA][" + levels[level] + "] " message
	if NOT isString(value) OR value <> "nil" then
		print value
	end if
end sub

'*************************************************************************
'#endregion *** LOGGING
'*************************************************************************
