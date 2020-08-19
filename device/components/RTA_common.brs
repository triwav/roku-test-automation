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


function findChildNodeWithId(parentNode as Object, id as String, maxDepth = 10 as Integer, depth = 0 as Integer) as Dynamic
	if depth > maxDepth then
		logWarn(depth.toStr() + " exceeded maxium depth of " + maxDepth.toStr())
		return Invalid
	end if

	for i = 0 to getLastIndex(parentNode)
		child = parentNode.getChild(i)
		if child.id = id then
			return child
		end if

		match = findChildNodeWithId(child, id, maxDepth, depth + 1)
		if match <> Invalid then
			return match
		end if
	end for
	return Invalid
end function

'*************************************************************************
'#endregion *** SG NODE UTILITIES
'*************************************************************************

'*************************************************************************
'#region *** ASSOCIATIVE ARRAY UTILITIES
'*************************************************************************

' /**
' * @description Used to create case sensitive AssociativeArray and also set an initial value. If no key is provided makes an empty AssociativeArray.
' * Useful for cases where the key is coming from a variable as you can't use a variable for a key in initial declaration.
' * @param {String} key Initial key.
' * @param {Dynamic} value Initial value.
' * @return {AssociativeArray}
' */
function createCaseSensitiveAA(key = "" as String, value = Invalid as Dynamic) as Object
	aa = {}
	aa.setModeCaseSensitive()
	if isNonEmptyString(key) then aa[key] = value
	return aa
end function

'*************************************************************************
'#endregion *** ASSOCIATIVE ARRAY UTILITIES
'*************************************************************************

'*************************************************************************
'#region *** KEYED VALUE UTILITIES
'*************************************************************************

' /**
' * @description Used to find a nested value in an object
' * @param {Object} base - Object to drill down into.
' * @param {String} keyPath - A dot notation based string to the expected value.
' * @param {Dynamic} fallback - A return fallback value if the requested field could not be found or did not pass the validator function.
' * @param {Function} validator - A function used to validate the output value matches what you expected.
' * @return {Dynamic} The result of the drill down process
' */
function getValueAtKeyPath(base as Object, keyPath as String, fallback = Invalid as Dynamic, validator = isNotInvalid as Function) as Dynamic
	if NOT isKeyedValueType(base) OR keyPath = "" then return fallback

	keys = keyPath.tokenize(".")
	level = base

	while NOT keys.isEmpty()
		key = keys.shift()
		if isKeyedValueType(level) then
			nextLevel = level[key]
			if nextLevel = Invalid and isNode(level) then
				index = key.toInt()
				if index = 0 AND key <> "0" then
					level = findChildNodeWithId(level, key)
				else
					level = level.getChild(index)
				end if
			else
				level = nextLevel
			end if
		else if isNonEmptyArray(level) then
			key = key.toInt()
			if key < 0 then
				key = level.count() + key ' It's a negative number so we add it to subtract
			end if
			level = level[key]
		else
			return fallback
		end if
	end while

	if NOT validator(level) then return fallback

	return level
end function

' /**
' * @description Used to set a nested String value in the supplied object
' * @param {Object} base - Object to drill down into.
' * @param {String} keyPath - A dot notation based string to the expected value.
' * @param {Dynamic} value - The value to be set.
' * @return {Boolean} True if set successfully.
' */
function setValueAtKeyPath(base as Object, keyPath as String, value as Dynamic) as Boolean
	if NOT isAA(base) AND NOT isArray(base) then return false

	level = base
	keys = keyPath.tokenize(".")
	while keys.count() > 1
		key = keys.shift()
		if isAA(level[key]) then
			level = level[key]
		else if isNonEmptyArray(level) then
			key = key.toInt()
			if key < 0 then
				key = level.count() - key
			end if
			level = level[key]
		else
			level[key] = {}
		end if
	end while

	finalKey = keys.shift()
	level[finalKey] = value
	return true
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

function convertLogLevelStringToInteger(logLevel as String) as Integer
	if logLevel = "verbose" then return 5
	if logLevel = "debug" then return 4
	if logLevel = "info" then return 3
	if logLevel = "warn" then return 2
	if logLevel = "error" then return 1
	if logLevel = "off" then return 0
	logWarn("Invalid logLevel passed in '" + logLevel + "'")
end function

function setLogLevel(logLevel as String)
	m.logLevel = convertLogLevelStringToInteger(logLevel)
end function

sub logVerbose(message as String, value = "nil" as Dynamic)
	_log(5, message, value)
end sub

sub logDebug(message as String, value = "nil" as Dynamic)
	_log(4, message, value)
end sub

sub logInfo(message as String, value = "nil" as Dynamic)
	_log(3, message, value)
end sub

sub logWarn(message as String, value = "nil" as Dynamic)
	_log(2, message, value)
end sub

sub logError(message as String, value = "nil" as Dynamic)
	_log(1, message, value)
end sub

sub _log(level as Integer, message as String, value = "nil" as Dynamic)
	if isNumber(m.logLevel) AND m.logLevel < level then return

	levels = [
		"OFF"
		"ERROR"
		"WARN"
		"INFO"
		"DEBUG"
		"VERBOSE"
	]
	message = "[RTA][" + levels[level] + "] " + message
	if isString(value) AND value = "nil" then
		print message
	else
		print message value
	end if
end sub

'*************************************************************************
'#endregion *** LOGGING
'*************************************************************************
