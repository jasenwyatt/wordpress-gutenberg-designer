#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
let errors = 0;
let warnings = 0;

function error(message) {
  errors += 1;
  console.error(`ERROR: ${message}`);
}

function warn(message) {
  warnings += 1;
  console.warn(`WARN: ${message}`);
}

function ok(message) {
  console.log(`OK: ${message}`);
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function readJson(relativePath) {
  const fullPath = path.join(root, relativePath);
  try {
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch (cause) {
    error(`${relativePath} is not valid JSON: ${cause.message}`);
    return null;
  }
}

const required = [
  'analysis/visual-analysis.json',
  'analysis/wordpress-plan.md',
  'wordpress-design.json',
  'wordpress/theme.json',
  'preview/index.html',
  'report.md'
];

for (const relativePath of required) {
  if (!exists(relativePath)) error(`Missing required file: ${relativePath}`);
  else ok(`Found ${relativePath}`);
}

const artifact = exists('wordpress-design.json') ? readJson('wordpress-design.json') : null;
if (artifact) {
  if (artifact.schemaVersion !== 1) error('wordpress-design.json schemaVersion must be 1.');
  for (const key of ['source', 'target', 'designTokens', 'sections', 'assumptions']) {
    if (!(key in artifact)) error(`wordpress-design.json is missing ${key}.`);
  }
  if (!Array.isArray(artifact.sections) || artifact.sections.length === 0) {
    error('wordpress-design.json must contain at least one section.');
  }
}

const theme = exists('wordpress/theme.json') ? readJson('wordpress/theme.json') : null;
if (theme) {
  if (theme.version !== 3) warn(`theme.json version is ${theme.version}; this draft expects version 3 for WordPress 6.6+.`);
  if (typeof theme.$schema !== 'string') warn('theme.json has no $schema value.');
  if (!theme.settings) warn('theme.json has no settings object.');
}

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const patternsDir = path.join(root, 'wordpress', 'patterns');
const patternFiles = walk(patternsDir).filter((file) => file.endsWith('.php'));

for (const file of patternFiles) {
  const relative = path.relative(root, file);
  const text = fs.readFileSync(file, 'utf8');
  if (!/\*\*[^]*?Title:\s*.+[^]*?Slug:\s*[a-z0-9-]+\/[a-z0-9-]+[^]*?\*\//m.test(text)) {
    error(`${relative} is missing a valid Title/Slug pattern header.`);
  }

  const tokenRegex = /<!--\s*(\/?)wp:([a-z0-9-]+(?:\/[a-z0-9-]+)?)(?:\s+\{[^]*?\})?\s*(\/)?-->/g;
  const stack = [];
  let match;
  while ((match = tokenRegex.exec(text)) !== null) {
    const [, closing, name, selfClosing] = match;
    if (selfClosing) continue;
    if (closing) {
      const expected = stack.pop();
      if (expected !== name) {
        error(`${relative} has mismatched block delimiter: expected closing ${expected || '(none)'}, found ${name}.`);
        break;
      }
    } else {
      stack.push(name);
    }
  }
  if (stack.length) error(`${relative} has unclosed block delimiters: ${stack.join(', ')}.`);

  const rawColors = text.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  if (rawColors.length) warn(`${relative} contains raw hex colors in block markup: ${[...new Set(rawColors)].join(', ')}.`);
  ok(`Checked ${relative}`);
}

if (!patternFiles.length) warn('No pattern PHP files found. This may be valid for template-only output.');

console.log(`\nValidation complete: ${errors} error(s), ${warnings} warning(s).`);
process.exit(errors ? 1 : 0);
