export interface MediaPlayerResponse {
	state: string;
	error: boolean;
	plugin?: MediaPlayerPlugin;
	format?: MediaPlayerFormat;
	buffering?: MediaPlayerBuffering;
	new_stream?: MediaPlayerNewStream;
	position?: MediaPlayerPosition;
	duration?: MediaPlayerDuration;
	is_live?: MediaPlayerIsLive;
	runtime?: MediaPlayerRuntime;
	stream_segment?: MediaPlayerStreamSegment;
}

export interface MediaPlayerPlugin {
	bandwidth: string;
	id: string;
	name: string;
}

export interface MediaPlayerFormat {
	audio: string;
	captions: string;
	container: string;
	drm: string;
	video: string;
}

export interface MediaPlayerBuffering {
	current: string;
	max: string;
	target: string;
}

export interface MediaPlayerNewStream {
	speed: string;
}

export interface MediaPlayerPosition {
	value: string;
}

export interface MediaPlayerDuration {
	value: string;
}

export interface MediaPlayerIsLive {
	value: string;
}

export interface MediaPlayerRuntime {
	value: string;
}

export interface MediaPlayerStreamSegment {
	bitrate: string;
	height: string;
	media_sequence: string;
	segment_type: string;
	time: string;
	width: string;
}
