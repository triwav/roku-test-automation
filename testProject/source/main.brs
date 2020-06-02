sub main()
	screen = createObject("roSGScreen")
	scene = screen.createScene("MainScene")
	port = createObject("roMessagePort")
	screen.show()

	while(true)
		sleep(1000)
	end while
end sub
