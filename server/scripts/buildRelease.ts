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

const resourcesToCopy = [
	[path.join(serverFolder, 'dist'), path.join('server', 'dist')],
	[path.join(serverFolder, 'package.json'), 'package.json'],
	[path.join(serverFolder, 'rta-config.schema.json'), path.join('server', 'rta-config.schema.json')],
	[path.resolve(__dirname + '/../../device'), 'device'],
	[path.resolve(__dirname + '/../../README.md'), 'README.md'],
];

for (const resourceMapping of resourcesToCopy) {
	let outputPath = path.join(outputFolder, resourceMapping[1]);
	fsExtra.copySync(resourceMapping[0], outputPath);
}

if (argv[2] === '--dev') {
	output = execSync(`cd ${outputFolder} && npm pack`, {
		encoding: 'utf8'
	});
} else {
	output = execSync(`npm publish ${outputFolder}`, {
		encoding: 'utf8'
	});
}
console.log(output);
