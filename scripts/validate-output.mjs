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

function readFile(relativePath) {
  const fullPath = path.join(root, relativePath);
  try {
    return fs.readFileSync(fullPath, 'utf8');
  } catch {
    return null;
  }
}

// ── Required files ──────────────────────────────────────────────────

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

// ── wordpress-design.json ───────────────────────────────────────────

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

// ── theme.json ──────────────────────────────────────────────────────

const theme = exists('wordpress/theme.json') ? readJson('wordpress/theme.json') : null;
let targetWpVersion = '6.6';
if (theme) {
  if (theme.version !== 3) warn(`theme.json version is ${theme.version}; this draft expects version 3 for WordPress 6.6+.`);
  if (typeof theme.$schema !== 'string') warn('theme.json has no $schema value.');
  if (!theme.settings) warn('theme.json has no settings object.');

  // Check $schema matches version
  if (typeof theme.$schema === 'string' && theme.version === 3) {
    if (!theme.$schema.includes('6.6') && !theme.$schema.includes('trunk')) {
      warn(`theme.json $schema "${theme.$schema}" may not match version 3 (expected 6.6 or trunk).`);
    }
  }

  // Extract target version from artifact or default
  if (artifact && artifact.target && artifact.target.minimumWordPressVersion) {
    targetWpVersion = artifact.target.minimumWordPressVersion;
  }
}

// Collect registered presets for cross-reference
const registeredPresets = {
  colors: new Set(),
  fontSizes: new Set(),
  spacingSizes: new Set(),
  shadows: new Set()
};

if (theme && theme.settings) {
  const colorSettings = theme.settings.color || {};
  if (Array.isArray(colorSettings.palette)) {
    for (const p of colorSettings.palette) if (p.slug) registeredPresets.colors.add(p.slug);
  }
  const spacingSettings = theme.settings.spacing || {};
  if (Array.isArray(spacingSettings.spacingSizes)) {
    for (const s of spacingSettings.spacingSizes) if (s.slug) registeredPresets.spacingSizes.add(s.slug);
  }
  const typoSettings = theme.settings.typography || {};
  if (Array.isArray(typoSettings.fontSizes)) {
    for (const f of typoSettings.fontSizes) if (f.slug) registeredPresets.fontSizes.add(f.slug);
  }
  const shadowSettings = theme.settings.shadow || {};
  if (Array.isArray(shadowSettings.presets)) {
    for (const s of shadowSettings.presets) if (s.slug) registeredPresets.shadows.add(s.slug);
  }
}

// ── Block validation rules ───────────────────────────────────────────

const SELF_CLOSING_BLOCKS = new Set([
  'latest-posts', 'archives', 'categories', 'calendar', 'rss', 'search',
  'social-link', 'page-list', 'spacer', 'separator', 'more',
  'comments-title', 'comments-count', 'template-part',
  'site-title', 'site-logo', 'site-tagline', 'query-title', 'term-description',
  'navigation-link'
]);

const CONTAINER_BLOCKS = new Set([
  'group', 'columns', 'column', 'heading', 'paragraph', 'buttons', 'button',
  'cover', 'media-text', 'query', 'post-template', 'social-links',
  'navigation', 'navigation-link', 'query-pagination', 'query-pagination-next',
  'query-pagination-numbers', 'query-pagination-previous', 'post-author',
  'post-author-name', 'post-author-biography', 'post-comment', 'post-comments',
  'post-comments-count', 'post-comments-form', 'post-content', 'post-date',
  'post-excerpt', 'post-featured-image', 'post-navigation-link', 'post-template',
  'post-terms', 'post-title', 'pullquote', 'quote', 'table', 'list', 'list-item',
  'gallery', 'image', 'embed', 'audio', 'video', 'file', 'code', 'preformatted',
  'verse', 'html', 'freeform', 'classic', 'reusable', 'block', 'template-part',
  'site-logo', 'site-tagline', 'site-title', 'query-title', 'term-description',
  'archives', 'calendar', 'categories', 'latest-comments', 'latest-posts',
  'page-list', 'rss', 'search', 'tag-cloud', 'social-links', 'social-link',
  'navigation', 'navigation-link', 'navigation-submenu'
]);

