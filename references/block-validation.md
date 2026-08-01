# Gutenberg block validation reference

Use this when reviewing generated patterns before handoff. The goal is to catch markup that will break in the WordPress editor before it leaves the plugin output.

## How Gutenberg validates blocks

When a post or pattern containing block markup is loaded in the editor, WordPress calls each block's `save()` function with the stored attributes and compares the returned HTML to the saved HTML inside the block comment.

If they differ, the editor shows:
> "This block contains unexpected or invalid content."

The user can "Attempt recovery," but recovery often strips styling or resets content. Patterns that trigger this on first load are a bad handoff.

### What triggers validation failures

1. **Saved HTML does not match `save()` output** — the most common cause.
2. **Attributes stored in the block comment do not match the block's registered attribute schema** — e.g., a string where a boolean is expected, or an object where a string is expected.
3. **Block name is wrong** — using `core/paragraph` inside serialized comments (should be `paragraph`), or omitting the namespace on a custom block.
4. **Self-closing syntax on a container block** — `<!-- wp:group /-->` is invalid because `core/group` has inner blocks.
5. **Version-specific attributes used on an older WordPress target** — e.g., `aspectRatio` on `core/image` was added in 6.5; using it on 6.4 breaks.
6. **Custom CSS classes without registered block styles** — some blocks tolerate this, others warn.
7. **Preset references that do not exist in the active theme** — `has-accent-color` without an `accent` color in `theme.json` is usually harmless but can cause class-only styling gaps.

## Version compatibility matrix

| Feature | Introduced | Minimum WP | Notes |
| --- | --- | --- | --- |
| `theme.json` v3 | 6.6 | 6.6 | Use `$schema` `https://schemas.wp.org/wp/6.6/theme.json` |
| `theme.json` v2 | 6.1 | 6.1 | `version: 2` |
| `theme.json` v1 | 5.8 | 5.8 | Legacy; do not generate for new work |
| `settings.spacing.blockGap` as string | 6.1 | 6.1 | `"blockGap": "2rem"` |
| `settings.spacing.blockGap` as object | 6.4 | 6.4 | `{"top":"2rem","left":"2rem"}` |
| `aspectRatio` on `core/image` | 6.5 | 6.5 | Stored as attribute, rendered in `style` |
| `scale` on `core/image` | 6.5 | 6.5 | `"cover"`, `"contain"`, `"fill"` |
| `layout.type: "grid"` | 6.6 | 6.6 | `core/group` grid layout |
| `typography.textWrap` | 6.6 | 6.6 | `"pretty"`, `"balance"` |
| `shadow` presets | 6.6 | 6.6 | `settings.shadow.presets` |
| `customDuotone` | 6.3 | 6.3 | `settings.color.customDuotone` |
| `border.radius` object | 6.3 | 6.3 | `{"topLeft":"","topRight":"",...}` |
| `spacing.padding` / `margin` | 6.1 | 6.1 | Object with `top`, `right`, `bottom`, `left` |
| `spacing.blockGap` in block styles | 6.1 | 6.1 | `styles.blocks.core/group.spacing.blockGap` |
| `fontFamilies` in `theme.json` | 6.1 | 6.1 | Array with `fontFamily`, `slug`, `name` |
| `fluid` typography | 6.1 | 6.1 | `settings.typography.fluid` |
| `spacing.units` | 5.9 | 5.9 | `px`, `em`, `rem`, `vh`, `vw`, `%` |
| `dimensions.minHeight` on `core/group` | 6.3 | 6.3 | `"minHeight": "100vh"` |
| `dimensions.aspectRatio` on `core/cover` | 6.5 | 6.5 | `"aspectRatio": "16/9"` |
| `position.sticky` | 6.4 | 6.4 | `core/group` sticky positioning |
| `align: "full"` with `layout` | 6.1 | 6.1 | Requires `layout` support in theme |

When the target `minimumWordPressVersion` is lower than the introduction version, either:
- Omit the attribute and achieve the effect with scoped CSS, or
- Document the version requirement in `report.md` and warn that the theme must polyfill.

## Core block serialization rules

### Namespace rules

- **Core blocks** omit `core/` in serialized comments: `<!-- wp:heading -->`
- **Custom blocks** include their full namespace: `<!-- wp:my-plugin/hero -->`
- Never use `core/heading` inside a saved comment. It is valid in code registration, but invalid in serialized markup.

### Container vs self-closing

