export class RokuDevice {
	public ip = '';

	public async sendGetECP(path: string, params?: object) {

	}

	public async sendPostECP(path: string, params?: object, body?: string) {
		const url = `http://${this.ip}/${path}`;
		console.log(url);
	}
}