// Version-gated attributes: attribute -> { minVersion, block?: string }
const VERSION_GATES = {
  'aspectRatio': { minVersion: '6.5', blocks: ['image', 'cover', 'post-featured-image'] },
  'scale': { minVersion: '6.5', blocks: ['image'] },
  'textWrap': { minVersion: '6.6', blocks: ['heading', 'paragraph'] },
  'layout.type:grid': { minVersion: '6.6', blocks: ['group'] },
  'dimensions.minHeight': { minVersion: '6.3', blocks: ['group', 'cover'] },
  'dimensions.aspectRatio': { minVersion: '6.5', blocks: ['cover'] },
  'position.sticky': { minVersion: '6.4', blocks: ['group'] }
};

function parseWpVersion(versionString) {
  if (!versionString) return [6, 6];
  const parts = versionString.split('.').map(Number);
  return [parts[0] || 0, parts[1] || 0];
}

function versionGte(a, b) {
  const [aMajor, aMinor] = parseWpVersion(a);
  const [bMajor, bMinor] = parseWpVersion(b);
  if (aMajor > bMajor) return true;
  if (aMajor < bMajor) return false;
  return aMinor >= bMinor;
}

// ── Walk files ──────────────────────────────────────────────────────

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

// ── Pattern files ───────────────────────────────────────────────────

const patternsDir = path.join(root, 'wordpress', 'patterns');
const patternFiles = walk(patternsDir).filter((file) => file.endsWith('.php'));