| Block | Type | Example |
| --- | --- | --- |
| `core/group` | Container | `<!-- wp:group -->...<!-- /wp:group -->` |
| `core/columns` | Container | `<!-- wp:columns -->...<!-- /wp:columns -->` |
| `core/column` | Container | `<!-- wp:column -->...<!-- /wp:column -->` |
| `core/heading` | Container | `<!-- wp:heading -->...<!-- /wp:heading -->` |
| `core/paragraph` | Container | `<!-- wp:paragraph -->...<!-- /wp:paragraph -->` |
| `core/buttons` | Container | `<!-- wp:buttons -->...<!-- /wp:buttons -->` |
| `core/button` | Container | `<!-- wp:button -->...<!-- /wp:button -->` |
| `core/cover` | Container | `<!-- wp:cover -->...<!-- /wp:cover -->` |
| `core/media-text` | Container | `<!-- wp:media-text -->...<!-- /wp:media-text -->` |
| `core/query` | Container | `<!-- wp:query -->...<!-- /wp:query -->` |
| `core/post-template` | Container | `<!-- wp:post-template -->...<!-- /wp:post-template -->` |
| `core/latest-posts` | Self-closing | `<!-- wp:latest-posts {"postsToShow":4} /-->` |
| `core/archives` | Self-closing | `<!-- wp:archives /-->` |
| `core/categories` | Self-closing | `<!-- wp:categories /-->` |
| `core/calendar` | Self-closing | `<!-- wp:calendar /-->` |
| `core/rss` | Self-closing | `<!-- wp:rss {"feedURL":"..."} /-->` |
| `core/search` | Self-closing | `<!-- wp:search /-->` |
| `core/social-links` | Container | `<!-- wp:social-links -->...<!-- /wp:social-links -->` |
| `core/social-link` | Self-closing | `<!-- wp:social-link {"url":"..."} /-->` |
| `core/navigation` | Container | `<!-- wp:navigation -->...<!-- /wp:navigation -->` |
| `core/navigation-link` | Container | `<!-- wp:navigation-link -->...<!-- /wp:navigation-link -->` |
| `core/page-list` | Self-closing | `<!-- wp:page-list /-->` |
| `core/spacer` | Self-closing | `<!-- wp:spacer {"height":"100px"} /-->` |
| `core/separator` | Self-closing | `<!-- wp:separator /-->` |
| `core/more` | Self-closing | `<!-- wp:more {"noTeaser":true} /-->` |

When uncertain, assume **container**. Only use self-closing syntax for blocks that are registered as dynamic and have no meaningful saved inner HTML.

### Attribute format rules

1. Attributes are **JSON inside the opening comment**.
2. Use **double quotes** in JSON keys and string values.
3. Escape inner quotes with backslash: `{"alt":"A \"hero\" image"}`.
4. Do not add spaces around colons in JSON: `{"align":"full"}` not `{ "align": "full" }`.
5. Preserve the exact attribute shape the block expects — arrays, objects, booleans, and nulls are not interchangeable.

### Style attribute structure

Gutenberg stores design styles in a nested `style` object. Common shapes:

```json
{
  "style": {
    "color": {
      "background": "var:preset|color|canvas",
      "text": "var:preset|color|ink"
    },
    "spacing": {
      "padding": {
        "top": "var:preset|spacing|60",
        "bottom": "var:preset|spacing|60",
        "left": "var:preset|spacing|40",
        "right": "var:preset|spacing|40"
      },
      "margin": {
        "top": "0",
        "bottom": "0"
      },
      "blockGap": "var:preset|spacing|40"
    },
    "typography": {
      "fontSize": "var:preset|font-size|display",
      "lineHeight": "0.98",
      "fontStyle": "normal",
      "fontWeight": "700"
    },
    "border": {
      "radius": "1.25rem"
    }
  }
}
```

**Critical:** `blockGap` accepts either a **string** (6.1+) or an **object with `top`/`left`** (6.4+). Do not mix shapes:

```json
// Valid 6.1+
"blockGap": "var:preset|spacing|40"

// Valid 6.4+
"blockGap": {
  "top": "var:preset|spacing|40",
  "left": "var:preset|spacing|40"
}

// Invalid — never do this
"blockGap": {
  "left": "var:preset|spacing|80"
}
```

When targeting 6.6+, prefer the string form for simplicity unless you need axis-specific gaps.

## Per-block gotchas

### `core/heading`

- `level` is integer `1`–`6`. Do not use string `"1"`.
- `fontSize` attribute maps to `has-{slug}-font-size` class. If you also add an inline `style.fontSize`, the block may drop one.
- `textAlign` is `"left"`, `"center"`, `"right"`. Do not invent `"justify"` unless the block supports it.

### `core/paragraph`

