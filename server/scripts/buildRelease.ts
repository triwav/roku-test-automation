import * as fsExtra from 'fs-extra';
import * as path from 'path';
import { execSync } from 'child_process';

let output: any;

output = execSync('npm run build', {
	encoding: 'utf8'
});
console.log(output);

const templateFolder = path.resolve(__dirname + '/../../release-template');
const outputFolder = path.resolve(__dirname + '/../../release');
console.log(templateFolder);

fsExtra.copySync(templateFolder, outputFolder, {
	dereference: true
});

output = execSync(`npm publish ${outputFolder}`, {
	encoding: 'utf8'
});
console.log(output);
