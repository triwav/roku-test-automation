'*************************************************************************
'#region *** Client functions - Only these should be called directly by client code
'*************************************************************************

' /**
' * @description Helper to allow using RTA proxy functionality by injecting proxy address into urls
' * @param {String} url - Url we want to prepend proxy address to
' */
function RTA_injectProxy(url as String) as String
	sec = createObject("roRegistrySection", "rokuTestAutomation")
	proxyAddress = sec.read("proxyAddress")
	if proxyAddress <> "" then
		url = "http://" + proxyAddress + "/;" + url
	end if
	return url
end function

'*************************************************************************
'#endregion *** Client functions
'*************************************************************************

'*************************************************************************
'#region *** Injected Functions - functions that are injected my RTA as part of the build process through RokuDevice.deploy()
'*************************************************************************

' /**
' * @description Gets injected into components to allow additional functionality
' * @param {String} name - Name of the operation we would like to run
' * @param {AssociativeArray} args - AA of arguments that are used for the current operation
' */
function RTA_componentOperation(name as String, args = {} as Object)
	response = {}
	if name = "getComponentGlobalAAKeyPath" then
		response.result = RTA_getValueAtKeyPath(m, args.componentGlobalAAKeyPath)
	else if name = "setComponentGlobalAAKeyPath" then
		response.result = RTA_setValueAtKeyPath(m, args.componentGlobalAAKeyPath, args.componentGlobalAAKeyPathValue)
	else
		response.error = "Could not handle unknown '" + name + "' operation"
	end if

	return response
end function

'*************************************************************************
'#region *** RTA helpers
'*************************************************************************
function RTA_buildSuccessResponseObject(message as String) as Object
	return {
		"success": {
			"message": message
		}
	}
end function

function RTA_buildErrorResponseObject(message as String) as Object
	return {
		"error": {
			"message": message
		}
	}
end function

function RTA_isErrorObject(value as Dynamic) as Boolean
	if RTA_isAA(value) AND RTA_isAA(value.error) then
		return true
	end if
	return false
end function

function RTA_safeDivide(dividend as Integer, divisor as Integer) as Float
	if divisor = 0 then
		return 0
	end if

	return dividend / divisor
end function

'*************************************************************************
'#endregion *** RTA helpers
'*************************************************************************

'*************************************************************************
'#region *** Type Checking
'*************************************************************************

' /**
' * @description Checks if the supplied value is a valid Integer type
' * @param {Dynamic} value The variable to be checked
' * @return {Boolean} Results of the check
' */
function RTA_isInteger(value as Dynamic) as Boolean
	valueType = type(value)
	return (valueType = "Integer") OR (valueType = "roInt") OR (valueType = "roInteger") OR (valueType = "LongInteger")
end function

' /**
' * @description Checks if the supplied value is a valid Float type
' * @param {Dynamic} value The variable to be checked
' * @return {Boolean} Results of the check
' */
function RTA_isFloat(value as Dynamic) as Boolean
	valueType = type(value)
	return (valueType = "Float") OR (valueType = "roFloat")
end function

' /**
' * @description Checks if the supplied value is a valid Double type
' * @param {Dynamic} value The variable to be checked
' * @return {Boolean} Results of the check
' */
function RTA_isDouble(value as Dynamic) as Boolean
	valueType = type(value)
	return (valueType = "Double") OR (valueType = "roDouble") OR (valueType = "roIntrinsicDouble")
end function

' /**
' * @description Checks if the supplied value is a valid number type
' * @param {Dynamic} value The variable to be checked
' * @return {Boolean} Results of the check
' */
function RTA_isNumber(obj as Dynamic) as Boolean
	if RTA_isInteger(obj) then return true
	if RTA_isFloat(obj) then return true
	if RTA_isDouble(obj) then return true
	return false
end function