for (const file of patternFiles) {
  const relative = path.relative(root, file);
  const text = fs.readFileSync(file, 'utf8');

  // Pattern header
  if (!/\*\*[^]*?Title:\s*.+[^]*?Slug:\s*[a-z0-9-]+\/[a-z0-9-]+[^]*?\*\//m.test(text)) {
    error(`${relative} is missing a valid Title/Slug pattern header.`);
  }

  // Extract all block comments
  const tokenRegex = /<!--\s*(\/?)wp:([a-z0-9-]+(?:\/[a-z0-9-]+)?)(?:\s+\{([^]*?)\})?\s*(\/)?-->/g;
  const stack = [];
  let match;
  let hasCoreNamespaceInComment = false;
  let hasSelfClosingContainer = false;
  let hasUnclosed = false;

  while ((match = tokenRegex.exec(text)) !== null) {
    const [, closing, rawName, attrsJson, selfClosing] = match;
    const name = rawName.trim();

    // Rule: no core/ prefix in serialized comments
    if (name.startsWith('core/') || name.startsWith('Core/')) {
      error(`${relative} uses forbidden "core/" namespace prefix in serialized comment: "${name}". Use "${name.replace(/^core\//, '')}" instead.`);
      hasCoreNamespaceInComment = true;
    }

    const blockSlug = name.includes('/') ? name.split('/')[1] : name;

    // Self-closing check
    if (selfClosing) {
      if (CONTAINER_BLOCKS.has(blockSlug) && !SELF_CLOSING_BLOCKS.has(blockSlug)) {
        error(`${relative}: "${name}" is a container block but uses self-closing syntax ( /--). Container blocks must have matching open/close pairs.`);
        hasSelfClosingContainer = true;
      }
      continue;
    }

    if (closing) {
      const expected = stack.pop();
      if (expected !== name) {
        error(`${relative} has mismatched block delimiter: expected closing ${expected || '(none)'}, found ${name}.`);
        hasUnclosed = true;
        break;
      }
    } else {
      stack.push(name);
    }
  }

  if (!hasUnclosed && stack.length) {
    error(`${relative} has unclosed block delimiters: ${stack.join(', ')}.`);
  }

  // Check raw colors
  const rawColors = text.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  if (rawColors.length) {
    warn(`${relative} contains raw hex colors in block markup: ${[...new Set(rawColors)].join(', ')}.`);
  }

  // Check preset references against theme.json (var:preset syntax)
  const presetRefs = text.match(/var:preset\|(\w+)\|([a-z0-9-]+)/g) || [];
  for (const ref of presetRefs) {
    const [, category, slug] = ref.split('|');
    const map = {
      'color': 'colors',
      'spacing': 'spacingSizes',
      'font-size': 'fontSizes',
      'shadow': 'shadows'
    };
    const key = map[category];
    if (key && !registeredPresets[key].has(slug)) {
      warn(`${relative} references preset "${ref}" but "${slug}" is not registered in theme.json ${key}.`);
    }
  }

  // Check textColor / backgroundColor attributes against theme.json palette
  const textColorMatches = text.match(/"textColor"\s*:\s*"([a-z0-9-]+)"/g) || [];
  for (const tcm of textColorMatches) {
    const slugMatch = tcm.match(/"textColor"\s*:\s*"([a-z0-9-]+)"/);
    if (slugMatch && !registeredPresets.colors.has(slugMatch[1])) {
      warn(`${relative} uses textColor="${slugMatch[1]}" but "${slugMatch[1]}" is not in theme.json palette.`);
    }
  }

  const bgColorMatches = text.match(/"backgroundColor"\s*:\s*"([a-z0-9-]+)"/g) || [];
  for (const bcm of bgColorMatches) {
    const slugMatch = bcm.match(/"backgroundColor"\s*:\s*"([a-z0-9-]+)"/);
    if (slugMatch && !registeredPresets.colors.has(slugMatch[1])) {
      warn(`${relative} uses backgroundColor="${slugMatch[1]}" but "${slugMatch[1]}" is not in theme.json palette.`);
    }
  }

  const borderColorMatches = text.match(/"borderColor"\s*:\s*"([a-z0-9-]+)"/g) || [];
  for (const bcm of borderColorMatches) {
    const slugMatch = bcm.match(/"borderColor"\s*:\s*"([a-z0-9-]+)"/);
    if (slugMatch && !registeredPresets.colors.has(slugMatch[1])) {
      warn(`${relative} uses borderColor="${slugMatch[1]}" but "${slugMatch[1]}" is not in theme.json palette.`);
    }
  }

  const fontSizeMatches = text.match(/"fontSize"\s*:\s*"([a-z0-9-]+)"/g) || [];
  for (const fsm of fontSizeMatches) {
    const slugMatch = fsm.match(/"fontSize"\s*:\s*"([a-z0-9-]+)"/);
    if (slugMatch && !registeredPresets.fontSizes.has(slugMatch[1])) {
      warn(`${relative} uses fontSize="${slugMatch[1]}" but "${slugMatch[1]}" is not in theme.json fontSizes.`);
    }
  }

  // Check for duplicate inline style + preset class (common validation failure)
  const blocksWithStyle = text.match(/<!--\s*wp:([a-z0-9-]+)(?:\s+\{([^]*?)\})?\s*-->/g) || [];
  for (const blockMatch of blocksWithStyle) {
    // Check fontSize attribute vs inline style font-size inside style.typography
    const hasFontSizeAttr = /"fontSize"\s*:/.test(blockMatch);
    const hasStyleFontSize = /"style"\s*:\s*\{[^}]*"typography"\s*:\s*\{[^}]*"fontSize"/.test(blockMatch) ||
                              /"style"\s*:\s*\{[^}]*"fontSize"/.test(blockMatch);
    if (hasFontSizeAttr && hasStyleFontSize) {
      warn(`${relative} has both fontSize attribute and style.typography.fontSize — can trigger save() mismatch.`);
    }

    // Check textColor attribute vs inline color style
    const hasTextColorAttr = /"textColor"\s*:/.test(blockMatch);
    const hasStyleColorText = /"style"\s*:\s*\{[^}]*"color"\s*:\s*\{[^}]*"text"/.test(blockMatch);
    if (hasTextColorAttr && hasStyleColorText) {
      warn(`${relative} has both textColor attribute and style.color.text — can trigger save() mismatch.`);
    }

    // Check backgroundColor attribute vs inline background style
    const hasBgColorAttr = /"backgroundColor"\s*:/.test(blockMatch);
    const hasStyleColorBg = /"style"\s*:\s*\{[^}]*"color"\s*:\s*\{[^}]*"background"/.test(blockMatch);
    if (hasBgColorAttr && hasStyleColorBg) {
      warn(`${relative} has both backgroundColor attribute and style.color.background — can trigger save() mismatch.`);
    }
  }

  // Version-gated attribute check
  for (const [attrGate, gateInfo] of Object.entries(VERSION_GATES)) {
    const { minVersion, blocks } = gateInfo;
    if (versionGte(targetWpVersion, minVersion)) continue; // OK for this target

    // Check if any gated attribute appears in the markup
    const gatePattern = attrGate.includes(':') ? attrGate.split(':')[0] : attrGate;
    if (text.includes(`"${gatePattern}"`) || text.includes(`"${attrGate}"`)) {
      // Narrow to specific blocks if specified
      if (blocks) {
        for (const b of blocks) {
          if (text.includes(`wp:${b}`) || text.includes(`wp:core/${b}`)) {
            warn(`${relative} uses "${attrGate}" which requires WordPress ${minVersion}+, but target is ${targetWpVersion}.`);
          }
        }
      } else {
        warn(`${relative} uses "${attrGate}" which requires WordPress ${minVersion}+, but target is ${targetWpVersion}.`);
      }
    }
  }

  // Check blockGap shape
  const blockGapMatches = text.match(/"blockGap"\s*:\s*"([^"]*)"/g) || [];
  const blockGapObjectMatches = text.match(/"blockGap"\s*:\s*\{/g) || [];
  for (const bgm of blockGapObjectMatches) {
    const objMatch = text.substring(text.indexOf(bgm)).match(/\{[^}]*\}/);
    if (objMatch) {
      const obj = objMatch[0];
      const hasTop = obj.includes('"top"');
      const hasLeft = obj.includes('"left"');
      const hasBottom = obj.includes('"bottom"');
      const hasRight = obj.includes('"right"');
      if (!hasTop || !hasLeft) {
        warn(`${relative} has blockGap object missing required keys (needs top+left for 6.4+): ${obj}`);
      }
    }
  }

  // Check heading level is integer
  const headingMatches = text.match(/<!--\s*wp:heading\s+\{([^}]*)\}\s*-->/g) || [];
  for (const hm of headingMatches) {
    const levelMatch = hm.match(/"level"\s*:\s*"(\d)"/);
    if (levelMatch) {
      error(`${relative}: heading "level" must be integer, not string: "${levelMatch[1]}"`);
    }
  }

  // Check dimRatio is integer
  const coverMatches = text.match(/<!--\s*wp:cover\s+\{([^}]*)\}\s*-->/g) || [];
  for (const cm of coverMatches) {
    const dimMatch = cm.match(/"dimRatio"\s*:\s*"(\d+)"/);
    if (dimMatch) {
      error(`${relative}: cover "dimRatio" must be integer, not string: "${dimMatch[1]}"`);
    }
  }

  // Check fontFamily inside style.typography (should be top-level attribute)
  const fontFamilyInStyleMatches = text.match(/<!--\s*wp:([a-z0-9-]+)\s+\{([^]*?)\}\s*-->/g) || [];
  for (const ffsm of fontFamilyInStyleMatches) {
    const hasTopLevelFontFamily = /"fontFamily"\s*:/.test(ffsm);
    const hasStyleFontFamily = /"style"\s*:\s*\{[^}]*"typography"\s*:\s*\{[^}]*"fontFamily"/.test(ffsm);
    if (!hasTopLevelFontFamily && hasStyleFontFamily) {
      error(`${relative} uses fontFamily inside style.typography — must be a top-level block attribute, not nested in style. Move "fontFamily" to the top of the block attributes.`);
    }
  }

  // Check for deprecated minHeight / minHeightUnit on cover/group (should use style.dimensions.minHeight)
  const minHeightMatches = text.match(/<!--\s*wp:([a-z0-9-]+)\s+\{([^]*?)\}\s*-->/g) || [];
  for (const mhm of minHeightMatches) {
    const hasMinHeight = /"minHeight"\s*:/.test(mhm);
    const hasMinHeightUnit = /"minHeightUnit"\s*:/.test(mhm);
    const hasStyleDimensions = /"style"\s*:\s*\{[^}]*"dimensions"\s*:\s*\{[^}]*"minHeight"/.test(mhm);
    if ((hasMinHeight || hasMinHeightUnit) && !hasStyleDimensions) {
      warn(`${relative} uses deprecated top-level "minHeight"/"minHeightUnit" — use "style.dimensions.minHeight" instead (e.g., "style":{"dimensions":{"minHeight":"640px"}}).`);
    }
  }

  // Check for raw hex in style.color.text / style.color.background (should use textColor/backgroundColor presets)
  const styleColorMatches = text.match(/<!--\s*wp:([a-z0-9-]+)\s+\{([^]*?)\}\s*-->/g) || [];
  for (const scm of styleColorMatches) {
    const hasTextColorAttr = /"textColor"\s*:/.test(scm);
    const hasBgColorAttr = /"backgroundColor"\s*:/.test(scm);
    const hasStyleColorText = /"style"\s*:\s*\{[^}]*"color"\s*:\s*\{[^}]*"text"\s*:\s*"#[0-9a-fA-F]{3,8}"/.test(scm);
    const hasStyleColorBg = /"style"\s*:\s*\{[^}]*"color"\s*:\s*\{[^}]*"background"\s*:\s*"#[0-9a-fA-F]{3,8}"/.test(scm);

    if (!hasTextColorAttr && hasStyleColorText) {
      error(`${relative} uses raw hex in style.color.text — must use a "textColor" preset reference instead. Add the color to theme.json palette and use "textColor":"<slug>".`);
    }
    if (!hasBgColorAttr && hasStyleColorBg) {
      error(`${relative} uses raw hex in style.color.background — must use a "backgroundColor" preset reference instead. Add the color to theme.json palette and use "backgroundColor":"<slug>".`);
    }
  }

  // Check for inline style= attributes on <a> tags inside block markup
  const anchorStyleMatches = text.match(/<a\s[^>]*style="[^"]*"/g) || [];
  for (const asm of anchorStyleMatches) {
    warn(`${relative} has inline style="..." on an <a> tag inside block markup: ${asm.substring(0, 80)}... Inline styles on <a> are not part of the block's saved attributes and may be stripped on re-save. Use block-level style attributes instead.`);
  }

  // Check for unregistered block style classes (is-style-* without matching register_block_style)
  // Note: this is a heuristic — we can't know what styles are registered, but we can flag common ones
  const blockStyleMatches = text.match(/className\s*:\s*"is-style-([a-z0-9-]+)"/g) || [];
  for (const bsm of blockStyleMatches) {
    const styleName = bsm.match(/is-style-([a-z0-9-]+)/)?.[1];
    if (styleName) {
      warn(`${relative} uses block style class "is-style-${styleName}" — ensure register_block_style('core/<block>', {name:'${styleName}',...}) is called in functions.php, or the class will have no effect and may trigger a validation warning.`);
    }
  }

  // Check for fontSize inside style.typography (should be top-level attribute)
  const fontSizeInStyleMatches = text.match(/<!--\s*wp:([a-z0-9-]+)\s+\{([^]*?)\}\s*-->/g) || [];
  for (const fssm of fontSizeInStyleMatches) {
    const hasTopLevelFontSize = /"fontSize"\s*:/.test(fssm);
    const hasStyleFontSize = /"style"\s*:\s*\{[^}]*"typography"\s*:\s*\{[^}]*"fontSize"/.test(fssm);
    if (!hasTopLevelFontSize && hasStyleFontSize) {
      error(`${relative} uses fontSize inside style.typography — must be a top-level block attribute. Move "fontSize" to the top of the block attributes.`);
    }
  }

  // Check for border inside style.border with raw hex (should use borderColor preset)
  const borderStyleMatches = text.match(/<!--\s*wp:([a-z0-9-]+)\s+\{([^]*?)\}\s*-->/g) || [];
  for (const bsm of borderStyleMatches) {
    const hasBorderColorAttr = /"borderColor"\s*:/.test(bsm);
    const hasStyleBorderColor = /"style"\s*:\s*\{[^}]*"border"\s*:\s*\{[^}]*"color"\s*:\s*"#[0-9a-fA-F]{3,8}"/.test(bsm);
    if (!hasBorderColorAttr && hasStyleBorderColor) {
      error(`${relative} uses raw hex in style.border.color — must use a "borderColor" preset reference instead.`);
    }
  }

  // Check for raw inline style="color:#..." on block wrapper divs (not in comment attributes)
  const inlineColorStyleMatches = text.match(/<div\s[^>]*style="[^"]*color\s*:\s*#[0-9a-fA-F]{3,8}/g) || [];
  for (const icsm of inlineColorStyleMatches) {
    warn(`${relative} has raw hex color in inline style attribute on wrapper div. Consider using textColor/backgroundColor presets or scoped CSS.`);
  }

  ok(`Checked ${relative}`);
}

