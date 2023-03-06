import * as fsExtra from 'fs-extra';
import type * as needle from 'needle';

import { utils } from '../utils';

export async function getMock(mockFilePath: string) {
	return await fsExtra.readFile(mockFilePath, 'utf8');
}

export async function getTestMock(contextOrSuite: Mocha.Context | Mocha.Suite, extension: MockFileFormat = 'json'): Promise<object | string> {
	const mockFilePath = 'src/test/mocks/' + utils.generateFileNameForTest(contextOrSuite, extension);
	const mockContents = await getMock(mockFilePath);
	if (extension === 'json') {
		return JSON.parse(mockContents);
	} else {
		return mockContents;
	}
}

export async function getNeedleMockResponse(contextOrSuite: Mocha.Context | Mocha.Suite, extension: MockFileFormat = 'json'): Promise<needle.NeedleResponse> {
	const mock: any = {
		body: await getTestMock(contextOrSuite, extension)
	};
	return mock;
}

declare type MockFileFormat = 'json' | 'xml';
