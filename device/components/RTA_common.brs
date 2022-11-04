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

function isErrorObject(value as Dynamic) as Boolean
	if isAA(value) AND isAA(value.error) then
		return true
	end if
	return false
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

' /**
' * @description Checks if the supplied value is a valid Function type
' * @param {Dynamic} value The variable to be checked
' * @return {Boolean} Results of the check
' */
function isFunction(value as Dynamic) as Boolean
	valueType = type(value)
	return (valueType = "roFunction") OR (valueType = "Function")
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
		logWarn(depth.toStr() + " exceeded maximum depth of " + maxDepth.toStr())
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

' /**
' * @description Gets the index position for this node in its parent
' * @param {Node} node we want to find the parent index for
' * @param {Node} parent we are searching for the children of
' * @return {Integer} Result or -1
' */
function getNodeParentIndex(node as Object, parent) as Integer
	if isNode(node) then
		for i = 0 to getLastIndex(parent)
			if node.isSameNode(parent.getChild(i)) then
				return i
			end if
		end for
	end if
	return -1
end function

function getFocusedNode() as Dynamic
	node = m.top.getScene()
	while true
		child = node.focusedChild
		if child <> Invalid AND NOT node.isSameNode(child) then
			node = child
		else
			exit while
		end if
	end while
	return node
end function

function getNodeSubtype(node as Object) as String
	if isNode(node) then
		return node.subtype()
	end if
	return ""
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
' * @description Helper for getValueAtKeyPath to break out
' * @param {Object} key - Key of the function the user is asking us to call
' * @param {Dynamic} level - The variable we are calling the function call on
' */
function callBrightscriptInterfaceFunction(functionName as string, callOn as Dynamic) as Dynamic
	if functionName = "getParent()" then
		if isNode(callOn) then
			return callOn.getParent()
		else
			logWarn("tried to call getParent() on non node of type " + type(callOn))
		end if
	else if functionName = "count()" then
		if isArray(callOn) OR isKeyedValueType(callOn) then
			return callOn.count()
		else
			logWarn("tried to call count() on non AA or array of type " + type(callOn))
		end if
	else if functionName = "keys()" then
		if isNode(callOn) then
			return callOn.keys().toArray() ' keys() returns an roList when called on a node. We have to convert to array as all of our array checks are specifically looking for an array
		else if isAA(callOn) then
			return callOn.keys()
		else
			logWarn("tried to call keys() on non keyed value of type " + type(callOn))
		end if
	else if functionName = "len()" then
		if isString(callOn) then
			return callOn.len()
		else
			logWarn("tried to call len() on non string of type " + type(callOn))
		end if
	else if functionName = "getChildCount()" then
		if isNode(callOn) then
			return callOn.getChildCount()
		else
			logWarn("tried to call getChildCount() on non node of type " + type(callOn))
		end if
	else if functionName = "threadinfo()" then
		if isNode(callOn) then
			return callOn.threadinfo()
		else
			logWarn("tried to call threadinfo() on non node of type " + type(callOn))
		end if
	else if functionName = "getFieldTypes()" then
		if isNode(callOn) then
			return callOn.getFieldTypes()
		else
			logWarn("tried to call getFieldTypes() on non node of type " + type(callOn))
		end if
	else if functionName = "subtype()" then
		if isNode(callOn) then
			return callOn.subtype()
		else
			logWarn("tried to call subtype() on non node of type " + type(callOn))
		end if
	else if functionName = "boundingRect()" then
		if isNode(callOn) then
			return callOn.boundingRect()
		else
			logWarn("tried to call boundingRect() on non node of type " + type(callOn))
		end if
	else if functionName = "localBoundingRect()" then
		if isNode(callOn) then
			return callOn.localBoundingRect()
		else
			logWarn("tried to call localBoundingRect() on non node of type " + type(callOn))
		end if
	else if functionName = "sceneBoundingRect()" then
		if isNode(callOn) then
			return callOn.sceneBoundingRect()
		else
			logWarn("tried to call sceneBoundingRect() on non node of type " + type(callOn))
		end if
	else
		logWarn("tried to call unknown function" + functionName)
	end if

	return Invalid
end function

' /**
' * @description Used to find a nested value in an object
' * @param {Object} base - Object to drill down into.
' * @param {String} keyPath - A dot notation based string to the expected value.
' * @param {Dynamic} fallback - A return fallback value if the requested field could not be found or did not pass the validator function.
' * @param {Function} validator - A function used to validate the output value matches what you expected.
' * @return {Dynamic} The result of the drill down process
' */
function getValueAtKeyPath(base as Object, keyPath as String, fallback = Invalid as Dynamic, validator = isNotInvalid as Function) as Dynamic
	if NOT isKeyedValueType(base) AND NOT isNonEmptyArray(base) then return fallback
	if keyPath = "" then return fallback

	keys = keyPath.tokenize(".")
	level = base

	while NOT keys.isEmpty()
		key = keys.shift()
		' Check for any Brightscript interface function calls
		if key.Instr("()") > 0 then
			level = callBrightscriptInterfaceFunction(key, level)
		else if isKeyedValueType(level) then
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
' * @description Used to find a nested number value in an object
' * @param {Object} aa Object to drill down into.
' * @param {String} keyPath A dot notation based string to the expected value.
' * @param {Dynamic} fallback A return fallback value if the requested field could not be found or did not pass the validator function.
' * @return {Dynamic} The result of the drill down process
' */
function getNumberAtKeyPath(aa as Object, keyPath as String, fallback = 0 as Dynamic)
	return getValueAtKeyPath(aa, keyPath, fallback, isNumber)
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
' * @description Used to find a nested Boolean value in an object
' * @param {Object} aa Object to drill down into.
' * @param {String} keyPath A dot notation based string to the expected value.
' * @param {Boolean} fallback A return fallback value if the requested field could not be found or did not pass the validator function.
' * @return {Dynamic} The result of the drill down process
' */
function getBooleanAtKeyPath(aa as Object, keyPath as String, fallback = false as Boolean)
	return getValueAtKeyPath(aa, keyPath, fallback, isBoolean)
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

' /**
' * @description Used to find a nested Array value in an object
' * @param {Object} aa Object to drill down into.
' * @param {String} keyPath A dot notation based string to the expected value.
' * @param {Dynamic} fallback A return fallback value if the requested field could not be found or did not pass the validator function.
' * @return {Dynamic} The result of the drill down process
' */
function getArrayAtKeyPath(aa as Object, keyPath as String, fallback = [] as Object)
	return getValueAtKeyPath(aa, keyPath, fallback, isArray)
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


' /**
' * @description Gets all the children nodes of the supplied node
' * @param {roSGNode} node The node to get children from.
' * @return {Array} Array containing the child nodes retrieved.
' */
function getAllChildren(node as Object) as Object
	children = []
	if isNode(node) then children.append(node.getChildren(-1, 0))
	return children
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
	return 0
end function

sub setLogLevel(logLevel as String)
	m.logLevel = convertLogLevelStringToInteger(logLevel)
end sub

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
