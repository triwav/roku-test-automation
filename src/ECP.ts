import { RokuDevice } from './RokuDevice';

enum Key {
	Home,
	Rev,
	Fwd,
	Play,
	Select,
	Left,
	Right,
	Down,
	Up,
	Back,
	InstantReplay,
	Info,
	Backspace,
	Search,
	Enter,
}

export class ECP {
	public device: RokuDevice;

	public static readonly Key = Key;

	public async sendKeyPress(key: Key) {
		await this.device.sendPostECP(`keypress/${key}`);
	}
}