' /**
' * @description Checks if the supplied value is a valid String type
' * @param {Dynamic} value The variable to be checked
' * @return {Boolean} Results of the check
' */
function RTA_isString(value as Dynamic) as Boolean
	valueType = type(value)
	return (valueType = "String") OR (valueType = "roString")
end function

' /**
' * @description Checks if the supplied value is a valid String type and is not empty
' * @param {Dynamic} value The variable to be checked
' * @return {Boolean} Results of the check
' */
function RTA_isNonEmptyString(value as Dynamic) as Boolean
	if RTA_isString(value) AND value <> "" then return true
	return false
end function

' /**
' * @description Checks if the supplied value is a valid Array type
' * @param {Dynamic} value The variable to be checked
' * @return {Boolean} Results of the check
' */
function RTA_isArray(value as Dynamic) as Boolean
	return type(value) = "roArray"
end function

' /**
' * @description Checks if the supplied value is a valid Array type and not empty
' * @param {Dynamic} value The variable to be checked
' * @return {Boolean} Results of the check
' */
function RTA_isNonEmptyArray(value as Dynamic) as Boolean
	return (RTA_isArray(value) AND NOT value.isEmpty())
end function

' /**
' * @description Checks if the supplied value allows for key field access
' * @param {Dynamic} value The variable to be checked
' * @return {Boolean} Results of the check
' */
function RTA_isKeyedValueType(value as Dynamic) as Boolean
	return getInterface(value, "ifAssociativeArray") <> Invalid
end function

' /**
' * @description Checks if the supplied value is a valid AssociativeArray type
' * @param {Dynamic} value The variable to be checked
' * @return {Boolean} Results of the check
' */
function RTA_isAA(value as Dynamic) as Boolean
	return type(value) = "roAssociativeArray"
end function

' /**
' * @description Checks if the supplied value is a valid AssociativeArray type and is not empty
' * @param {Dynamic} value The variable to be checked
' * @return {Boolean} Results of the check
' */
function RTA_isNonEmptyAA(value as Dynamic) as Boolean
	return (RTA_isAA(value) AND NOT value.isEmpty())
end function

' /**
' * @description Checks if the supplied value is not Invalid or uninitialized
' * @param {Dynamic} value The variable to be checked
' * @return {Boolean} Results of the check
' */
function RTA_isNotInvalid(value as Dynamic) as Boolean
	return (type(value) <> "<uninitialized>" AND value <> Invalid)
end function

' /**
' * @description Checks if the supplied value is a valid Boolean type
' * @param {Dynamic} value The variable to be checked
' * @return {Boolean} Results of the check
' */
function RTA_isBoolean(value as Dynamic) as Boolean
	valueType = type(value)
	return (valueType = "Boolean") OR (valueType = "roBoolean")
end function

' /**
' * @description Checks if the supplied value is a valid Node type
' * @param {Dynamic} value The variable to be checked
' * @return {Boolean} Results of the check
' */
function RTA_isNode(value as Dynamic) as Boolean
	return type(value) = "roSGNode"
end function

' /**
' * @description Checks if the supplied value is a valid Function type
' * @param {Dynamic} value The variable to be checked
' * @return {Boolean} Results of the check
' */
function RTA_isFunction(value as Dynamic) as Boolean
	valueType = type(value)
	return (valueType = "roFunction") OR (valueType = "Function")
end function

'*************************************************************************
'#endregion *** Type Checking
'*************************************************************************

'*************************************************************************
'#region *** SG Node Utilities
'*************************************************************************

function RTA_findChildNodeWithId(parentNode as Object, id as String, maxDepth = 10 as Integer, depth = 0 as Integer) as Dynamic
	if depth > maxDepth then
		RTA_logWarn(depth.toStr() + " exceeded maximum depth of " + maxDepth.toStr() + " searching for node with id '" + id + "'")
		return Invalid
	end if

	for i = 0 to RTA_getLastIndex(parentNode)
		child = parentNode.getChild(i)
		if child.id = id then
			return child
		end if

		match = RTA_findChildNodeWithId(child, id, maxDepth, depth + 1)
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
function RTA_getNodeParentIndex(node as Object, parent) as Integer
	if RTA_isNode(node) then
		for i = 0 to RTA_getLastIndex(parent)
			if node.isSameNode(parent.getChild(i)) then
				return i
			end if
		end for
	end if
	return -1
