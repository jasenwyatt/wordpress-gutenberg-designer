# Core block implementation strategy

Use the least custom WordPress primitive that preserves the design and editing experience.

## Decision order

1. Core block composition
2. Core block composition with `theme.json`
3. Block pattern
4. Template or template part
5. Query Loop composition
6. Registered block style plus scoped CSS
7. Existing project custom block
8. New custom block candidate

## Common mappings

| Visual structure | Preferred WordPress structure |
| --- | --- |
| Full-width section with constrained content | `core/group` with full alignment and constrained layout |
| Split text and image | `core/columns` or `core/media-text` |
| Horizontal button set | `core/buttons` and `core/button` |
| Repeated editorial cards | `core/query` + `core/post-template` when dynamic; a pattern when manual |
| Icon and text feature list | Groups/columns with image or inline icon strategy; avoid one custom block per card |
| Hero with background image | `core/cover` when semantics and controls fit |
| Site header/footer | Template part |
| Page-specific composition | Page template or full-page pattern |
| Reusable marketing section | Pattern |
| Global reusable content | Synced pattern recommendation, documented in report |

## Custom block candidate criteria

Only propose a new custom block when one or more are true:

- it requires a structured content model that core blocks cannot preserve,
- it has complex interactive state,
- it consumes external API data,
- it needs custom inspector controls tied to rendering behavior,
- it must strictly control nested content beyond a reasonable pattern or template lock,
- it requires server rendering unavailable through existing dynamic blocks.

Do not propose a custom block merely for:

- background color,
- spacing,
- border radius,
- a two-column layout,
- a card grid,
- a hero,
- decorative imagery,
- a style variation.

## Dynamic content

When the comp contains repeated content and project notes identify a post type or taxonomy:

- use Query Loop and Post Template where possible,
- identify required query parameters,
- represent post fields with theme blocks,
- note meta-field requirements that core blocks cannot expose,
- do not hard-code a dynamic dataset just to match the comp.
