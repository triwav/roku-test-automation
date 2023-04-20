sub init()
	logInfo("OnDeviceComponent init")
	m.task = m.top.createChild("RTA_OnDeviceComponentTask")
	m.task.observeFieldScoped("renderThreadRequest", "onRenderThreadRequestChange")
	m.task.control = "RUN"

	m.activeObserveFieldRequests = {}

	m.nodeReferences = {}
end sub

sub onRenderThreadRequestChange(event as Object)
	request = event.getData()
	logDebug("Received request: ", formatJson(request))

	requestType = request.type
	args = request.args
	request.timespan = createObject("roTimespan")

	response = Invalid
	if requestType = "callFunc" then
		response = processCallFuncRequest(args)
	else if requestType = "getFocusedNode" then
		response = processGetFocusedNodeRequest(args)
	else if requestType = "getValue" then
		response = processGetValueRequest(args)
	else if requestType = "getValues" then
		response = processGetValuesRequest(args)
	else if requestType = "hasFocus" then
		response = processHasFocusRequest(args)
	else if requestType = "isInFocusChain" then
		response = processIsInFocusChainRequest(args)
	else if requestType = "onFieldChangeOnce" then
		response = processOnFieldChangeOnceRequest(request)
	else if requestType = "setValue" then
		response = processSetValueRequest(args)
	else if requestType = "getAllCount" then
		response = processGetAllCountRequest(args)
	else if requestType = "getRootsCount" then
		response = processGetRootsCountRequest(args)
	else if requestType = "storeNodeReferences" then
		response = processStoreNodeReferencesRequest(args)
	else if requestType = "deleteNodeReferences" then
		response = processDeleteNodeReferencesRequest(args)
	else if requestType = "getNodesInfo" then
		response = processGetNodesInfoRequest(args)
	else if requestType = "getNodesWithProperties" then
		response = processGetNodesWithPropertiesRequest(args)
	else if requestType = "startResponsivenessTesting" then
		response = processStartResponsivenessTestingRequest(args)
	else if requestType = "getResponsivenessTestingData" then
		response = processGetResponsivenessTestingDataRequest(args)
	else if requestType = "stopResponsivenessTesting" then
		response = processStopResponsivenessTestingRequest(args)
	else if requestType = "disableScreenSaver" then
		response = processDisableScreenSaverRequest(args)
	else if requestType = "focusNode" then
		response = processFocusNodeRequest(args)
	else if requestType = "removeNodeChildren" then
		response = processRemoveNodeChildrenRequest(args)
	else if requestType = "setSettings" then
		setLogLevel(getStringAtKeyPath(args, "logLevel"))
		response = {}
	else
		response = buildErrorResponseObject("Request type '" + requestType + "' not handled in this version")
	end if

	if response <> Invalid then
		sendResponseToTask(request, response)
	end if
end sub

function processCallFuncRequest(args as Object) as Object
	result = processGetValueRequest(args)
	if isErrorObject(result) then
		return result
	end if

	node = result.value
	if NOT isNode(node) then
		keyPath = getStringAtKeyPath(args, "keyPath")
		return buildErrorResponseObject("Node not found at key path '" + keyPath + "'")
	end if

	funcName = args.funcName
	if NOT isNonEmptyString(funcName) then
		return buildErrorResponseObject("CallFunc request did not have valid 'funcName' param passed in")
	end if

	p = args.funcParams
	if p = Invalid then p = []

	paramsCount = p.count()

	if paramsCount = 0 then
		' callFunc could fail on certain devices in the past if no param was passed. Leaving this up to the user of library as of 2.0 release
		result = node.callFunc(funcName)
	else if paramsCount = 1 then
		result = node.callFunc(funcName, p[0])
	else if paramsCount = 2 then
		result = node.callFunc(funcName, p[0], p[1])
	else if paramsCount = 3 then
		result = node.callFunc(funcName, p[0], p[1], p[2])
	else if paramsCount = 4 then
		result = node.callFunc(funcName, p[0], p[1], p[2], p[3])
	else if paramsCount = 5 then
		result = node.callFunc(funcName, p[0], p[1], p[2], p[3], p[4])
	else if paramsCount = 6 then
		result = node.callFunc(funcName, p[0], p[1], p[2], p[3], p[4], p[5])
	else if paramsCount = 7 then
		result = node.callFunc(funcName, p[0], p[1], p[2], p[3], p[4], p[5], p[6])
	end if

	return {
		"value": result
	}
end function

function processGetFocusedNodeRequest(args as Object) as Object
	focusedNode = getFocusedNode()
	result = {}

	if getBooleanAtKeyPath(args, "includeNode", true) then
		result.node = focusedNode
	end if

	node = focusedNode
	parent = node.getParent()
	keyPathParts = []

	while parent <> invalid
		nodeId = node.id
		if nodeId <> "" then
			keyPathParts.unshift("#" + nodeId)
		else
			keyPathParts.unshift(getNodeParentIndex(node, parent).toStr())
		end if

		node = parent
		parent = node.getParent()
	end while
	result["keyPath"] = keyPathParts.join(".")

	if getBooleanAtKeyPath(args, "includeRef") then
		nodeRefKey = args.nodeRefKey

		if NOT isNonEmptyString(nodeRefKey) then
			return buildErrorResponseObject("Invalid value supplied for 'key' param")
		end if

		storedNodes = m.nodeReferences[nodeRefKey]
		if NOT isArray(storedNodes) then
			return buildErrorResponseObject("Invalid nodeRefKey supplied '" + nodeRefKey + "'. Make sure you have stored first")
		end if

		arrayGridChildItemContent = invalid
		if getBooleanAtKeyPath(args, "returnFocusedArrayGridChild") AND focusedNode.isSubtype("ArrayGrid") AND focusedNode.content <> Invalid then
			rowItemFocused = focusedNode.rowItemFocused
			if isArray(rowItemFocused) AND rowItemFocused.count() = 2 then
				arrayGridChildItemContent = focusedNode.content.getChild(rowItemFocused[0]).getChild(rowItemFocused[1])
			else
				arrayGridChildItemContent = focusedNode.content.getChild(focusedNode.itemFocused)
			end if
		end if

		if arrayGridChildItemContent <> invalid then
			for i = 0 to getLastIndex(storedNodes)
				node = storedNodes[i]
				if NOT node.isSubtype("ContentNode") AND isNode(node.itemContent) AND node.itemContent.isSameNode(arrayGridChildItemContent) then
					result.node = node
					result.ref = i
					exit for
				end if
			end for
		else
			for i = 0 to getLastIndex(storedNodes)
				nodeReference = storedNodes[i]
				if focusedNode.isSameNode(nodeReference) then
					result.ref = i
					exit for
				end if
			end for
		end if
	end if

	return result