end function

function RTA_getFocusedNode() as Dynamic
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

function RTA_getNodeSubtype(node as Object) as String
	if RTA_isNode(node) then
		return node.subtype()
	end if
	return ""
end function

'*************************************************************************
'#endregion *** SG Node Utilities
'*************************************************************************

'*************************************************************************
'#region *** AssociativeArray Utilities
'*************************************************************************

' /**
' * @description Used to create case sensitive AssociativeArray and also set an initial value. If no key is provided makes an empty AssociativeArray.
' * Useful for cases where the key is coming from a variable as you can't use a variable for a key in initial declaration.
' * @param {String} key Initial key.
' * @param {Dynamic} value Initial value.
' * @return {AssociativeArray}
' */
function RTA_createCaseSensitiveAA(key = "" as String, value = Invalid as Dynamic) as Object
	aa = {}
	aa.setModeCaseSensitive()
	if RTA_isNonEmptyString(key) then aa[key] = value
	return aa
end function

'*************************************************************************
'#endregion *** AssociativeArray Utilities
'*************************************************************************

'*************************************************************************
'#region *** Keyed Value Utilities
'*************************************************************************

' /**
' * @description Helper for RTA_getValueAtKeyPath to break out
' * @param {Object} key - Key of the function the user is asking us to call
' * @param {Dynamic} level - The variable we are calling the function call on
' * @param {Integer} openingParenthesisPosition - Where the opening paranthesis are located in keyPathPart
' */
function RTA_callBrightscriptInterfaceFunction(keyPathPart as string, callOn as Dynamic, openingParenthesisPosition as Integer) as Dynamic
	functionName = left(keyPathPart, openingParenthesisPosition)
	closingParenthesisPosition = keyPathPart.len()
	if mid(keyPathPart, closingParenthesisPosition) <> ")" then
		RTA_logWarn("Could not find closing parenthesis" + keyPathPart)
		return Invalid
	end if
	numCharacters = closingParenthesisPosition - (openingParenthesisPosition + 2)
	functionParams = mid(keyPathPart, openingParenthesisPosition + 2, numCharacters).split(",")

	if functionName = "getParent" then
		if RTA_isNode(callOn) then
			return callOn.getParent()
		else
			RTA_logWarn("tried to call getParent() on non node of type " + type(callOn))
		end if
	else if functionName = "count" then
		if RTA_isArray(callOn) OR RTA_isKeyedValueType(callOn) then
			return callOn.count()
		else
			RTA_logWarn("tried to call count() on non AA or array of type " + type(callOn))
		end if
	else if functionName = "keys" then
		if RTA_isNode(callOn) then
			return callOn.keys().toArray() ' keys() returns an roList when called on a node. We have to convert to array as all of our array checks are specifically looking for an array
		else if RTA_isAA(callOn) then
			return callOn.keys()
		else
			RTA_logWarn("tried to call keys() on non keyed value of type " + type(callOn))
		end if
	else if functionName = "len" then
		if RTA_isString(callOn) then
			return callOn.len()
		else
			RTA_logWarn("tried to call len() on non string of type " + type(callOn))
		end if
	else if functionName = "getChildCount" then
		if RTA_isNode(callOn) then
			return callOn.getChildCount()
		else
			RTA_logWarn("tried to call getChildCount() on non node of type " + type(callOn))
		end if
	else if functionName = "threadinfo" then
		if RTA_isNode(callOn) then
			return callOn.threadinfo()
		else
			RTA_logWarn("tried to call threadinfo() on non node of type " + type(callOn))
		end if
	else if functionName = "getFieldTypes" then
		if RTA_isNode(callOn) then
			return callOn.getFieldTypes()
		else
			RTA_logWarn("tried to call getFieldTypes() on non node of type " + type(callOn))
		end if
	else if functionName = "subtype" then
		if RTA_isNode(callOn) then
			return callOn.subtype()
		else
			RTA_logWarn("tried to call subtype() on non node of type " + type(callOn))
		end if
	else if functionName = "boundingRect" then
		if RTA_isNode(callOn) then
			return callOn.boundingRect()
		else
			RTA_logWarn("tried to call boundingRect() on non node of type " + type(callOn))
		end if
	else if functionName = "localBoundingRect" then
		if RTA_isNode(callOn) then
			return callOn.localBoundingRect()
		else
			RTA_logWarn("tried to call localBoundingRect() on non node of type " + type(callOn))
		end if
	else if functionName = "sceneBoundingRect" then
		if RTA_isNode(callOn) then
			return callOn.sceneBoundingRect()
		else
			RTA_logWarn("tried to call sceneBoundingRect on non node of type " + type(callOn))
		end if
	else if functionName = "sceneSubBoundingRect" then
		if RTA_isNode(callOn) then
			return callOn.sceneSubBoundingRect(functionParams[0])
		else
			RTA_logWarn("tried to call sceneBoundingRect on non node of type " + type(callOn))
		end if
	else
		RTA_logWarn("tried to call unknown function" + functionName)
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
function RTA_getValueAtKeyPath(base as Object, keyPath as String, fallback = Invalid as Dynamic, validator = RTA_isNotInvalid as Function) as Dynamic
	if NOT RTA_isKeyedValueType(base) AND NOT RTA_isNonEmptyArray(base) then return fallback
	if keyPath = "" then return base

	keys = keyPath.split(".")
	level = base

	while NOT keys.isEmpty()
		key = keys.shift()
		' Check for any Brightscript interface function calls
		openingParenthesisPosition = key.Instr("(")
		if openingParenthesisPosition > 0 then
			level = RTA_callBrightscriptInterfaceFunction(key, level, openingParenthesisPosition)
		else if RTA_isKeyedValueType(level) then
			nextLevel = level[key]
			if nextLevel = Invalid AND RTA_isNode(level) then
				if key.left(1) = "#" then
					id = key.mid(1)
					nextLevel = RTA_findChildNodeWithId(level, id)
				else
					index = key.toInt()
					if index <> 0 OR key = "0" then
						if index < 0 then
							index = level.getChildCount() + index ' It's a negative number so we add it to subtract
						end if
						nextLevel = level.getChild(index)
					end if
				end if

				if nextLevel = Invalid then
					keys.unshift(key)
					nextLevel = RTA_getArrayGridChild(level, keys)
				end if
			end if
			level = nextLevel
		else if RTA_isNonEmptyArray(level) then
			index = key.toInt()
			if index <> 0 OR key = "0" then
				if index < 0 then
					index = level.count() + index ' It's a negative number so we add it to subtract
				end if
				level = level[index]
			end if
		else
			return fallback
		end if
	end while

	if NOT validator(level) then return fallback

	return level
