export interface ActiveAppResponse {
	app?: ActiveAppItemResponse;
	screensaver?: ActiveAppItemResponse;
}

export interface ActiveAppItemResponse {
	id?: string;
	title: string;
	type?: string;
	version?: string;
}