end function

function processGetValueRequest(args as Object) as Object
	base = getBaseObject(args)
	if isErrorObject(base) then
		return base
	end if

	keyPath = getStringAtKeyPath(args, "keyPath")

	if isNonEmptyString(keyPath) then
		value = getValueAtKeyPath(base, keyPath, "[[VALUE_NOT_FOUND]]")
		found = NOT isString(value) OR value <> "[[VALUE_NOT_FOUND]]"
	else
		value = base
		found = true
	end if

	result = {
		"found": found
	}

	if found then
		result.value = value
	end if

	return result
end function

function processGetValuesRequest(args as Object) as Object
	requests = args.requests
	if NOT isNonEmptyAA(requests) then
		return buildErrorResponseObject("getValues did not have have any requests")
	end if
	results = {}
	for each key in requests
		result = processGetValueRequest(requests[key])
		if isErrorObject(result) then
			return result
		end if
		results[key] = result
	end for
	return {
		"results": results
	}
end function

function processGetNodesInfoRequest(args as Object) as Object
	requests = args.requests
	if NOT isNonEmptyAA(requests) then
		return buildErrorResponseObject("getNodesInfo did not have have any requests")
	end if

	results = {}
	for each key in requests
		requestArgs = requests[key]
		result = processGetValueRequest(requestArgs)
		if isErrorObject(result) then
			return result
		end if

		node = result.value
		if NOT result.found OR NOT isNode(node) then
			return buildErrorResponseObject("Node not found at keypath '" + requestArgs.keyPath + "'")
		end if

		fields = {}
		fieldTypes = node.getFieldTypes()
		for each fieldKey in fieldTypes
			value = node[fieldKey]
			fields[fieldKey] = {
				"fieldType": fieldTypes[fieldKey]
				"type": type(value)
				"value": value
			}
		end for

		children = []
		for each child in node.getChildren(-1, 0)
			children.push({
				"subtype": child.subtype()
			})
		end for

		results[key] = {
			"subtype": node.subtype()
			"fields": fields
			"children": children
		}
	end for

	return {
		"results": results
	}
end function

function processHasFocusRequest(args as Object) as Object
	result = processGetValueRequest(args)
	if isErrorObject(result) then
		return result
	end if

	if result.found <> true then
		return buildErrorResponseObject("No value found at key path '" + getStringAtKeyPath(args, "keyPath") + "'")
	end if

	node = result.value
	if NOT isNode(node) then
		return buildErrorResponseObject("Value at key path '" + getStringAtKeyPath(args, "keyPath") + "' was not a node")
	end if

	return {
		"hasFocus": node.hasFocus()
	}
end function

function processIsInFocusChainRequest(args as Object) as Object
	result = processGetValueRequest(args)
	if isErrorObject(result) then
		return result
	end if

	if result.found <> true then
		return buildErrorResponseObject("No value found at key path '" + getStringAtKeyPath(args, "keyPath") + "'")
	end if

	node = result.value
	if NOT isNode(node) then
		return buildErrorResponseObject("Value at key path '" + getStringAtKeyPath(args, "keyPath") + "' was not a node")
	end if

	return {
		"isInFocusChain": node.isInFocusChain()
	}
end function

