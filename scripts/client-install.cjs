const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const clientDir = path.join(__dirname, '..', 'client');
const pkg = path.join(clientDir, 'package.json');

if (!fs.existsSync(pkg)) {
  console.log('Skipping client install (client/package.json not found).');
  process.exit(0);
}

const { status } = spawnSync('npm', ['install'], {
  cwd: clientDir,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

process.exit(status ?? 1);