if (!patternFiles.length) warn('No pattern PHP files found. This may be valid for template-only output.');

// ── Template / part files (.html) ───────────────────────────────────

const templatesDir = path.join(root, 'wordpress', 'templates');
const partsDir = path.join(root, 'wordpress', 'parts');
const templateFiles = walk(templatesDir).filter((f) => f.endsWith('.html'));
const partFiles = walk(partsDir).filter((f) => f.endsWith('.html'));

for (const file of [...templateFiles, ...partFiles]) {
  const relative = path.relative(root, file);
  const text = fs.readFileSync(file, 'utf8');

  // Same block comment validations as patterns
  const tokenRegex = /<!--\s*(\/?)wp:([a-z0-9-]+(?:\/[a-z0-9-]+)?)(?:\s+\{([^]*?)\})?\s*(\/)?-->/g;
  const stack = [];
  let match;
  let hasUnclosed = false;

  while ((match = tokenRegex.exec(text)) !== null) {
    const [, closing, rawName, , selfClosing] = match;
    const name = rawName.trim();
    const blockSlug = name.includes('/') ? name.split('/')[1] : name;

    if (name.startsWith('core/') || name.startsWith('Core/')) {
      error(`${relative} uses forbidden "core/" namespace prefix: "${name}".`);
    }

    if (selfClosing) {
      if (CONTAINER_BLOCKS.has(blockSlug) && !SELF_CLOSING_BLOCKS.has(blockSlug)) {
        error(`${relative}: "${name}" is container but uses self-closing syntax.`);
      }
      continue;
    }

    if (closing) {
      const expected = stack.pop();
      if (expected !== name) {
        error(`${relative} mismatched delimiter: expected ${expected}, found ${name}.`);
        hasUnclosed = true;
        break;
      }
    } else {
      stack.push(name);
    }
  }

  if (!hasUnclosed && stack.length) {
    error(`${relative} has unclosed delimiters: ${stack.join(', ')}.`);
  }

  // Raw colors in templates too
  const rawColors = text.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  if (rawColors.length) {
    warn(`${relative} raw hex colors: ${[...new Set(rawColors)].join(', ')}.`);
  }

  // Check for raw hex in style.color.text / style.color.background (should use textColor/backgroundColor presets)
  const styleColorMatches2 = text.match(/<!--\s*wp:([a-z0-9-]+)\s+\{([^]*?)\}\s*-->/g) || [];
  for (const scm of styleColorMatches2) {
    const hasTextColorAttr = /"textColor"\s*:/.test(scm);
    const hasBgColorAttr = /"backgroundColor"\s*:/.test(scm);
    const hasStyleColorText = /"style"\s*:\s*\{[^}]*"color"\s*:\s*\{[^}]*"text"\s*:\s*"#[0-9a-fA-F]{3,8}"/.test(scm);
    const hasStyleColorBg = /"style"\s*:\s*\{[^}]*"color"\s*:\s*\{[^}]*"background"\s*:\s*"#[0-9a-fA-F]{3,8}"/.test(scm);

    if (!hasTextColorAttr && hasStyleColorText) {
      error(`${relative} uses raw hex in style.color.text — must use a "textColor" preset reference instead.`);
    }
    if (!hasBgColorAttr && hasStyleColorBg) {
      error(`${relative} uses raw hex in style.color.background — must use a "backgroundColor" preset reference instead.`);
    }
  }

  // Check fontFamily inside style.typography (should be top-level attribute)
  const fontFamilyInStyleMatches2 = text.match(/<!--\s*wp:([a-z0-9-]+)\s+\{([^]*?)\}\s*-->/g) || [];
  for (const ffsm of fontFamilyInStyleMatches2) {
    const hasTopLevelFontFamily = /"fontFamily"\s*:/.test(ffsm);
    const hasStyleFontFamily = /"style"\s*:\s*\{[^}]*"typography"\s*:\s*\{[^}]*"fontFamily"/.test(ffsm);
    if (!hasTopLevelFontFamily && hasStyleFontFamily) {
      error(`${relative} uses fontFamily inside style.typography — must be a top-level block attribute.`);
    }
  }

  // Check for deprecated minHeight / minHeightUnit
  const minHeightMatches2 = text.match(/<!--\s*wp:([a-z0-9-]+)\s+\{([^]*?)\}\s*-->/g) || [];
  for (const mhm of minHeightMatches2) {
    const hasMinHeight = /"minHeight"\s*:/.test(mhm);
    const hasMinHeightUnit = /"minHeightUnit"\s*:/.test(mhm);
    const hasStyleDimensions = /"style"\s*:\s*\{[^}]*"dimensions"\s*:\s*\{[^}]*"minHeight"/.test(mhm);
    if ((hasMinHeight || hasMinHeightUnit) && !hasStyleDimensions) {
      warn(`${relative} uses deprecated top-level "minHeight"/"minHeightUnit" — use "style.dimensions.minHeight" instead.`);
    }
  }

  // Check for inline style= attributes on <a> tags inside block markup
  const anchorStyleMatches2 = text.match(/<a\s[^>]*style="[^"]*"/g) || [];
  for (const asm of anchorStyleMatches2) {
    warn(`${relative} has inline style="..." on an <a> tag inside block markup: ${asm.substring(0, 80)}... Inline styles on <a> are not part of the block's saved attributes and may be stripped on re-save.`);
  }

  // Check for unregistered block style classes
  const blockStyleMatches2 = text.match(/className\s*:\s*"is-style-([a-z0-9-]+)"/g) || [];
  for (const bsm of blockStyleMatches2) {
    const styleName = bsm.match(/is-style-([a-z0-9-]+)/)?.[1];
    if (styleName) {
      warn(`${relative} uses block style class "is-style-${styleName}" — ensure register_block_style('core/<block>', {name:'${styleName}',...}) is called in functions.php.`);
    }
  }

  // Check for fontSize inside style.typography
  const fontSizeInStyleMatches2 = text.match(/<!--\s*wp:([a-z0-9-]+)\s+\{([^]*?)\}\s*-->/g) || [];
  for (const fssm of fontSizeInStyleMatches2) {
    const hasTopLevelFontSize = /"fontSize"\s*:/.test(fssm);
    const hasStyleFontSize = /"style"\s*:\s*\{[^}]*"typography"\s*:\s*\{[^}]*"fontSize"/.test(fssm);
    if (!hasTopLevelFontSize && hasStyleFontSize) {
      error(`${relative} uses fontSize inside style.typography — must be a top-level block attribute.`);
    }
  }

  ok(`Checked ${relative}`);
}

// ── Summary ─────────────────────────────────────────────────────────

console.log(`\nValidation complete: ${errors} error(s), ${warnings} warning(s).`);
process.exit(errors ? 1 : 0);
