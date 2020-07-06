#!/usr/bin/env node

const fs = require('fs');

let packageData = JSON.parse(fs.readFileSync('package.json'));
fs.writeFileSync('public/version.json', JSON.stringify({'version': packageData.version}));
