# Comp analysis protocol

Analyze the visual source before proposing WordPress markup.

## Record visible facts

- source filename and inferred viewport,
- page or section boundaries,
- content order,
- heading hierarchy as visually implied,
- repeated visual structures,
- alignments and container widths,
- image crops and aspect ratios,
- semantic color roles,
- typography roles,
- spacing rhythm,
- interactive-looking controls,
- desktop and mobile differences when both are provided.

## Record assumptions separately

A screenshot cannot establish:

- whether repeated cards are manual content, posts, terms, users, or a CPT,
- whether a CTA is global or local,
- whether a section is synced,
- exact breakpoint values,
- hover, focus, loading, empty, and error states,
- whether imagery is decorative or meaningful,
- whether text is fixed copy or editable content,
- exact fonts when they are unavailable.

Every assumption must include a confidence value: `high`, `medium`, or `low`.

## Responsive inference

When only a desktop comp exists, prefer conservative behavior:

- stack columns in reading order,
- keep primary text before supporting media unless the design strongly implies otherwise,
- preserve tap target size,
- avoid fixed heights,
- use fluid type only where the active theme supports it,
- record reordered content explicitly,
- do not invent decorative mobile variants without evidence.

## Section decomposition

For each section, identify:

- section purpose,
- reusable boundary,
- editable content,
- dynamic content,
- likely WordPress artifact,
- likely core blocks,
- custom styling,
- unresolved questions.