- Inline `style.fontSize` conflicts with `fontSize` preset attribute. Use one, not both.
- `dropCap` is boolean. Do not use string `"true"`.

### `core/button` / `core/buttons`

- `core/buttons` is the wrapper; `core/button` is the individual item.
- `core/button` inner HTML is the link text, wrapped in `<a class="wp-block-button__link wp-element-button">`.
- Do not add `href` as a block attribute — it is stored in the saved HTML, not the comment JSON.
- `width` on `core/buttons` is `"25%"`, `"50%"`, `"75%"`, `"100%"`.

### `core/image`

- `aspectRatio` requires WP 6.5+. If targeting earlier, use CSS `aspect-ratio` in scoped CSS.
- `scale` requires WP 6.5+.
- `linkDestination` values: `"none"`, `"media"`, `"attachment"`, `"custom"`.
- `sizeSlug` values: `"thumbnail"`, `"medium"`, `"large"`, `"full"`.
- Do not add `src` as a block attribute — it is in the saved `<img>` tag.

### `core/cover`

- `url` is the background image URL. It **is** an attribute.
- `dimRatio` is integer `0`–`100`.
- `overlayColor` references a palette slug.
- `minHeight` and `minHeightUnit` are separate attributes in older versions; in 6.3+ they are merged into `dimensions.minHeight` in `style`.

### `core/columns` / `core/column`

- `columns` on `core/columns` is an integer, not an array.
- `width` on `core/column` is a string like `"66.66%"` or `"33.33%"`.
- `verticalAlignment` on `core/columns` is `"top"`, `"center"`, `"bottom"`, `"stretch"`, `"space-between"`.
- `verticalAlignment` on `core/column` is `"top"`, `"center"`, `"bottom"`, `"stretch"`, `"space-between"`.

### `core/group`

- `layout.type`: `"constrained"`, `"flex"`, `"grid"` (6.6+).
- `tagName`: `"div"`, `"header"`, `"main"`, `"section"`, `"article"`, `"aside"`, `"footer"`, `"nav"`, `"figure"`.
- `tagName` is an attribute, not in `style`.

### `core/query` / `core/post-template`

- `query` object on `core/query` contains `postType`, `order`, `orderBy`, `taxQuery`, etc.
- `namespace` inside `query` is for custom query types.
- Do not hard-code post IDs. Use `query.include` only when specifically requested.

### `core/social-links`

- `iconColorValue` and `iconBackgroundColorValue` are raw hex strings. Prefer preset references when possible.
- `openInNewTab` is boolean.

## Custom CSS classes

Adding `className` to a core block is usually safe, but:

1. The class must not conflict with WordPress-generated classes (`wp-block-*`, `has-*`, `is-style-*`).
2. If the class implies a registered block style (e.g., `is-style-service-hero`), the theme must register it:
   ```php
   register_block_style( 'core/group', array(
     'name'  => 'service-hero',
     'label' => __( 'Service Hero', 'textdomain' ),
   ) );
   ```
3. When a custom class is used for scoped CSS only, document it in `report.md` under "Manual work still required."

## Manual verification checklist

Before calling a pattern complete, verify every item on a real WordPress site:

- [ ] Pattern loads in the editor without the "unexpected or invalid content" warning.
- [ ] All preset colors, font sizes, and spacing values render correctly.
- [ ] Custom classes appear in the DOM and match the intended scoped CSS.
- [ ] Responsive behavior matches the comp (stack order, hiding, breakpoints).
- [ ] Images have correct aspect ratios or scale behavior.
- [ ] Buttons are editable and links are clickable.
- [ ] Query loops populate with the correct post type and ordering.
- [ ] No inline `style` attributes duplicate preset classes (e.g., both `has-accent-color` and `style="color:#D66A3A"`).
- [ ] Heading hierarchy makes sense for accessibility (`h1` → `h2` → `h3`).
- [ ] The pattern can be inserted from the pattern inserter and works in multiple contexts (page, post, template).

## Escalation: when to add a `parse_blocks` test

For high-stakes handoffs, add an automated test:

```php
$blocks = parse_blocks( $pattern_markup );
foreach ( $blocks as $block ) {
  if ( is_array( $block ) && ! empty( $block['blockName'] ) ) {
    $block_type = WP_Block_Type_Registry::get_instance()->get_registered( $block['blockName'] );
    if ( ! $block_type ) {
      // Block is not registered — will break
    }
    if ( $block_type && ! empty( $block_type->attributes ) ) {
      // Validate attributes against schema
    }
  }
}
```

Run this in the target WordPress environment with the generated theme active. If any block is unregistered or any attribute is invalid, the test fails before handoff.
