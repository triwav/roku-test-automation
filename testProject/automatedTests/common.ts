import { odc } from 'roku-test-automation';

export async function waitForApplicationLoad() {
	return odc.onFieldChangeOnce({
		base: 'global',
		keyPath: 'launchComplete',
		match: true
	});
}