end function

function RTA_getArrayGridChild(node as Object, keys as Object) as Dynamic
	if NOT node.isSubtype("ArrayGrid") OR NOT RTA_isNode(node.content) then
		return Invalid
	end if

	arrayGridContent = node.content
	key = keys.shift()
	index = key.toInt()
	' Make sure we have a valid first index as we always need that
	if index = 0 AND key <> "0" then
		return Invalid
	end if

	' Make sure we have a content node at the specified index
	childContent = arrayGridContent.getChild(index)
	if childContent = Invalid then
		return Invalid
	end if

	matchingContentNode = childContent
	nodeSubtypeToCheck = ""
	contentField = "itemContent"

	' We treat RowList differently as it can have multiple types of nodes we're interested in
	if NOT node.isSubtype("RowList") then
		nodeSubtypeToCheck = node.itemComponentName
	else
		key = keys.shift()
		' Here we get to our magic values to know if we want to look at the items or the title
		if key = "items" then
			nodeSubtypeToCheck = node.itemComponentName
			key = keys.shift()
			index = key.toInt()
			if index <> 0 OR key = "0" then
				matchingContentNode = childContent.getChild(index)
			end if
		else if key = "title" then
			nodeSubtypeToCheck = node.rowTitleComponentName
			contentField = "content"
		end if
	end if

	if nodeSubtypeToCheck <> "" AND matchingContentNode <> Invalid then
		for each possibleMatchingNode in m.top.getAll()
			if possibleMatchingNode.subtype() = nodeSubtypeToCheck then
				if matchingContentNode.isSameNode(possibleMatchingNode[contentField]) then
					return possibleMatchingNode
				end if
			end if
		end for
	end if
	return Invalid
