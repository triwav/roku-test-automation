sub init()
	m.top.profiles = {
		"profile1": {
			"name": "Tom"
			"settings": {
				"autoplay": true
				"personalization": {
					"showRecommended": true,
					"showContinueWatching": true
				}
			}
		}
	}
end sub

function loginUser(_)
	m.top.isLoggedIn = true
end function
