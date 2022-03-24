sub main()
	screen = createObject("roSGScreen")
	screen.createScene("MainScene")
	screen.show()

	' Write a test registry value we can check against
	testSection = createObject("roRegistrySection", "testSection")
	testSection.writeMulti({
		"number": "1"
		"boolean": "true"
	})
	testSection.flush()

	' vscode_rale_tracker_entry

	while(true)
		sleep(1000)
	end while
end sub