end function

' /**
' * @description Used to find a nested number value in an object
' * @param {Object} aa Object to drill down into.
' * @param {String} keyPath A dot notation based string to the expected value.
' * @param {Dynamic} fallback A return fallback value if the requested field could not be found or did not pass the validator function.
' * @return {Dynamic} The result of the drill down process
' */
function RTA_getNumberAtKeyPath(aa as Object, keyPath as String, fallback = 0 as Dynamic)
	return RTA_getValueAtKeyPath(aa, keyPath, fallback, RTA_isNumber)
end function

' /**
' * @description Used to set a value on the supplied key path
' * @param {Object} base - Object to drill down into.
' * @param {String} keyPath - A dot notation based string to the expected value.
' * @param {Dynamic} value - The value to be set.
' * @return {Boolean} True if set successfully.
' */
function RTA_setValueAtKeyPath(base as Object, keyPath as String, value as Dynamic) as Boolean
	' We only allow setting on an AA or array as those are the only ones that should need this functionality
	if NOT RTA_isAA(base) AND NOT RTA_isArray(base) then return false

	keys = keyPath.split(".")
	level = base
	nextLevelNeedsToBeCreated = false
	previousKeyOrIndex = ""

	while NOT keys.isEmpty()
		' We use the key type to know what we're trying to do
		key = keys.shift()
		index = key.toInt()
		useIndex = (index <> 0 OR key = "0")

		if nextLevelNeedsToBeCreated then
			nextLevelNeedsToBeCreated = false
			if useIndex then
				level[previousKeyOrIndex] = []
				level = level[previousKeyOrIndex]
			else
				level[previousKeyOrIndex] = {}
				level = level[previousKeyOrIndex]
			end if
		end if

		previousKeyOrIndex = key

		if useIndex then
			' It's an array that we're trying to setup so use index
			if index < 0 then
				index = level.count() + index ' It's a negative number so we add it to subtract
			end if
			previousKeyOrIndex = index

			if keys.isEmpty() then
				' Go ahead and assign instead
				level[index] = value
			else
				nextLevel = level[index]
				if nextLevel <> Invalid then
					level = nextLevel
				else
					nextLevelNeedsToBeCreated = true
				end if
			end if
		else
			' It's an AA that we're trying to setup so handle so use key
			if keys.isEmpty() then
				' Go ahead and assign instead
				level[key] = value
			else
				nextLevel = level[key]
				if nextLevel <> Invalid then
					level = nextLevel
				else
					nextLevelNeedsToBeCreated = true
				end if
			end if
		end if
	end while

	return true
end function

