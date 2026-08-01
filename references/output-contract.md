# Output contract

## Required files

```text
analysis/visual-analysis.json
analysis/wordpress-plan.md
wordpress-design.json
wordpress/theme.json
preview/index.html
report.md
```

Additional files depend on the requested artifact.

## `analysis/visual-analysis.json`

Must include:

- source files,
- viewport information,
- visible sections,
- extracted token candidates,
- responsive observations,
- assumptions with confidence.

## `analysis/wordpress-plan.md`

For each section include:

- section name and purpose,
- implementation type,
- core block tree,
- content behavior,
- theme.json changes,
- scoped CSS need,
- custom block candidate,
- uncertainty.

## `wordpress-design.json`

This is the canonical machine-readable handoff. It must validate against `assets/wordpress-design.schema.json` as closely as the environment permits.

## `wordpress/theme.json`

- Use version 3 when targeting WordPress 6.6+.
- Preserve supplied theme settings when extending a theme.
- Add only design tokens and styles required by the comp.
- Ensure `$schema` matches the target version.

## Pattern files

- Use valid PHP pattern headers.
- Use serialized Gutenberg markup.
- Keep content editable.
- Use placeholders for unavailable images and record replacement work in the report.
- **Do not use attributes introduced in a WordPress version later than the stated `minimumWordPressVersion`.**
- **Do not duplicate preset classes with inline `style` attributes for the same property.**

## Preview

The preview is for visual inspection. It must use the same token values and section decisions as the WordPress output.

## Report

The report is a candid handoff, not marketing copy. Include validation failures, unsupported details, assumptions, and manual WordPress verification work.

Include a section on **WordPress verification** documenting:
- Whether patterns were tested in the block editor,
- Any "unexpected or invalid content" warnings and how they were resolved,
- Which presets were verified against the active theme,
- Any `parse_blocks()` or `wp-env` test results.
