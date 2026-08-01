# theme.json mapping rules

Target `theme.json` version 3 for WordPress 6.6 or later unless the supplied compatibility target requires otherwise.

## Existing theme precedence

When an existing `theme.json` is supplied:

1. Preserve its schema URL and compatible version.
2. Reuse existing palette, font-size, font-family, spacing, shadow, and layout slugs when visually suitable.
3. Propose additions instead of silently renaming existing slugs.
4. Preserve unrelated settings and styles.
5. Avoid creating near-duplicate tokens.

## Token destinations

| Design token | theme.json destination |
| --- | --- |
| Semantic colors | `settings.color.palette` |
| Gradients | `settings.color.gradients` |
| Font families | `settings.typography.fontFamilies` |
| Type scale | `settings.typography.fontSizes` |
| Spacing scale | `settings.spacing.spacingSizes` |
| Shadows | `settings.shadow.presets` |
| Content width | `settings.layout.contentSize` |
| Wide width | `settings.layout.wideSize` |
| Global defaults | `styles` |
| Element defaults | `styles.elements` |
| Per-block defaults | `styles.blocks` |
| Style variations | `styles/*.json` when appropriate |

## Preset usage

Prefer WordPress preset syntax in style values:

```text
var:preset|color|brand
var:preset|spacing|60
var:preset|font-size|display
var:preset|shadow|soft
```

Use the corresponding generated CSS variables only in standalone CSS:

```css
var(--wp--preset--color--brand)
var(--wp--preset--spacing--60)
```

## What should remain CSS

Use scoped CSS for features not cleanly represented by `theme.json`, including:

- pseudo-elements,
- complex selectors,
- advanced responsive grid behavior,
- nontrivial animations,
- progressive enhancement states,
- highly specific component relationships.

Do not duplicate global token definitions in CSS.
