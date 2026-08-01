#!/usr/bin/env node

/**
 * WordPress Gutenberg Block Markup Validator
 *
 * Validates generated block patterns, templates, and parts against Gutenberg
 * serialization rules. Uses regex-based checks for structural issues and
 * optional deep parsing via @wordpress/block-serialization-default-parser
 * when available.
 */

import fs from 'node:fs';
import path from 'node:path';

// ── Optional deep parser ──────────────────────────────────────────────

let wpParser = null;
try {
  const wpPkg = await import('@wordpress/block-serialization-default-parser');
  wpParser = wpPkg;
} catch {
  // Parser not installed; regex-only mode
}

// ── State ────────────────────────────────────────────────────────────

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

// ── File helpers ────────────────────────────────────────────────────

function exists(relativePath, root) {
  return fs.existsSync(path.join(root || '.', relativePath));
}

function readJson(relativePath, root) {
  const fullPath = path.join(root || '.', relativePath);
  try {
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch (cause) {
    error(`${relativePath} is not valid JSON: ${cause.message}`);
    return null;
  }
}

function readFile(relativePath, root) {
  const fullPath = path.join(root || '.', relativePath);
  try {
    return fs.readFileSync(fullPath, 'utf8');
  } catch {
    return null;
  }
}

function readFileAbs(fullPath) {
  try {
    return fs.readFileSync(fullPath, 'utf8');
  } catch {
    return null;
  }
}

// ── Version helpers ───────────────────────────────────────────────────

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

// ── Block taxonomy ───────────────────────────────────────────────────

const SELF_CLOSING_BLOCKS = new Set([
  'latest-posts', 'archives', 'categories', 'calendar', 'rss', 'search',
  'social-link', 'page-list', 'spacer', 'separator', 'more',
  'comments-title', 'comments-count',
  'template-part', 'site-title', 'site-logo', 'site-tagline',
  'query-title', 'term-description', 'navigation-link'
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

// Blocks where supports.className is false → wp-block-{name} must NOT be present
const CLASS_EXCLUDED = new Set([
  'paragraph', 'list-item', 'html', 'shortcode', 'more', 'nextpage', 'freeform', 'missing'
]);

// Blocks where wp-block-{name} class IS required in saved HTML
const CLASS_REQUIRED = new Set([
  'image', 'group', 'columns', 'column', 'cover', 'buttons', 'button',
  'quote', 'pullquote', 'separator', 'media-text', 'table',
  'code', 'preformatted', 'embed', 'gallery', 'spacer', 'details',
  'audio', 'video', 'file', 'verse', 'social-links', 'heading'
]);

// Version-gated attributes
const VERSION_GATES = {
  'aspectRatio': { minVersion: '6.5', blocks: ['image', 'cover', 'post-featured-image'] },
  'scale': { minVersion: '6.5', blocks: ['image'] },
  'textWrap': { minVersion: '6.6', blocks: ['heading', 'paragraph'] },
  'layout.type:grid': { minVersion: '6.6', blocks: ['group'] },
  'dimensions.minHeight': { minVersion: '6.3', blocks: ['group', 'cover'] },
  'dimensions.aspectRatio': { minVersion: '6.5', blocks: ['cover'] },
  'position.sticky': { minVersion: '6.4', blocks: ['group'] }
};

// ── Regex for block delimiters ──────────────────────────────────────

const BLOCK_DELIMITER_RE = /<!--\s*(\/?)wp:([a-z0-9-]+(?:\/[a-z0-9-]+)?)(?:\s+\{([^]*?)\})?\s*(\/)?-->/g;

// ── Check functions ──────────────────────────────────────────────────

function checkPatternHeader(text, relative) {
  if (!/\*\*[^]*?Title:\s*.+[^]*?Slug:\s*[a-z0-9-]+\/[a-z0-9-]+[^]*?\*\//m.test(text)) {
    error(`${relative} is missing a valid Title/Slug pattern header.`);
  }
}

function checkDelimiterBalance(text, relative) {
  const stack = [];
  let match;
  let hasUnclosed = false;

  while ((match = BLOCK_DELIMITER_RE.exec(text)) !== null) {
    const [, closing, rawName, , selfClosing] = match;
    const name = rawName.trim();
    const blockSlug = name.includes('/') ? name.split('/')[1] : name;

    if (name.startsWith('core/') || name.startsWith('Core/')) {
      error(`${relative} uses forbidden "core/" namespace prefix: "${name}". Use "${name.replace(/^core\//, '')}" instead.`);
    }

    if (selfClosing) {
      if (CONTAINER_BLOCKS.has(blockSlug) && !SELF_CLOSING_BLOCKS.has(blockSlug)) {
        error(`${relative}: "${name}" is a container block but uses self-closing syntax ( /--). Container blocks must have matching open/close pairs.`);
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
}

function checkRawHexColors(text, relative, registeredColors) {
  const rawColors = text.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  if (rawColors.length) {
    warn(`${relative} contains raw hex colors in block markup: ${[...new Set(rawColors)].join(', ')}.`);
  }
}

function checkStyleTypographyColor(text, relative) {
  // CRITICAL: style.typography.color does not exist in Gutenberg
  const badMatches = text.match(/"style"\s*:\s*\{[^}]*"typography"\s*:\s*\{[^}]*"color"/g) || [];
  for (const m of badMatches) {
    error(`${relative}: "style.typography.color" does not exist in Gutenberg — use "style.color.text" for custom hex text color. This causes block recovery on every block using it.`);
  }
}

function checkParagraphClass(text, relative) {
  // CRITICAL: wp-block-paragraph class must NOT be on <p> — save() never adds it
  const badParagraphs = text.match(/<p[^>]*class="[^"]*wp-block-paragraph[^"]*"/g) || [];
  for (const m of badParagraphs) {
    error(`${relative}: <p> has "wp-block-paragraph" class — paragraph save() NEVER adds this class. Adding it causes mass block recovery.`);
  }
}

function checkButtonRequirements(text, relative) {
  // Extract all button blocks with their inner HTML
  const buttonRe = /<!--\s*wp:button\s+\{([^]*?)\}\s*-->\n?([\s\S]*?)<!--\s*\/wp:button\s*-->/g;
  let btnMatch;

  while ((btnMatch = buttonRe.exec(text)) !== null) {
    const [, attrsJson, innerHtml] = btnMatch;
    let attrs = {};
    try {
      attrs = JSON.parse(`{${attrsJson}}`);
    } catch { /* malformed JSON handled elsewhere */ }

    const hasFontSize = attrs.fontSize || (attrs.style?.typography?.fontSize);
    const hasBorderColor = attrs.borderColor || (attrs.style?.border?.color);
    const hasCustomCss = attrs.style?.css;

    // Check wp-element-button class
    if (!innerHtml.includes('wp-element-button')) {
      error(`${relative}: Button missing "wp-element-button" class on inner <a>/<button>. Required by save().`);
    }

    // Check has-custom-font-size when fontSize is set
    if (hasFontSize && !innerHtml.includes('has-custom-font-size')) {
      error(`${relative}: Button missing "has-custom-font-size" class — required when fontSize or style.typography.fontSize is set.`);
    }

    // Check has-border-color when border color is set
    if (hasBorderColor && !innerHtml.includes('has-border-color')) {
      error(`${relative}: Button missing "has-border-color" class — required when borderColor or style.border.color is set.`);
    }

    // Check has-custom-css when style.css is set
    if (hasCustomCss && !innerHtml.includes('has-custom-css')) {
      warn(`${relative}: Button may be missing "has-custom-css" class — required when style.css is set (WordPress 7.0+).`);
    }

    // Check CSS property order on <a> style attribute
    const aStyleMatch = innerHtml.match(/<a[^>]*style="([^"]*)"/);
    if (aStyleMatch) {
      const styleText = aStyleMatch[1];
      const props = styleText.split(';').map(s => s.trim()).filter(Boolean).map(s => s.split(':')[0].trim());
      // Expected order: border-color, border-width, border-radius, color, background-color, padding-*, font-size, font-weight
      const expectedOrder = ['border-color', 'border-width', 'border-radius', 'color', 'background-color', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'font-size', 'font-weight'];
      let lastExpectedIdx = -1;
      let orderViolation = false;
      for (const prop of props) {
        const idx = expectedOrder.indexOf(prop);
        if (idx !== -1) {
          if (idx < lastExpectedIdx) {
            orderViolation = true;
            break;
          }
          lastExpectedIdx = idx;
        }
      }
      if (orderViolation) {
        warn(`${relative}: Button <a> CSS property order may not match Gutenberg save() output. Expected: border-color → border-width → border-radius → color → background-color → padding-* → font-size → font-weight.`);
      }
    }
  }
}

function checkSeparatorRequirements(text, relative) {
  // Check separator blocks have has-alpha-channel-opacity class
  const sepRe = /<!--\s*wp:separator\s+\{([^]*?)\}\s*-->\n?([\s\S]*?)<!--\s*\/wp:separator\s*-->/g;
  let sepMatch;
  while ((sepMatch = sepRe.exec(text)) !== null) {
    const [, , innerHtml] = sepMatch;
    if (!innerHtml.includes('has-alpha-channel-opacity')) {
      error(`${relative}: Separator missing "has-alpha-channel-opacity" class — required by save().`);
    }
  }
}

function checkFileBlockRequirements(text, relative) {
  // Check file blocks have aria-describedby on download button
  const fileRe = /<!--\s*wp:file\s+\{([^]*?)\}\s*-->\n?([\s\S]*?)<!--\s*\/wp:file\s*-->/g;
  let fileMatch;
  while ((fileMatch = fileRe.exec(text)) !== null) {
    const [, attrsJson, innerHtml] = fileMatch;
    let attrs = {};
    try {
      attrs = JSON.parse(`{${attrsJson}}`);
    } catch { }
    if (innerHtml.includes('wp-block-file__button') && !innerHtml.includes('aria-describedby')) {
      error(`${relative}: File block download button missing "aria-describedby" — required for accessibility and save() consistency.`);
    }
  }
}

function checkBlockClasses(text, relative) {
  // Check CLASS_REQUIRED blocks have wp-block-{name} class
  for (const slug of CLASS_REQUIRED) {
    const blockRe = new RegExp(`<!--\\s*wp:${slug}\\s+\\{([^]*?)\\}\\s*-->\\n?([\\s\\S]*?)<!--\\s*/wp:${slug}\\s*-->`, 'g');
    let m;
    while ((m = blockRe.exec(text)) !== null) {
      const [, , innerHtml] = m;
      const expectedClass = `wp-block-${slug}`;
      if (!innerHtml.includes(expectedClass)) {
        // Skip if it's inside another block's inner blocks
        warn(`${relative}: Block "${slug}" may be missing "${expectedClass}" class in saved HTML.`);
      }
    }
  }

  // Check CLASS_EXCLUDED blocks do NOT have wp-block-{name} class
  for (const slug of CLASS_EXCLUDED) {
    const blockRe = new RegExp(`<!--\\s*wp:${slug}(?:\\s+\\{([^]*?)\\})?\\s*-->\\n?([\\s\\S]*?)<!--\\s*/wp:${slug}\\s*-->`, 'g');
    let m;
    while ((m = blockRe.exec(text)) !== null) {
      const [, , innerHtml] = m;
      const forbiddenClass = `wp-block-${slug}`;
      if (innerHtml.includes(forbiddenClass)) {
        error(`${relative}: Block "${slug}" has "${forbiddenClass}" class but this block has supports.className:false — class must NOT be present.`);
      }
    }
  }
}

function checkFontFamilyInStyle(text, relative) {
  const blocks = text.match(/<!--\s*wp:([a-z0-9-]+)\s+\{([^]*?)\}\s*-->/g) || [];
  for (const block of blocks) {
    const hasTopLevel = /"fontFamily"\s*:/.test(block);
    const hasStyle = /"style"\s*:\s*\{[^}]*"typography"\s*:\s*\{[^}]*"fontFamily"/.test(block);
    if (!hasTopLevel && hasStyle) {
      error(`${relative} uses fontFamily inside style.typography — must be a top-level block attribute.`);
    }
  }
}

function checkFontSizeInStyle(text, relative) {
  const blocks = text.match(/<!--\s*wp:([a-z0-9-]+)\s+\{([^]*?)\}\s*-->/g) || [];
  for (const block of blocks) {
    const hasTopLevel = /"fontSize"\s*:/.test(block);
    const hasStyle = /"style"\s*:\s*\{[^}]*"typography"\s*:\s*\{[^}]*"fontSize"/.test(block);
    if (!hasTopLevel && hasStyle) {
      error(`${relative} uses fontSize inside style.typography — must be a top-level block attribute.`);
    }
  }
}

function checkMinHeightDeprecation(text, relative) {
  const blocks = text.match(/<!--\s*wp:([a-z0-9-]+)\s+\{([^]*?)\}\s*-->/g) || [];
  for (const block of blocks) {
    const hasMinHeight = /"minHeight"\s*:/.test(block);
    const hasMinHeightUnit = /"minHeightUnit"\s*:/.test(block);
    const hasStyleDimensions = /"style"\s*:\s*\{[^}]*"dimensions"\s*:\s*\{[^}]*"minHeight"/.test(block);
    if ((hasMinHeight || hasMinHeightUnit) && !hasStyleDimensions) {
      warn(`${relative} uses deprecated top-level "minHeight"/"minHeightUnit" — use "style.dimensions.minHeight" instead.`);
    }
  }
}

function checkRawHexInStyleColor(text, relative) {
  const blocks = text.match(/<!--\s*wp:([a-z0-9-]+)\s+\{([^]*?)\}\s*-->/g) || [];
  for (const block of blocks) {
    const hasTextColorAttr = /"textColor"\s*:/.test(block);
    const hasBgColorAttr = /"backgroundColor"\s*:/.test(block);
    const hasStyleColorText = /"style"\s*:\s*\{[^}]*"color"\s*:\s*\{[^}]*"text"\s*:\s*"#[0-9a-fA-F]{3,8}"/.test(block);
    const hasStyleColorBg = /"style"\s*:\s*\{[^}]*"color"\s*:\s*\{[^}]*"background"\s*:\s*"#[0-9a-fA-F]{3,8}"/.test(block);

    if (!hasTextColorAttr && hasStyleColorText) {
      error(`${relative} uses raw hex in style.color.text — must use a "textColor" preset reference instead. Add the color to theme.json palette and use "textColor":"<slug>".`);
    }
    if (!hasBgColorAttr && hasStyleColorBg) {
      error(`${relative} uses raw hex in style.color.background — must use a "backgroundColor" preset reference instead. Add the color to theme.json palette and use "backgroundColor":"<slug>".`);
    }
  }
}

function checkAnchorInlineStyles(text, relative) {
  const matches = text.match(/<a\s[^>]*style="[^"]*"/g) || [];
  for (const m of matches) {
    warn(`${relative} has inline style="..." on an <a> tag inside block markup: ${m.substring(0, 80)}... Inline styles on <a> are not part of the block's saved attributes and may be stripped on re-save.`);
  }
}

function checkUnregisteredBlockStyles(text, relative) {
  const matches = text.match(/className\s*:\s*"is-style-([a-z0-9-]+)"/g) || [];
  for (const m of matches) {
    const styleName = m.match(/is-style-([a-z0-9-]+)/)?.[1];
    if (styleName) {
      warn(`${relative} uses block style class "is-style-${styleName}" — ensure register_block_style('core/<block>', {name:'${styleName}',...}) is called in functions.php.`);
    }
  }
}

function checkAttributeTypeMismatches(text, relative) {
  // Heading level must be integer
  const headings = text.match(/<!--\s*wp:heading\s+\{([^}]*)\}\s*-->/g) || [];
  for (const h of headings) {
    const levelMatch = h.match(/"level"\s*:\s*"(\d)"/);
    if (levelMatch) {
      error(`${relative}: heading "level" must be integer, not string: "${levelMatch[1]}"`);
    }
  }

  // Cover dimRatio must be integer
  const covers = text.match(/<!--\s*wp:cover\s+\{([^}]*)\}\s*-->/g) || [];
  for (const c of covers) {
    const dimMatch = c.match(/"dimRatio"\s*:\s*"(\d+)"/);
    if (dimMatch) {
      error(`${relative}: cover "dimRatio" must be integer, not string: "${dimMatch[1]}"`);
    }
  }
}

function checkDuplicateStyleAttributes(text, relative) {
  const blocks = text.match(/<!--\s*wp:([a-z0-9-]+)(?:\s+\{([^]*?)\})?\s*-->/g) || [];
  for (const block of blocks) {
    const hasFontSizeAttr = /"fontSize"\s*:/.test(block);
    const hasStyleFontSize = /"style"\s*:\s*\{[^}]*"typography"\s*:\s*\{[^}]*"fontSize"/.test(block);
    if (hasFontSizeAttr && hasStyleFontSize) {
      warn(`${relative} has both fontSize attribute and style.typography.fontSize — can trigger save() mismatch.`);
    }

    const hasTextColorAttr = /"textColor"\s*:/.test(block);
    const hasStyleColorText = /"style"\s*:\s*\{[^}]*"color"\s*:\s*\{[^}]*"text"/.test(block);
    if (hasTextColorAttr && hasStyleColorText) {
      warn(`${relative} has both textColor attribute and style.color.text — can trigger save() mismatch.`);
    }

    const hasBgColorAttr = /"backgroundColor"\s*:/.test(block);
    const hasStyleColorBg = /"style"\s*:\s*\{[^}]*"color"\s*:\s*\{[^}]*"background"/.test(block);
    if (hasBgColorAttr && hasStyleColorBg) {
      warn(`${relative} has both backgroundColor attribute and style.color.background — can trigger save() mismatch.`);
    }
  }
}

function checkVersionGates(text, relative, targetWpVersion) {
  for (const [attrGate, gateInfo] of Object.entries(VERSION_GATES)) {
    const { minVersion, blocks } = gateInfo;
    if (versionGte(targetWpVersion, minVersion)) continue;

    const gatePattern = attrGate.includes(':') ? attrGate.split(':')[0] : attrGate;
    if (text.includes(`"${gatePattern}"`) || text.includes(`"${attrGate}"`)) {
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
}

function checkBlockGapShape(text, relative) {
  const objMatches = text.match(/"blockGap"\s*:\s*\{/g) || [];
  for (const bgm of objMatches) {
    const idx = text.indexOf(bgm);
    const objMatch = text.substring(idx).match(/\{[^}]*\}/);
    if (objMatch) {
      const obj = objMatch[0];
      const hasTop = obj.includes('"top"');
      const hasLeft = obj.includes('"left"');
      if (!hasTop || !hasLeft) {
        warn(`${relative} has blockGap object missing required keys (needs top+left for 6.4+): ${obj}`);
      }
    }
  }
}

function checkPresetsAgainstTheme(text, relative, registeredPresets) {
  // var:preset references
  const presetRefs = text.match(/var:preset\|(\w+)\|([a-z0-9-]+)/g) || [];
  for (const ref of presetRefs) {
    const [, category, slug] = ref.split('|');
    const map = { 'color': 'colors', 'spacing': 'spacingSizes', 'font-size': 'fontSizes', 'shadow': 'shadows' };
    const key = map[category];
    if (key && !registeredPresets[key].has(slug)) {
      warn(`${relative} references preset "${ref}" but "${slug}" is not registered in theme.json ${key}.`);
    }
  }

  // textColor, backgroundColor, borderColor, fontSize attributes
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
}

// ── Parser-based deep checks ────────────────────────────────────────

function runParserChecks(text, relative, registeredPresets) {
  if (!wpParser) return;

  let parsed;
  try {
    parsed = wpParser.parse(text);
  } catch (e) {
    warn(`${relative}: Deep parser failed: ${e.message}`);
    return;
  }

  let blockCount = 0;
  function visitBlock(block, depth = 0) {
    if (!block.blockName) return;
    blockCount++;

    const attrs = block.attrs || {};
    const slug = block.blockName.replace('core/', '');
    const prefix = `${relative}: block ${blockCount} (${block.blockName})`;

    // 1. style.typography.color does not exist
    if (attrs.style?.typography?.color) {
      error(`${prefix}: "style.typography.color" does not exist — use "style.color.text" instead`);
    }

    // 2. Top-level align for text alignment on paragraph/heading
    if ((slug === 'paragraph' || slug === 'heading') && attrs.align && ['left', 'center', 'right'].includes(attrs.align)) {
      error(`${prefix}: Top-level "align":"${attrs.align}" is deprecated for text alignment — use "style.typography.textAlign" instead`);
    }

    // 3. Top-level textAlign on heading (deprecated)
    if (slug === 'heading' && attrs.textAlign) {
      warn(`${prefix}: Top-level "textAlign" is deprecated — use "style.typography.textAlign" instead`);
    }

    // 4. Check attribute types from schema (if we had schema loaded)
    // For now, just check heading level is integer
    if (slug === 'heading' && attrs.level !== undefined && typeof attrs.level === 'string') {
      error(`${prefix}: "level" should be number, got string "${attrs.level}"`);
    }

    // 5. Check image url/src match
    if (slug === 'image' && attrs.url) {
      const ownHtml = (block.innerContent || []).filter(c => c !== null).join('');
      const srcMatch = ownHtml.match(/src="([^"]+)"/);
      if (srcMatch && srcMatch[1] !== attrs.url) {
        error(`${prefix}: <img src="${srcMatch[1]}"> doesn't match url attr "${attrs.url}"`);
      }
    }

    // 6. Check heading tag matches level
    if (slug === 'heading') {
      const level = attrs.level || 2;
      const ownHtml = (block.innerContent || []).filter(c => c !== null).join('');
      const tagMatch = ownHtml.match(/<h([1-6])/);
      if (tagMatch && parseInt(tagMatch[1]) !== level) {
        error(`${prefix}: <h${tagMatch[1]}> doesn't match level ${level}`);
      }
    }

    // 7. Check list ol/ul matches ordered
    if (slug === 'list') {
      const isOrdered = attrs.ordered === true;
      const ownHtml = (block.innerContent || []).filter(c => c !== null).join('');
      if (isOrdered && ownHtml.includes('<ul')) {
        error(`${prefix}: ordered=true but uses <ul>`);
      }
      if (!isOrdered && ownHtml.includes('<ol')) {
        error(`${prefix}: ordered is not true but uses <ol>`);
      }
    }

    // Recurse
    for (const inner of (block.innerBlocks || [])) {
      visitBlock(inner, depth + 1);
    }
  }

  for (const block of parsed) {
    visitBlock(block);
  }
}

// ── Walk files ──────────────────────────────────────────────────────

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

// ── Main ────────────────────────────────────────────────────────────

const root = path.resolve(process.argv[2] || '.');

// Required files
const required = [
  'analysis/visual-analysis.json',
  'analysis/wordpress-plan.md',
  'wordpress-design.json',
  'wordpress/theme.json',
  'preview/index.html',
  'report.md'
];

for (const relativePath of required) {
  if (!exists(relativePath, root)) error(`Missing required file: ${relativePath}`);
  else ok(`Found ${relativePath}`);
}

// wordpress-design.json
const artifact = exists('wordpress-design.json', root) ? readJson('wordpress-design.json', root) : null;
if (artifact) {
  if (artifact.schemaVersion !== 1) error('wordpress-design.json schemaVersion must be 1.');
  for (const key of ['source', 'target', 'designTokens', 'sections', 'assumptions']) {
    if (!(key in artifact)) error(`wordpress-design.json is missing ${key}.`);
  }
  if (!Array.isArray(artifact.sections) || artifact.sections.length === 0) {
    error('wordpress-design.json must contain at least one section.');
  }
}

// theme.json
let targetWpVersion = '6.6';
const theme = exists('wordpress/theme.json', root) ? readJson('wordpress/theme.json', root) : null;
if (theme) {
  if (theme.version !== 3) warn(`theme.json version is ${theme.version}; this draft expects version 3 for WordPress 6.6+.`);
  if (typeof theme.$schema !== 'string') warn('theme.json has no $schema value.');
  if (!theme.settings) warn('theme.json has no settings object.');
  if (typeof theme.$schema === 'string' && theme.version === 3) {
    if (!theme.$schema.includes('6.6') && !theme.$schema.includes('trunk')) {
      warn(`theme.json $schema "${theme.$schema}" may not match version 3 (expected 6.6 or trunk).`);
    }
  }
  if (artifact && artifact.target && artifact.target.minimumWordPressVersion) {
    targetWpVersion = artifact.target.minimumWordPressVersion;
  }
}

// Collect presets
const registeredPresets = { colors: new Set(), fontSizes: new Set(), spacingSizes: new Set(), shadows: new Set() };
if (theme && theme.settings) {
  const cs = theme.settings.color || {};
  if (Array.isArray(cs.palette)) for (const p of cs.palette) if (p.slug) registeredPresets.colors.add(p.slug);
  const ss = theme.settings.spacing || {};
  if (Array.isArray(ss.spacingSizes)) for (const s of ss.spacingSizes) if (s.slug) registeredPresets.spacingSizes.add(s.slug);
  const ts = theme.settings.typography || {};
  if (Array.isArray(ts.fontSizes)) for (const f of ts.fontSizes) if (f.slug) registeredPresets.fontSizes.add(f.slug);
  const sh = theme.settings.shadow || {};
  if (Array.isArray(sh.presets)) for (const s of sh.presets) if (s.slug) registeredPresets.shadows.add(s.slug);
}

// Validate patterns
const patternsDir = path.join(root, 'wordpress', 'patterns');
const patternFiles = walk(patternsDir).filter(f => f.endsWith('.php'));

for (const file of patternFiles) {
  const relative = path.relative(root, file);
  const text = fs.readFileSync(file, 'utf8');

  checkPatternHeader(text, relative);
  checkDelimiterBalance(text, relative);
  checkRawHexColors(text, relative, registeredPresets);
  checkStyleTypographyColor(text, relative);
  checkParagraphClass(text, relative);
  checkButtonRequirements(text, relative);
  checkSeparatorRequirements(text, relative);
  checkFileBlockRequirements(text, relative);
  checkBlockClasses(text, relative);
  checkFontFamilyInStyle(text, relative);
  checkFontSizeInStyle(text, relative);
  checkMinHeightDeprecation(text, relative);
  checkRawHexInStyleColor(text, relative);
  checkAnchorInlineStyles(text, relative);
  checkUnregisteredBlockStyles(text, relative);
  checkAttributeTypeMismatches(text, relative);
  checkDuplicateStyleAttributes(text, relative);
  checkVersionGates(text, relative, targetWpVersion);
  checkBlockGapShape(text, relative);
  checkPresetsAgainstTheme(text, relative, registeredPresets);
  runParserChecks(text, relative, registeredPresets);

  ok(`Checked ${relative}`);
}

if (!patternFiles.length) warn('No pattern PHP files found. This may be valid for template-only output.');

// Validate templates and parts
const templatesDir = path.join(root, 'wordpress', 'templates');
const partsDir = path.join(root, 'wordpress', 'parts');
const templateFiles = walk(templatesDir).filter(f => f.endsWith('.html'));
const partFiles = walk(partsDir).filter(f => f.endsWith('.html'));

for (const file of [...templateFiles, ...partFiles]) {
  const relative = path.relative(root, file);
  const text = fs.readFileSync(file, 'utf8');

  checkDelimiterBalance(text, relative);
  checkRawHexColors(text, relative, registeredPresets);
  checkStyleTypographyColor(text, relative);
  checkParagraphClass(text, relative);
  checkButtonRequirements(text, relative);
  checkSeparatorRequirements(text, relative);
  checkFileBlockRequirements(text, relative);
  checkBlockClasses(text, relative);
  checkFontFamilyInStyle(text, relative);
  checkFontSizeInStyle(text, relative);
  checkMinHeightDeprecation(text, relative);
  checkRawHexInStyleColor(text, relative);
  checkAnchorInlineStyles(text, relative);
  checkUnregisteredBlockStyles(text, relative);
  checkAttributeTypeMismatches(text, relative);
  checkDuplicateStyleAttributes(text, relative);
  checkVersionGates(text, relative, targetWpVersion);
  checkBlockGapShape(text, relative);
  checkPresetsAgainstTheme(text, relative, registeredPresets);
  runParserChecks(text, relative, registeredPresets);

  ok(`Checked ${relative}`);
}

// Summary
console.log(`\nValidation complete: ${errors} error(s), ${warnings} warning(s).`);
process.exit(errors ? 1 : 0);
