const fs = require('node:fs');
const path = require('node:path');

const distDirectory = path.join(__dirname, '..', 'dist');
const entryPath = path.join(distDirectory, 'main.js');

fs.mkdirSync(distDirectory, { recursive: true });
fs.writeFileSync(
  entryPath,
  "'use strict';\nrequire('./src/main.js');\n",
  'utf8',
);
