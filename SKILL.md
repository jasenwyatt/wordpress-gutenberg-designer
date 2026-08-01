---
name: wordpress-gutenberg-designer
description: Use this plugin when the user provides a comp, screenshot, mockup, or existing design and wants a WordPress Gutenberg implementation plan and editable block artifacts using theme.json, core block markup, patterns, templates, and minimal scoped CSS.
license: MIT
metadata:
  author: Jasen Wyatt
  version: 0.2.0
od:
  scenario: import
  mode: prototype
---

# WordPress Gutenberg Designer

Turn a visual comp or mockup into a WordPress-native implementation package. The source comp is the visual authority. Existing WordPress files, when provided, are the implementation authority.

This plugin is intentionally **core-blocks-first**. It generates a WordPress plan and editable Gutenberg artifacts instead of treating static HTML as the final implementation.

## Use this plugin when

- A screenshot, comp, or mockup must be recreated in Gutenberg.
- A design needs to become a block pattern, page template, template part, or block-theme starter.
- A design needs a compatible `theme.json` token system.
- An existing WordPress site or theme should be extended without inventing a parallel component system.
- The user wants to understand which parts should be core blocks, patterns, Query Loops, template parts, block styles, or custom blocks.

Do not use this plugin merely to generate a generic static HTML page.

## Inputs

Use the inputs supplied by the host application when available:

- `designComp`: primary desktop comp, screenshot, mockup, or design export.
- `mobileComp`: optional mobile comp.
- `existingThemeJson`: optional existing `theme.json`.
- `artifactType`: requested WordPress artifact.
- `implementationStrategy`: core-block and custom-block constraints.
- `namespace`: slug used for pattern slugs and optional custom artifacts.
- `minimumWordPressVersion`: compatibility target.
- `projectNotes`: content behavior, CPTs, Query Loop requirements, accessibility constraints, and other implementation notes.

If a required input is genuinely missing, ask one concise question. Do not ask questions that the supplied comp or existing files already answer.

## Required references

Read these files before generation:

1. `references/comp-analysis.md`
2. `references/core-block-strategy.md`
3. `references/theme-json-mapping.md`
4. `references/gutenberg-markup.md`
5. `references/output-contract.md`
6. `references/block-validation.md`

Use `assets/wordpress-design.schema.json` as the shape for `wordpress-design.json`.
Use `assets/theme-json.template.json` as a safe starting structure, not as a substitute for inspecting an existing `theme.json`.

## Non-negotiable rules

1. The comp is the visual source, but it cannot reveal content behavior with certainty. Record inferred behavior explicitly.
2. Existing `theme.json`, registered block inventory, patterns, or CSS override newly inferred tokens when supplied.
3. Prefer core blocks over custom blocks.
4. Prefer patterns over layout-only custom blocks.
5. Prefer Query Loop and theme blocks for dynamic WordPress content.
6. Do not generate custom React blocks in this MVP. Describe justified custom-block candidates in `report.md` instead.
7. Use `theme.json` presets for supported color, typography, spacing, shadow, and layout values.
8. Do not invent core block names or attributes.
9. Gutenberg block comments and their saved HTML must be structurally valid.
10. **Do not generate attributes introduced in a WordPress version later than `minimumWordPressVersion`.** If the comp requires a newer feature, document it as a custom-block candidate or scoped-CSS fallback.
11. **Do not duplicate a preset class with an inline `style` for the same property** (e.g., both `has-display-font-size` class and `style="font-size:..."`). This triggers Gutenberg's `save()` validation mismatch.
12. **Do not nest `fontFamily` or `fontSize` inside `style.typography`.** They are top-level block attributes. `save()` reads `attributes.fontFamily`, not `attributes.style.typography.fontFamily`.
13. **Do not use raw hex colors in `style.color.text` or `style.color.background`.** Use top-level `textColor` and `backgroundColor` attributes with preset slugs. Add `#ffffff` and other common colors to the palette.
14. **Do not use deprecated `minHeight`/`minHeightUnit` top-level attributes.** Use `style.dimensions.minHeight` instead (e.g., `"style":{"dimensions":{"minHeight":"640px"}}`).
15. **Do not add inline `style` attributes on `<a>` tags inside block markup.** Inline styles on links are not saved as block attributes and may be stripped on re-save.
16. **Register all `is-style-*` classes in `functions.php` via `register_block_style()`**, or the class has no effect and may trigger a validation warning.
17. **Never use `style.typography.color` — it does not exist in Gutenberg.** Use `style.color.text` for custom hex text color. Using `style.typography.color` causes block recovery on every block.
18. **Never add `wp-block-paragraph` class to `<p>`.** Paragraph's `save()` never adds this class. Adding it causes mass block recovery.
19. **Button `<a>` must include `has-custom-font-size` when `fontSize` is set**, `has-border-color` when border color is set, and `wp-element-button` always. CSS properties must follow: border → color → spacing → typography.
20. **Separator blocks must include `has-alpha-channel-opacity`.** Missing this class causes block recovery.
21. **File block download buttons must have `aria-describedby`** referencing the text link's ID.
22. **When `style.css` is set (7.0+), include `has-custom-css`** on the block wrapper.
23. Static preview HTML is a visual projection only. It is never the canonical WordPress artifact.
24. Preserve heading order, landmarks, readable contrast, keyboard access, meaningful image alt guidance, and reduced-motion behavior.
25. Never claim pixel-perfect fidelity when the comp omits responsive states, font files, asset crops, or content behavior.

