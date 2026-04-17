#!/usr/bin/env node
// Build the Tauri updater manifest (`latest.json`) from the collected build artifacts.
//
// Usage: build-latest-json.mjs <version> <artifacts-dir>
//
// Discovers `<asset>.sig` files alongside `.app.tar.gz` (macOS) and `.nsis.zip` (Windows),
// reads each signature, and emits a manifest at stdout.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import process from 'node:process';

const [, , versionArg, artifactsDir = './artifacts'] = process.argv;
if (!versionArg) {
  console.error('Usage: build-latest-json.mjs <version> [artifacts-dir]');
  process.exit(1);
}

const version = versionArg.replace(/^v/, '');
const RELEASE_BASE = process.env.RELEASE_BASE_URL ?? 'https://releases.artifaq.io';

const targets = [
  { glob: /\.app\.tar\.gz$/, key: 'darwin-aarch64', archMatch: /aarch64|arm64/ },
  { glob: /\.app\.tar\.gz$/, key: 'darwin-x86_64', archMatch: /x86_64|x64|intel/ },
  { glob: /\.nsis\.zip$/, key: 'windows-x86_64', archMatch: /(?:)/ },
];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

const files = walk(artifactsDir);
const platforms = {};

for (const t of targets) {
  const candidate = files.find(
    (f) => t.glob.test(f) && (t.archMatch.test(f) || t.archMatch.test(basename(f))),
  );
  if (!candidate) {
    console.error(`warn: no artifact for ${t.key}`);
    continue;
  }
  const sigPath = `${candidate}.sig`;
  let signature = '';
  try {
    signature = readFileSync(sigPath, 'utf8').trim();
  } catch {
    console.error(`warn: missing signature for ${candidate} (looked for ${sigPath})`);
    continue;
  }
  platforms[t.key] = {
    signature,
    url: `${RELEASE_BASE}/v${version}/${basename(candidate)}`,
  };
}

const manifest = {
  version,
  notes: `Artifaq v${version}`,
  pub_date: new Date().toISOString(),
  platforms,
};

process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
