import { odc } from 'roku-test-automation';

export async function waitForApplicationLoad() {
	return odc.observeField({keyPath: 'launchComplete', match: true})
}
