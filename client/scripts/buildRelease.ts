import * as fsExtra from 'fs-extra';
import * as path from 'path';
import * as rimraf from 'rimraf';
import { execSync } from 'child_process';
import { argv } from 'process';

let output: any;

if (argv[2] !== '--dev') {
	output = execSync('npm run build', {
		encoding: 'utf8'
	});
	console.log(output);
}

const clientSourceFolder = path.resolve(__dirname + '/..');
const outputFolder = path.resolve(__dirname + '/../../release');

rimraf.sync(outputFolder);

output = execSync(`npm run buildConfigSchema && npm run buildRequestArgsSchema && npm run buildRequestTypesSchema`, {
	encoding: 'utf8'
});
console.log(output);

const resourcesToCopy = [
	[path.join(clientSourceFolder, 'dist'), path.join('client', 'dist')],
	[path.join(clientSourceFolder, 'package.json'), 'package.json'],
	[path.join(clientSourceFolder, 'requestArgs.schema.json'), path.join('client', 'requestArgs.schema.json')],
	[path.join(clientSourceFolder, 'requestTypes.schema.json'), path.join('client', 'requestTypes.schema.json')],
	[path.join(clientSourceFolder, 'rta-config.schema.json'), path.join('client', 'rta-config.schema.json')],
	[path.resolve(__dirname + '/../../device'), 'device'],
	[path.resolve(__dirname + '/../../README.md'), 'README.md'],
];

for (const resourceMapping of resourcesToCopy) {
	const outputPath = path.join(outputFolder, resourceMapping[1]);
	fsExtra.copySync(resourceMapping[0], outputPath, {
		filter: (path) => {
			if(path.indexOf('.spec.') > -1) return false;
			if(path.indexOf('/test/') > -1) return false;
			return true;
		}
	});
}

if (argv[2] === '--dev') {
	output = execSync(`cd ${outputFolder} && npm pack`, {
		encoding: 'utf8'
	});
} else {
	let options = '';
	if (argv[2] === '--beta') {
		options = '--tag beta';
	}
	output = execSync(`npm publish ${options} ${outputFolder}`, {
		encoding: 'utf8'
	});
}
console.log(output);