function processOnFieldChangeOnceRequest(request as Object) as Dynamic
	args = request.args
	requestId = request.id
	result = processGetValueRequest(args)
	if isErrorObject(result) then
		return result
	end if

	node = result.value
	field = args.field

	parentIsNode = isNode(node)
	fieldExists = parentIsNode AND node.doesExist(field)
	timePassed = 0
	if NOT parentIsNode OR NOT fieldExists then
		retryTimeout = args.retryTimeout
		if retryTimeout > 0 then
			request.id = request.id
			requestContext = request.context
			if requestContext = Invalid then
				timer = createObject("roSGNode", "Timer")
				timer.duration = args.retryInterval / 1000
				timer.id = requestId
				timer.observeFieldScoped("fire", "onProcessObserveFieldRequestRetryFired")

				requestContext = {
					"timer": timer
					"timespan": createObject("roTimespan")
				}
				request.context = requestContext
				m.activeObserveFieldRequests[requestId] = request
				timer.control = "start"
				return Invalid
			else
				timePassed = requestContext.timespan.totalMilliseconds()
				if timePassed < retryTimeout then
					timer = requestContext.timer
					if timePassed + args.retryInterval > retryTimeout then
						timer.duration = (retryTimeout - timePassed) / 1000
					end if
					timer.control = "start"
					return Invalid
				end if
			end if
		end if

		if NOT parentIsNode then
			errorMessage = "Node not found at key path '" + getStringAtKeyPath(args, "keyPath") + "'"
		else
			errorMessage = "Node did not have field named '" + field + "' at key path '" + getStringAtKeyPath(args, "keyPath") + "'"
		end if
		if timePassed > 0 then
			errorMessage += " timed out after " + timePassed.toStr() + "ms"
		end if
		logWarn(errorMessage)

		m.activeObserveFieldRequests.delete(requestId)
		sendResponseToTask(request, buildErrorResponseObject(errorMessage))

		' Might be called asynchronously, and we already handled this, so return Invalid
		return Invalid
	end if

	' If match was provided, check to see if it already matches the expected value
	match = args.match
	if isAA(match) then
		match.key = args.key
		result = processGetValueRequest(match)
		if isErrorObject(result) then
			return result
		end if

		' IMPROVEMENT hook into compareValues() functionality and eventually build out to support more complicated types
		if result.found AND result.value = match.value then
			return {
				"value": node[field]
				"observerFired": false
			}
		end if
	end if

	' Only want to observe if we weren't already observing this node field
	alreadyObserving = false
	for each observedRequestId in m.activeObserveFieldRequests
		activeObserveFieldRequest = m.activeObserveFieldRequests[observedRequestId]

		if node.isSameNode(activeObserveFieldRequest.node) AND activeObserveFieldRequest.args.field = field then
			logDebug("Already observing '" + field + "' at key path '" + getStringAtKeyPath(args, "keyPath") + "'")
			alreadyObserving = true
			exit for
		end if
	end for

	if NOT alreadyObserving then
		if node.observeFieldScoped(field, "observeFieldCallback") then
			logDebug("Now observing '" + field + "' at key path '" + getStringAtKeyPath(args, "keyPath") + "'")

			request.node = node
			m.activeObserveFieldRequests[requestId] = request
		else
			return buildErrorResponseObject("Could not observe field '" + field + "' at key path '" + getStringAtKeyPath(args, "keyPath") + "'")
		end if
	end if

	return Invalid
end function

sub onProcessObserveFieldRequestRetryFired(event as Object)
	requestId = event.getNode()
	request = m.activeObserveFieldRequests[requestId]
	response = processOnFieldChangeOnceRequest(request)

	' If response isn't invalid then we have to send it back ourselves
	if response <> Invalid then
		sendResponseToTask(request, response)
	end if
end sub

sub observeFieldCallback(event as Object)
	node = event.getRoSgNode()
	field = event.getField()
	data = event.getData()
	logDebug("Received callback for node field '" + field + "' with value ", data)
	nodeFound = false
	for each requestId in m.activeObserveFieldRequests
		request = m.activeObserveFieldRequests[requestId]
		args = request.args
		if node.isSameNode(request.node) AND args.field = field then
			logVerbose("Found matching requestId: " + requestId)
			nodeFound = true
			match = args.match
			if isAA(match) then
				result = processGetValueRequest(match)
				if isErrorObject(result) then
					sendResponseToTask(request, result)
					return
				end if

				if result.found = false OR result.value <> match.value then
					logVerbose("Match.value did not match requested value continuing to wait")
					return
				end if
			end if

			m.activeObserveFieldRequests.delete(requestId)
			sendResponseToTask(request, {
				"value": data
				"observerFired": true
			})
		end if
	end for

	if nodeFound then
		' If we got to here then we sent back all responses for this field so we can remove our observer now
		logDebug("Unobserved '" + field + "' on " + node.subtype() + "(" + node.id + ")")
		node.unobserveFieldScoped(field)
		return
	end if

	logError("Received callback for unknown node or field ", node)
end sub

function processSetValueRequest(args as Object) as Object
	keyPath = getStringAtKeyPath(args, "keyPath")
	result = processGetValueRequest(args)
	if isErrorObject(result) then
		return result
	end if

	if result.found <> true then
		return buildErrorResponseObject("No value found at key path '" + keyPath + "'")
	end if

	resultValue = result.value
	if NOT isKeyedValueType(resultValue) AND NOT isArray(resultValue) then
		return buildErrorResponseObject("keyPath '" + keyPath + "' can not have a value assigned to it")
	end if

	field = args.field
	if NOT isString(field) then
		return buildErrorResponseObject("Missing valid 'field' param")
	end if

	nodeParent = resultValue

	base = getBaseObject(args)
	if field = "" then
		updateAA = args.value
		if NOT isAA(updateAA) then
			return buildErrorResponseObject("If field is empty, then value must be an AA")
		end if
	else
		' Have to walk up the tree until we get to a node as anything that is a field on a node must be replaced
		parentKeyPath = keyPath
		parentKeyPathParts = parentKeyPath.tokenize(".").toArray()
		setKeyPathParts = []
		while NOT parentKeyPathParts.isEmpty()
			nodeParent = getValueAtKeyPath(base, parentKeyPathParts.join("."))
			if isNode(nodeParent) then
				exit while
			else
				setKeyPathParts.unshift(parentKeyPathParts.pop())
			end if
		end while

		if setKeyPathParts.isEmpty() then
			updateAA = createCaseSensitiveAA(field, args.value)
		else
			setKeyPathParts.push(field)
			nodeFieldKey = setKeyPathParts.shift()
			nodeFieldValueCopy = nodeParent[nodeFieldKey]
			setValueAtKeyPath(nodeFieldValueCopy, setKeyPathParts.join("."), args.value)
			updateAA = createCaseSensitiveAA(nodeFieldKey, nodeFieldValueCopy)
		end if
	end if

	if NOT isNode(nodeParent) then
		nodeParent = base
	end if

	nodeParent.update(updateAA, true)
	return {}