## Workflow

### 1. Inspect source material

- Inspect the primary comp and optional mobile comp.
- Inspect the existing `theme.json` when supplied.
- Identify viewport dimensions when available.
- Identify visual regions, content hierarchy, repeated structures, dynamic-looking content, and likely responsive changes.
- Distinguish visible facts from assumptions.

Write `analysis/visual-analysis.json` before implementation markup.

### 2. Extract and reconcile tokens

Identify:

- semantic color roles,
- font families and fallbacks,
- type scale,
- spacing rhythm,
- content and wide widths,
- border radii,
- shadows,
- button treatments,
- media aspect ratios,
- breakpoint assumptions.

When an existing `theme.json` is supplied:

- reuse existing slugs when visually close,
- do not create duplicate presets with trivial differences,
- list proposed additions separately,
- preserve unsupported existing settings.

### 3. Decompose into WordPress primitives

For every visible section, decide among:

- core block composition,
- block pattern,
- page or post template,
- template part,
- Query Loop composition,
- registered block style plus scoped CSS,
- custom block candidate requiring later engineering.

Document each decision in `analysis/wordpress-plan.md` and `wordpress-design.json`.

### 4. Stop for plan review

Before generating final WordPress files, present a concise plan containing:

- section name,
- WordPress artifact type,
- proposed core blocks,
- dynamic-content behavior,
- CSS requirement,
- custom-block requirement,
- uncertainty or assumption.

When the host provides a confirmation surface, wait for approval or requested changes. Otherwise continue and clearly label the plan as provisional.

### 5. Generate the canonical artifact

Create `wordpress-design.json` according to `assets/wordpress-design.schema.json`.

The model should contain:

- source metadata,
- target compatibility,
- design tokens,
- sections,
- block trees,
- responsive behavior,
- assumptions,
- custom block candidates,
- additional CSS requirements.

### 6. Generate WordPress files

Generate only files justified by the selected artifact type:

- `wordpress/theme.json`
- `wordpress/patterns/*.php`
- `wordpress/templates/*.html`
- `wordpress/parts/*.html`
- `wordpress/styles/*.json`
- `wordpress/assets/css/components.css`

Pattern files must include valid WordPress pattern headers and serialized block markup.

Keep extra CSS minimal and scoped to a declared pattern or block-style class. Do not reproduce all `theme.json` styles in CSS.

### 7. Generate preview

Create `preview/index.html` from the same design decisions used for the WordPress artifacts.

The preview must:

