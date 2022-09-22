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

const serverFolder = path.resolve(__dirname + '/..');
const outputFolder = path.resolve(__dirname + '/../../release');

rimraf.sync(outputFolder);

output = execSync(`npm run buildConfigSchema && npm run buildRequestArgsSchema`, {
	encoding: 'utf8'
});
console.log(output);

const resourcesToCopy = [
	[path.join(serverFolder, 'dist'), path.join('server', 'dist')],
	[path.join(serverFolder, 'package.json'), 'package.json'],
	[path.join(serverFolder, 'requestArgs.schema.json'), path.join('server', 'requestArgs.schema.json')],
	[path.join(serverFolder, 'rta-config.schema.json'), path.join('server', 'rta-config.schema.json')],
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
