sub main()
	screen = createObject("roSGScreen")
	scene = screen.createScene("MainScene")
	port = createObject("roMessagePort")
	screen.show()

	while(true)
		sleep(6000000)
	end while
end sub