end function

function processGetAllCountRequest(args as Object) as Object
	return calculateNodeCount(m.top.getAll())
end function

function processGetRootsCountRequest(args as Object) as Object
	return calculateNodeCount(m.top.getRoots())
end function

function calculateNodeCount(nodes) as Object
	result = {}
	nodeCountByType = {}

	result["totalNodes"] = nodes.count()
	result["nodeCountByType"] = nodeCountByType

	for each node in nodes
		nodeType = node.subtype()
		if nodeCountByType[nodeType] = Invalid then
			nodeCountByType[nodeType] = 0
		end if
		nodeCountByType[nodeType]++
	end for

	return result
end function

function processStoreNodeReferencesRequest(args as Object) as Object
	nodeRefKey = args.nodeRefKey

	includeArrayGridChildren = getBooleanAtKeyPath(args, "includeArrayGridChildren")
	includeNodeCountInfo = getBooleanAtKeyPath(args, "includeNodeCountInfo")
	includeBoundingRectInfo = getBooleanAtKeyPath(args, "includeBoundingRectInfo")

	if NOT isNonEmptyString(nodeRefKey) then
		return buildErrorResponseObject("Invalid value supplied for 'nodeRefKey' param")
	end if

	storedNodes = []
	' Clear out old nodes before getting next retrieval of nodes
	m.nodeReferences[nodeRefKey] = storedNodes
	flatTree = []

	arrayGridNodes = {}
	scene = m.top.getScene()
	buildTree(storedNodes, flatTree, scene, includeArrayGridChildren, arrayGridNodes)

	result = {
		"flatTree": flatTree
	}

	arrayGridComponents = {}
	nodeCountByType = {}
	itemComponentNodes = []

	if includeArrayGridChildren OR includeNodeCountInfo then
		if includeArrayGridChildren then
			for each key in arrayGridNodes
				node = arrayGridNodes[key]
				componentName = node.itemComponentName
				if isString(componentName) then
					arrayGridComponents[componentName] = true
				else if isString(node.channelInfoComponentName) then
					componentName = node.channelInfoComponentName
					arrayGridComponents[componentName] = true
				end if
			end for
		end if

		allNodes = m.top.getAll()
		result["totalNodes"] = allNodes.count()
		for each node in allNodes
			nodeType = node.subtype()
			if nodeCountByType[nodeType] = Invalid then
				nodeCountByType[nodeType] = 0
			end if
			nodeCountByType[nodeType]++

			if includeArrayGridChildren AND arrayGridComponents[nodeType] = true then
				itemComponentNodes.push(node)
			end if
		end for

		if includeArrayGridChildren then
			buildItemComponentTrees(storedNodes, flatTree, itemComponentNodes, arrayGridNodes, allNodes, includeBoundingRectInfo)
		end if

		result["nodeCountByType"] = nodeCountByType
	end if

	if includeBoundingRectInfo then
		for each nodeTree in flatTree
			' We use the visible field we added to only calculate rect if this is a RenderableNode.
			if nodeTree.visible <> Invalid then
				node = storedNodes[nodeTree.ref]

				if arrayGridComponents[nodeTree.subtype] = true then
					' We need to get rect differently for our arrayGridComponents as the x and y are often wrong if we called sceneBoundingRect on the ArrayGrid component itself
					parentTree = flatTree[nodeTree.parentRef]
					itemIndex = [nodeTree.position.toStr()]

					' We need to build our properly formatted itemNumber string by walking up the parents until we get to the outer ArrayGrid parent. We can't use the inner MarkupGrid as this gives incorrect results sometimes as well.
					while parentTree <> Invalid
						if parentTree.subtype = "RowListItem" then
							itemIndex.unshift(parentTree.position.toStr())
						else if parentTree.sequestered <> true then
							' Once we hit our first non sequestered parent we know we've hit our parent ArrayGrid
							itemNumber = "item" + itemIndex[0]
							if itemIndex.count() = 2 then
								itemNumber += "_" + itemIndex[1]
							end if
							' For debugging
							' nodeTree["itemNumber"] = itemNumber
							nodeTree["sceneRect"] = storedNodes[parentTree.ref].sceneSubBoundingRect(itemNumber)
							exit while
						end if

						parentTree = flatTree[parentTree.parentRef]
					end while
				else if nodeTree.rect = Invalid AND nodeTree.sceneRect = Invalid AND nodeTree.sequestered <> true then
					' We don't want to try and get rects for sequestered nodes as those values are often wrong.
					nodeTree["sceneRect"] = node.sceneBoundingRect()
				end if
			end if
		end for

		if m.currentDesignResolution = invalid then
			m.currentDesignResolution = scene.currentDesignResolution
		end if
		result["currentDesignResolution"] = m.currentDesignResolution
	end if

	m.nodeReferences[nodeRefKey] = storedNodes

	return result
end function

