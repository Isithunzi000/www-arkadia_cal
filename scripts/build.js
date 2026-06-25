#!/usr/bin/env node
'use strict';

const fs   = require('fs');
const path = require('path');

const RELEASES = path.join(__dirname, '..', 'releases');
const DIST     = path.join(__dirname, '..', 'dist');

fs.mkdirSync(DIST, { recursive: true });

const zips = fs.readdirSync(RELEASES).filter(function (f) { return f.endsWith('.zip'); });
if (!zips.length) {
  console.log('Brak zipow w releases/');
  process.exit(0);
}

function parseVersion(filename) {
  var m = filename.match(/_(\d+)_(\d+)_(\d+)\.zip$/);
  if (!m) return [0, 0, 0];
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function versionCmp(a, b) {
  var pa = parseVersion(a), pb = parseVersion(b);
  for (var i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pb[i] - pa[i];
  }
  return 0;
}

zips.sort(versionCmp);
var latestZip = zips[0];
var vParts    = parseVersion(latestZip);
var version   = vParts.join('.');

fs.copyFileSync(path.join(RELEASES, latestZip), path.join(DIST, latestZip));
fs.copyFileSync(path.join(RELEASES, latestZip), path.join(DIST, 'arkadia_cal.zip'));

var index = {
  built:   new Date().toISOString(),
  version: version,
  zip:     latestZip,
};

fs.writeFileSync(path.join(DIST, 'index.json'), JSON.stringify(index, null, 2));

console.log('Gotowe: ' + latestZip + ' -> dist/' + latestZip + ' + dist/arkadia_cal.zip');
console.log('index.json: version=' + version);
fs.readdirSync(DIST).forEach(function (f) { console.log('  dist/' + f); });
