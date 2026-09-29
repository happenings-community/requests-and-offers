// Fetches the pinned hREA DNA into workdir/hrea.dna, and re-fetches it whenever the file on
// disk does not match the pinned digest. Guarding on the file's existence alone let every clone
// keep an old DNA across a pin bump (#223).
//
// To bump hREA: change both constants below. The digest is published with each release asset:
//   gh api repos/h-REA/hREA/releases/tags/<tag> --jq '.assets[] | select(.name == "hrea.dna") | .digest'
//
// No dependencies on purpose: the CI zomes job runs this without installing node_modules.
// `--soft` (used by postinstall) reports a failure but exits 0, so an offline install still works.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';

const HREA_TAG = 'happ-0.4.0-beta';
const HREA_DNA_SHA256 = '71e453323359c8e8a7ea991540a2253383ef379bea4e8ecf4109a578e6b3dda4';

const TARGET = 'workdir/hrea.dna';
const URL = `https://github.com/h-REA/hREA/releases/download/${HREA_TAG}/hrea.dna`;
const soft = process.argv.includes('--soft');

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

const fail = (message: string): never => {
  console.error(`download-hrea: ${message}`);
  process.exit(soft ? 0 : 1);
};

if (existsSync(TARGET)) {
  const current = sha256(readFileSync(TARGET));
  if (current === HREA_DNA_SHA256) {
    console.log(`download-hrea: ${TARGET} is ${HREA_TAG}, up to date`);
    process.exit(0);
  }
  console.log(`download-hrea: ${TARGET} has sha256 ${current}, not ${HREA_TAG}; fetching`);
}

let bytes: Uint8Array;
try {
  const response = await fetch(URL);
  if (!response.ok) fail(`GET ${URL} answered ${response.status}`);
  bytes = new Uint8Array(await response.arrayBuffer());
} catch (error) {
  fail(`GET ${URL} failed: ${error instanceof Error ? error.message : String(error)}`);
}

const fetched = sha256(bytes!);
if (fetched !== HREA_DNA_SHA256) {
  fail(`${URL} has sha256 ${fetched}, expected ${HREA_DNA_SHA256}; ${TARGET} left unchanged`);
}

writeFileSync(`${TARGET}.tmp`, bytes!);
renameSync(`${TARGET}.tmp`, TARGET);
console.log(`download-hrea: ${TARGET} is now ${HREA_TAG} (${bytes!.byteLength} bytes)`);