' ArrayGrid children can't be built with a normal call to buildTree since you can only get the parent not the children.
' Often times nodes are in different spots, so this will also standardize them to a single consistent spot
sub buildItemComponentTrees(storedNodes as Object, flatTree as Object, itemComponentNodes as Object, arrayGridNodes as Object, allNodes as Object, includeBoundingRectInfo = false as Boolean)
	unparentedItemComponentNodeBranch = []

	' Serves as a place to store the nodeBranch and allows us to only have to check a small subset of the nodes for a matching parent
	internalRowListItemNodeBranches = []
	internalMarkupGridNodeBranches = []

	for each itemComponentNode in itemComponentNodes
		itemContent = itemComponentNode.itemContent
		position = -1
		if itemContent <> Invalid then
			position = getNodeParentIndex(itemContent, itemContent.getParent())
		end if

		' So we know how many nodes we need to handle afterwards if includeBoundingRectInfo is true
		startingIndex = storedNodes.count() + 1 ' + 1 since we don't need rect for item component itself
		childNodeBranch = buildTree(storedNodes, flatTree, itemComponentNode, false, {}, -1, position)
		if includeBoundingRectInfo then
			for i = startingIndex to storedNodes.count() - 1
				flatTree[i].rect = storedNodes[i].boundingRect()
			end for
		end if

		parent = itemComponentNode.getParent()

		' If we don't have a parent we want to handle parentRef based off of itemContent later
		if NOT isNode(parent) then
			' If no parent just store for now
			unparentedItemComponentNodeBranch.push(childNodeBranch)
		else
			' If we had a parent then we want to walk up until we reach the visible arrayGrid, storing each node as we go and then going back and building the node tree for each
			shouldContinue = true
			while shouldContinue
				nodeBranch = Invalid

				' This helps match up what ArrayGrid in the nodeTree we are connected to. We only want it if it's an external ArrayGrid not the internal ones inside RowList
				if parent.isSubtype("ArrayGrid") AND getNodeSubtype(parent.getParent()) <> "RowListItem" then
					for each nodeRef in arrayGridNodes
						' Look for the visible ArrayGrid this renderer belongs to
						if arrayGridNodes[nodeRef].isSameNode(parent) then
							childNodeBranch["parentRef"] = nodeRef.toInt()
							' We've reached the top so go ahead and exit the while loop
							exit for
						end if
					end for
					' Roku gets in weird state if we try and exit out of while loop in for loop
					exit while
				end if

				' If our parent is Group and grandparent is RowListItem then we change our perceived parent to be the MarkupGrid for easier understanding
				if parent.subtype() = "Group" AND parent.getParent().subtype() = "RowListItem" then
					' Walk up to the RowListItem
					rowListItem = parent.getParent()
					for i = 0 to getLastIndex(rowListItem)
						' Once we find the MarkupGrid make it the parent
						child = rowListItem.getChild(i)
						if child.subtype() = "MarkupGrid" then
							parent = child
						end if
					end for
				end if

				' Check if the parent has already been captured
				for each internalRowListItemNodeBranch in internalRowListItemNodeBranches
					rowListItem = storedNodes[internalRowListItemNodeBranch.ref]
					if parent.isSameNode(rowListItem) then
						nodeBranch = internalRowListItemNodeBranch
						exit for
					end if
				end for

				if nodeBranch = Invalid then
					for each internalMarkupGridNodeBranch in internalMarkupGridNodeBranches
						markupGrid = storedNodes[internalMarkupGridNodeBranch.ref]
						if parent.isSameNode(markupGrid) then
							nodeBranch = internalMarkupGridNodeBranch
							exit for
						end if
					end for
				end if

				' If not go ahead and make a nodeBranch for it
				if nodeBranch = Invalid then
					position = getNodeParentIndex(parent, parent.getParent())
					nodeBranch = addNodeToTree(storedNodes, flatTree, parent, -1, position, true)
					nodeType = nodeBranch.subtype
					if nodeType = "RowListItem" then
						internalRowListItemNodeBranches.push(nodeBranch)
					else if nodeType = "MarkupGrid" then
						internalMarkupGridNodeBranches.push(nodeBranch)
					else
						logError("Encountered unexpected node type '" + nodeType + "' while handling ArrayGrid items")
					end if
				end if

				' Go ahead and assign parentRef now that we have made the parent
				childNodeBranch["parentRef"] = nodeBranch.ref

				' Used on subsequent loop
				childNodeBranch = nodeBranch
				parent = parent.getParent()
				if parent = Invalid then
					' We can hit this if the arrayGrid is being kept alive by a brightscript reference but isn't connected to the scene tree
					exit while
				end if
			end while
		end if
	end for

	' Now go through each of the unparented items and use the content to find its matching parent
	for each itemComponentNodeBranch in unparentedItemComponentNodeBranch
		itemComponentNode = storedNodes[itemComponentNodeBranch.ref]
		itemContentParent = itemComponentNode.itemContent.getParent()
		if itemContentParent <> invalid then
			' Go through the MarkupGrids we have already found and try to find a match based on content nodes.
			for each internalMarkupGridNodeBranch in internalMarkupGridNodeBranches
				markupGrid = storedNodes[internalMarkupGridNodeBranch.ref]
				if itemContentParent.isSameNode(markupGrid.content) then
					itemComponentNodeBranch["parentRef"] = internalMarkupGridNodeBranch.ref
					exit for
				end if
			end for

			' If we found a match above then none of this gets called
			if itemComponentNodeBranch.parentRef = -1 then
				' IMPROVEMENT look into optimization by removing nodes from allNodes we'll never use (content node etc)

				' Walk up until we hit the ArrayGrid and find out if we have a title component we can search for
				rowTitleComponentName = invalid
				parent = itemContentParent
				while true
					if parent.isSubtype("ArrayGrid") then
						rowTitleComponentName = parent.rowTitleComponentName
						exit while
					end if
					parent = parent.getParent()
					if parent = invalid then
						exit while
					end if
				end while

				' Proceed only if we have a row title component
				if rowTitleComponentName <> invalid then
					for each node in allNodes
						if node.subtype() = rowTitleComponentName AND itemContentParent.isSameNode(node.content) then
							' We found the rowTitleComponentNode for this row. Store the RowListItem and MarkupGrid for this item. The rowTitleComponentNode will be handled in the final loop of this function
							rowListItem = node.getParent().getParent()

							' Find our parent ArrayGrid
							parentRef = -1
							for each nodeRef in arrayGridNodes
								if arrayGridNodes[nodeRef].isSameNode(rowListItem.getParent()) then
									parentRef = nodeRef.toInt()
									exit for
								end if
							end for

							position = getNodeParentIndex(rowListItem, rowListItem.getParent())
							rowListItemNodeBranch = addNodeToTree(storedNodes, flatTree, rowListItem, parentRef, position)
							internalRowListItemNodeBranches.push(rowListItemNodeBranch)

							' Go through the RowListItem's children to get the internal MarkupGrid
							for i = 0 to getLastIndex(rowListItem)
								child = rowListItem.getChild(i)
								if child.subtype() = "MarkupGrid" then
									markupGridNodeBranch = addNodeToTree(storedNodes, flatTree, child, rowListItemNodeBranch.ref, i)
									internalMarkupGridNodeBranches.push(markupGridNodeBranch)
									itemComponentNodeBranch["parentRef"] = markupGridNodeBranch.ref
								end if
							end for
							exit for
						end if
					end for
				end if
			end if

			if itemComponentNodeBranch.parentRef = -1 then
				' Was throwing away but seems to cause issue so commenting out for now. Will likely just handle with the improvement below eventually instead
				' for i = 0 to getLastIndex(flatTree)
				' 	ref = flatTree[i].ref
				' 	if ref <> -1 AND ref = itemComponentNodeBranch.ref then
				' 		flatTree.delete(i)
				' 		exit for
				' 	end if
				' end for
				' IMPROVEMENT We weren't able to find the parent so we could make up the node structure to match a standard output and still give a parented output.
			end if
		end if
	end for

	' Do position and adding children for RowListItem here so we only have to it once for each
	for each internalRowListItemNodeBranch in internalRowListItemNodeBranches
		rowListItem = storedNodes[internalRowListItemNodeBranch.ref]
		for i = 0 to getLastIndex(rowListItem)
			child = rowListItem.getChild(i)

			' First index is title info that we want to make available for external use as well
			if i = 0 then
				buildTree(storedNodes, flatTree, child, false, {}, internalRowListItemNodeBranch.ref, i, true)
			else if child.subtype() = "MarkupGrid" then
				' Need to get position from the child MarkupGrid content
				content = child.content
				internalRowListItemNodeBranch.position = getNodeParentIndex(content, content.getParent())
			end if
		end for
	end for