- visually represent the generated design,
- expose section boundaries with `data-wp-artifact` attributes when practical,
- use the same token names and values,
- include desktop and responsive behavior,
- avoid becoming an unrelated static implementation.

### 8. Critique and verify

Before calling the output complete, run the structural validator and perform a manual WordPress verification.

Run the validator when available:

```bash
node scripts/validate-output.mjs <generated-output-directory>
```

Then perform this manual WordPress checklist on a real site with the generated theme active:

**Structural checks (editor):**
- [ ] Every pattern loads in the block editor without "unexpected or invalid content" warnings.
- [ ] Block delimiter balance is correct (every `<!-- wp:... -->` has a matching `<!-- /wp:... -->`).
- [ ] No container block uses self-closing syntax (`/-->`).
- [ ] No `core/` namespace prefix appears inside serialized block comments.
- [ ] No version-incompatible attributes are present for the stated `minimumWordPressVersion`.
- [ ] No raw hex colors exist in block markup (all colors reference `theme.json` presets).
- [ ] All referenced presets (`var:preset|color|...`, `var:preset|spacing|...`, etc.) exist in `theme.json`.
- [ ] No inline `style` duplicates a preset class for the same property (e.g., `has-display-font-size` + `style="font-size:..."`).
- [ ] **No `fontFamily` or `fontSize` nested inside `style.typography` — they must be top-level attributes.**
- [ ] **No raw hex in `style.color.text` or `style.color.background` — use `textColor`/`backgroundColor` presets.**
- [ ] **No deprecated `minHeight`/`minHeightUnit` — use `style.dimensions.minHeight`.**
- [ ] **No inline `style` on `<a>` tags inside blocks.**
- [ ] **All `is-style-*` classes have matching `register_block_style()` in `functions.php`.**
- [ ] **No `style.typography.color` — use `style.color.text` instead.**
- [ ] **No `wp-block-paragraph` class on `<p>` — paragraph `save()` never adds it.**
- [ ] **Buttons have `has-custom-font-size` when `fontSize` is set, `has-border-color` when border color is set, `wp-element-button` always.**
- [ ] **Button `<a>` CSS properties follow: border → color → spacing → typography.**
- [ ] **Separators have `has-alpha-channel-opacity`.**
- [ ] **File block download buttons have `aria-describedby`.**
- [ ] **Blocks with `style.css` have `has-custom-css` (7.0+).**

**Visual checks (editor + frontend):**
- [ ] All preset colors, font sizes, and spacing values render correctly in both editor and frontend.
- [ ] Custom classes appear in the DOM and match intended scoped CSS.
- [ ] Responsive behavior matches the comp (stack order, hiding, breakpoints).
- [ ] Images have correct aspect ratios or scale behavior.
- [ ] Buttons are editable and links are clickable.
- [ ] Query loops populate with the correct post type and ordering when applicable.
- [ ] Heading hierarchy makes sense for accessibility (`h1` → `h2` → `h3`).
- [ ] The pattern can be inserted from the pattern inserter and works in multiple contexts (page, post, template).

**If subprocess execution is available, also run:**

```bash
node scripts/validate-output.mjs <generated-output-directory>
```

Fix all errors before final delivery. Warnings may remain only when explained in `report.md` with a clear remediation plan.

For high-stakes handoffs, add a `parse_blocks()` test in the target WordPress environment (see `references/block-validation.md` §Escalation).

## Output contract

Produce this structure, omitting folders that do not apply:

```text
analysis/
  visual-analysis.json
  wordpress-plan.md
wordpress-design.json
wordpress/
  theme.json
  patterns/
  templates/
  parts/
  styles/
  assets/css/components.css
preview/
  index.html
report.md
```

`report.md` must summarize:

- files generated,
- core blocks used,
- patterns and templates generated,
- tokens reused and added,
- inferred responsive behavior,
- dynamic-content decisions,
- custom-block candidates not generated,
- validation results,
- manual work still required.

## Quality threshold

A successful result is not merely visually similar. It must also be editable in Gutenberg, aligned with the supplied WordPress design system, explicit about assumptions, and free of gratuitous custom components.