' /**
' * @description Used to find a nested Boolean value in an object
' * @param {Object} aa Object to drill down into.
' * @param {String} keyPath A dot notation based string to the expected value.
' * @param {Boolean} fallback A return fallback value if the requested field could not be found or did not pass the validator function.
' * @return {Dynamic} The result of the drill down process
' */
function RTA_getBooleanAtKeyPath(aa as Object, keyPath as String, fallback = false as Boolean)
	return RTA_getValueAtKeyPath(aa, keyPath, fallback, RTA_isBoolean)
end function

' /**
' * @description Used to find a nested String value in an object
' * @param {Object} aa Object to drill down into.
' * @param {String} keyPath A dot notation based string to the expected value.
' * @param {Dynamic} fallback A return fallback value if the requested field could not be found or did not pass the validator function.
' * @return {Dynamic} The result of the drill down process
' */
function RTA_getStringAtKeyPath(aa as Object, keyPath as String, fallback = "" as String)
	return RTA_getValueAtKeyPath(aa, keyPath, fallback, RTA_isNonEmptyString)
end function

'*************************************************************************
'#endregion *** Keyed Value Utilities
'*************************************************************************

'*************************************************************************
'#region *** Iteration Helpers
'*************************************************************************

' /**
' * @description Gets the highest available index
' * @param {Object} value Object to get the top index from.
' * @return {Integer} Result or -1 if not supported or empty.
' */
function RTA_getLastIndex(value as Object) as Integer
	if RTA_isNode(value) then
		return value.getChildCount() - 1
	else if RTA_isArray(value) OR RTA_isAA(value) then
		return value.count() - 1
	end if
	return -1
end function

'*************************************************************************
'#endregion *** Iteration Helpers
'*************************************************************************

'*************************************************************************
'#region *** Logging
'*************************************************************************

function RTA_convertLogLevelStringToInteger(logLevel as String) as Integer
	if logLevel = "verbose" then return 5
	if logLevel = "debug" then return 4
	if logLevel = "info" then return 3
	if logLevel = "warn" then return 2
	if logLevel = "error" then return 1
	if logLevel = "off" then return 0
	RTA_logWarn("Invalid logLevel passed in '" + logLevel + "'")
	return 0
end function

sub setLogLevel(logLevel as String)
	m.logLevel = RTA_convertLogLevelStringToInteger(logLevel)
end sub

sub RTA_logVerbose(message as String, value = "nil" as Dynamic)
	RTA_log(5, message, value)
end sub

sub RTA_logDebug(message as String, value = "nil" as Dynamic)
	RTA_log(4, message, value)
end sub

sub RTA_logInfo(message as String, value = "nil" as Dynamic)
	RTA_log(3, message, value)
end sub

sub RTA_logWarn(message as String, value = "nil" as Dynamic)
	RTA_log(2, message, value)
end sub

sub RTA_logError(message as String, value = "nil" as Dynamic)
	RTA_log(1, message, value)
end sub

sub RTA_log(level as Integer, message as String, value = "nil" as Dynamic)
	if RTA_isNumber(m.logLevel) AND m.logLevel < level then return

	levels = [
		"OFF"
		"ERROR"
		"WARN"
		"INFO"
		"DEBUG"
		"VERBOSE"
	]

	date = createObject("roDateTime")
	date.toLocalTime()
	formattedDate = RTA_lpad(date.getMonth()) + "-" + RTA_lpad(date.getDayOfMonth()) + " " + RTA_lpad(date.getHours()) + ":" + RTA_lpad(date.getMinutes()) + ":" + RTA_lpad(date.getSeconds()) + "." + RTA_lpad(date.getMilliseconds(), 3)
	message = formattedDate + " [RTA][" + levels[level] + "] " + message
	if RTA_isString(value) AND value = "nil" then
		print message
	else
		print message value
	end if
end sub

function RTA_lpad(value as Dynamic, padLength = 2 as Integer, padCharacter = "0" as String)
	value = value.toStr()
	while value.len() < padLength
		value = padCharacter + value
	end while
	return value
End function

'*************************************************************************
'#endregion *** Logging
'*************************************************************************