end sub

' @sequestered - boolean to let us know if this is a non item component child of an ArrayGrid so we have to treat it differently
function addNodeToTree(storedNodes as Object, flatTree as Object, node as Object, parentRef = -1 as Integer, position = -1 as Integer, sequestered = false as Boolean) as Object
	currentNodeReference = storedNodes.count()
	storedNodes.push(node)

	nodeSubtype = node.subtype()
	nodeBranch = {
		"subtype": nodeSubtype
		"id": node.id
		"ref": currentNodeReference
		"parentRef": parentRef
		"position": position
	}

	if sequestered then
		nodeBranch.sequestered = true
	end if

	' Only add the following fields if we extend from Group. Note node.isSubtype("Group") returns false if called on a Group node. This necessitates the second check.
	if node.isSubtype("Group") OR nodeSubtype = "Group" then
		nodeBranch.visible = node.visible
		nodeBranch.opacity = node.opacity
		nodeBranch.translation = node.translation
	end if

	flatTree.push(nodeBranch)

	return nodeBranch
end function

' @sequestered - boolean to let us know if this is a non item component child of an ArrayGrid so we have to treat it differently
function buildTree(storedNodes as Object, flatTree as Object, node as Object, searchForArrayGrids as Boolean, arrayGridNodes = {} as Object, parentRef = -1 as Integer, position = -1 as Integer, sequestered = false as Boolean) as Object
	nodeBranch = addNodeToTree(storedNodes, flatTree, node, parentRef, position, sequestered)
	nodeRef = nodeBranch.ref
	if searchForArrayGrids AND node.isSubtype("ArrayGrid") then
		arrayGridNodes[nodeRef.toStr()] = node
	end if

	childPosition = 0
	for each childNode in node.getChildren(-1, 0)
		buildTree(storedNodes, flatTree, childNode, searchForArrayGrids, arrayGridNodes, nodeRef, childPosition)
		childPosition++
	end for

	return nodeBranch
end function

function processDeleteNodeReferencesRequest(args as Object) as Object
	nodeRefKey = args.nodeRefKey
	if NOT isString(nodeRefKey) then
		return buildErrorResponseObject("Invalid value supplied for 'key' param")
	end if
	m.nodeReferences.delete(nodeRefKey)

	return {}
end function

function processGetNodesWithPropertiesRequest(args as Object) as Object
	nodeRefKey = args.nodeRefKey
	if NOT isString(nodeRefKey) then
		return buildErrorResponseObject("Invalid value supplied for 'nodeRefKey' param")
	end if

	storedNodes = m.nodeReferences[nodeRefKey]
	if NOT isArray(storedNodes) then
		return buildErrorResponseObject("Invalid nodeRefKey supplied '" + nodeRefKey + "'. Make sure you have stored first")
	end if

	matchingNodes = []
	matchingNodeRefs = []
	properties = args.properties
	for nodeRef = 0 to getLastIndex(storedNodes)
		node = storedNodes[nodeRef]
		nodeMatches = true
		for each property in properties
			result = doesNodeHaveProperty(node, property)
			if result = -1 then
				return buildErrorResponseObject("Invalid type for property " + formatJson(property))
			end if

			if result = 0 then
				nodeMatches = false
				exit for
			end if
		end for
		if nodeMatches then
			matchingNodes.push(node)
			matchingNodeRefs.push(nodeRef)
		end if
	end for

	return {
		"nodes": matchingNodes
		"nodeRefs": matchingNodeRefs
	}
