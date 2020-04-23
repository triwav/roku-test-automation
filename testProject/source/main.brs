sub main()
	screen = createObject("roSGScreen")
	scene = screen.createScene("MainScene")
	port = createObject("roMessagePort")
	screen.show()

	while(true)
		sleep(10000)
	end while
end sub
