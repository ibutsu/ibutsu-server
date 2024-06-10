#!/usr/bin/env node

const fse = require('fs-extra')

let packageData = JSON.parse(fse.readFileSync('package.json'));
fse.writeFileSync('public/version.json', JSON.stringify({'version': packageData.version}));