end function

' Returns 0 if no, 1 if yes and -1 if the comparison isn't possible on the current type
function doesNodeHaveProperty(node as Object, property as Object) as Integer
	result = 0
	operator = property.operator
	fields = property.fields
	if isArray(fields) then
		for each field in fields
			if node.hasField(field) then
				result = compareValues(operator, node[field], property.value)
				if result <> 0 then
					return result
				end if
			end if
		end for
	else if isArray(property.keyPaths) then
		for each keyPath in property.keyPaths
			' Route through keypath functionality to allow more advanced searches
			actualValue = getValueAtKeyPath(node, keyPath, "[[VALUE_NOT_FOUND]]")
			found = NOT isString(actualValue) OR actualValue <> "[[VALUE_NOT_FOUND]]"

			if found then
				result = compareValues(operator, actualValue, property.value)
				if result <> 0 then
					return result
				end if
			end if
		end for
	end if

	return 0
end function

' Returns 0 if no, 1 if yes and -1 if the comparison isn't possible on the current type
function compareValues(operator as String, a as Dynamic, b as Dynamic) as Integer
	result = 0
	if operator = "equal" then
		if a = b then
			return 1
		end if
	else if operator = "notEqual" then
		if a <> b then
			return 1
		end if
	else if operator = "greaterThan" OR operator = "greaterThanEqualTo" OR operator = "lessThan" OR operator = "lessThanEqualTo" then
		if isNumber(a) AND isNumber(b) then
			if operator = "greaterThan" then
				if a > b then
					return 1
				end if
			else if operator = "greaterThanEqualTo" then
				if a >= b then
					return 1
				end if
			else if operator = "lessThan" then
				if a < b then
					return 1
				end if
			else if operator = "lessThanEqualTo" then
				if a <= b then
					return 1
				end if
			end if
		else
			result = -1
		end if
	else if operator = "in" OR operator = "!in" then
		' Only string checking allowed for now
		if isString(a) AND isString(b) then
			found = a.instr(b) >= 0

			if operator = "in" AND found then
				return 1
			else if operator = "!in" AND NOT found then
				return 1
			end if
		else
			result = -1
		end if
	end if

	return result
end function

function processDisableScreenSaverRequest(args as Object) as Object
	if getBooleanAtKeyPath(args, "disableScreenSaver") then
		if m.videoNode = Invalid then
			m.videoNode = m.top.createChild("Video")
			m.videoNode.disableScreenSaver = true
		end if
	else
		if m.videoNode <> Invalid then
			m.top.removeChild(m.videoNode)
			m.videoNode = Invalid
		end if
	end if
	return {}
end function

function processStartResponsivenessTestingRequest(args as Object) as Object
	' Using 60 FPS as our baseline but timers work on a millisecond level so everything is a little bit off
	defaultTickDuration = 16
	m.responsivenessTestingTickDuration = getNumberAtKeyPath(args, "tickDuration", defaultTickDuration)

	defaultPeriodTickCount = 60
	m.responsivenessTestingPeriodTickCount = getNumberAtKeyPath(args, "periodTickCount", defaultPeriodTickCount)

	defaultPeriodsTrackCount = 10
	m.responsivenessTestingperiodsTrackCount = getNumberAtKeyPath(args, "periodsTrackCount", defaultPeriodsTrackCount)

	if m.responsivenessTestingCurrentPeriodTimeSpan = invalid then
		m.responsivenessTestingCurrentPeriodTimer = createObject("roSGNode", "Timer")
		m.responsivenessTestingCurrentPeriodTimer.observeFieldScoped("fire", "onResponsivenessTestingCurrentPeriodTimerFire")
		m.responsivenessTestingCurrentPeriodTimer.duration = m.responsivenessTestingPeriodTickCount * m.responsivenessTestingTickDuration / 1000
		m.responsivenessTestingCurrentPeriodTimer.repeat = true

		m.responsivenessTestingTickTimer = createObject("roSGNode", "Timer")
		m.responsivenessTestingTickTimer.observeFieldScoped("fire", "onResponsivenessTestingTickTimerFire")
		m.responsivenessTestingTickTimer.duration = m.responsivenessTestingTickDuration / 1000
		m.responsivenessTestingTickTimer.repeat = true

		m.responsivenessTestingCurrentPeriodTimeSpan = createObject("roTimespan")
		m.responsivenessTestingTotalTimeSpan = createObject("roTimespan")
	end if

	m.responsivenessTestingData = {
		"periods": []
		"totalTicks": 0
	}

	m.responsivenessTestingTotalTimeSpan.mark()
	m.responsivenessTestingCurrentPeriodTimeSpan.mark()
	m.responsivenessTestingCurrentPeriodTickCount = 0

	m.responsivenessTestingTickTimer.control = "start"
	m.responsivenessTestingCurrentPeriodTimer.control = "start"
	return {}
end function

function processStopResponsivenessTestingRequest(args as Object) as Object
	if m.responsivenessTestingTickTimer <> invalid then
		m.responsivenessTestingTickTimer.control = "stop"
		m.responsivenessTestingCurrentPeriodTimer.control = "stop"
		m.delete("responsivenessTestingCurrentPeriodTimeSpan")
		m.delete("responsivenessTestingTotalTimeSpan")
		m.delete("responsivenessTestingTickTimer")
		m.delete("responsivenessTestingCurrentPeriodTimer")
		m.delete("responsivenessTestingData")
	end if

	return {}
end function

sub onResponsivenessTestingTickTimerFire()
	m.responsivenessTestingCurrentPeriodTickCount++
end sub

sub onResponsivenessTestingCurrentPeriodTimerFire()
	elapsedTime = m.responsivenessTestingCurrentPeriodTimeSpan.totalMilliseconds()
	m.responsivenessTestingCurrentPeriodTimeSpan.mark()

	numberOfExpectedTicks = cint(elapsedTime / m.responsivenessTestingTickDuration)

	tickCount = m.responsivenessTestingCurrentPeriodTickCount

	m.responsivenessTestingCurrentPeriodTickCount = 0

	periods = m.responsivenessTestingData.periods
	periods.push({
		"duration": elapsedTime
		"tickCount": tickCount
		"percent": safeDivide(tickCount, numberOfExpectedTicks) * 100
	})

	m.responsivenessTestingData.totalTicks += tickCount

	while periods.count() > m.responsivenessTestingperiodsTrackCount
		periods.shift()
	end while
end sub

function processGetResponsivenessTestingDataRequest(args as Object) as Object
	if m.responsivenessTestingData = invalid then
		return buildErrorResponseObject("Responsiveness testing is not started. Be sure to call 'startResponsivenessTesting()' first")
	end if

	tickDuration = m.responsivenessTestingTickDuration

	totalTime = m.responsivenessTestingTotalTimeSpan.totalMilliseconds()
	totalTicks = m.responsivenessTestingData.totalTicks + m.responsivenessTestingCurrentPeriodTickCount
	numberOfExpectedTicks = cint(totalTime / tickDuration)

	return {
		"periods": m.responsivenessTestingData.periods
		"periodTickCount": m.responsivenessTestingPeriodTickCount
		"periodsTrackCount": m.responsivenessTestingperiodsTrackCount
		"tickDuration": tickDuration
		"testingTotals": {
			"duration": totalTime
			"percent": safeDivide(totalTicks, numberOfExpectedTicks) * 100
			"tickCount": totalTicks
		}
	}
end function

function processFocusNodeRequest(args as Object) as Object
	result = processGetValueRequest(args)
	if isErrorObject(result) then
		return result
	end if

	if result.found <> true then
		keyPath = getStringAtKeyPath(args, "keyPath")
		return buildErrorResponseObject("No value found at key path '" + keyPath + "'")
	end if

	node = result.value
	if NOT isNode(node) then
		keyPath = getStringAtKeyPath(args, "keyPath")
		return buildErrorResponseObject("Value at key path '" + keyPath + "' was not a node")
	end if

	node.setFocus(getBooleanAtKeyPath(args, "on", true))

	return {}
end function

function processRemoveNodeChildrenRequest(args as Object) as Object
	result = processGetValueRequest(args)
	if isErrorObject(result) then
		return result
	end if

	if result.found <> true then
		keyPath = getStringAtKeyPath(args, "keyPath")
		return buildErrorResponseObject("No value found at key path '" + keyPath + "'")
	end if

	node = result.value
	if NOT isNode(node) then
		keyPath = getStringAtKeyPath(args, "keyPath")
		return buildErrorResponseObject("Value at key path '" + keyPath + "' was not a node")
	end if

	index = getNumberAtKeyPath(args, "index")
	count = getNumberAtKeyPath(args, "count", 1)

	if count = -1 then
		count = node.getChildCount()
	end if

	node.removeChildrenIndex(count, index)

	return {}
end function

function getBaseObject(args as Object) as Dynamic
	baseType = getStringAtKeyPath(args, "base")
	if baseType = "global" then return m.global
	if baseType = "scene" then return m.top.getScene()
	if baseType = "focusedNode" then return getFocusedNode()
	if baseType = "nodeRef" then
		nodeRefKey = getStringAtKeyPath(args, "nodeRefKey")
		base = m.nodeReferences[nodeRefKey]
		if base = Invalid then
			return buildErrorResponseObject("Invalid nodeRefKey supplied '" + nodeRefKey + "'. Make sure you have stored first")
		else
			return base
		end if
	end if
	return buildErrorResponseObject("Invalid base type supplied '" + baseType + "'")
end function

sub sendResponseToTask(request as Object, response as Object)
	if getBooleanAtKeyPath(request, "args.convertResponseToJsonCompatible", true) then
		response = recursivelyConvertValueToJsonCompatible(response, getNumberAtKeyPath(request, "args.responseMaxChildDepth"))
	end if

	response.id = request.id
	response["timeTaken"] = request.timespan.totalMilliseconds()
	m.task.renderThreadResponse = response
end sub

function recursivelyConvertValueToJsonCompatible(value as Object, maxChildDepth as Integer, depth = 0 as Integer) as Object
	if isArray(value) then
		for i = 0 to getLastIndex(value)
			value[i] = recursivelyConvertValueToJsonCompatible(value[i], maxChildDepth)
		end for
	else if isAA(value) then
		for each key in value
			value[key] = recursivelyConvertValueToJsonCompatible(value[key], maxChildDepth)
		end for
	else if isNode(value) then
		node = value
		value = node.getFields()
		value.delete("focusedChild")
		value.subtype = node.subtype()
		value = recursivelyConvertValueToJsonCompatible(value, maxChildDepth)
		if maxChildDepth > depth then
			children = []
			for each child in node.getChildren(-1, 0)
				children.push(recursivelyConvertValueToJsonCompatible(child, maxChildDepth, depth + 1))
			end for
			value.children = children
		end if
	end if
	return value
end function
