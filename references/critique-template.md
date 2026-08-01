# Self-Check Template

Use this template when performing the LLM self-check critique in SKILL.md §Step 8.

Since no external tools are available, the agent must read its own generated files and score them manually.

## Structural Checklist

### Critical Rules (🔴 — each violation = -2 points)

- [ ] No `style.typography.color` anywhere in block markup
- [ ] No `wp-block-paragraph` class on `<p>` tags
- [ ] `fontFamily` and `fontSize` are top-level attributes, not inside `style.typography`
- [ ] No deprecated `minHeight`/`minHeightUnit` — use `style.dimensions.minHeight`
- [ ] No raw hex in `style.color.text` or `style.color.background`
- [ ] No inline `style` on `<a>` tags inside blocks
- [ ] No container block uses self-closing syntax (`/-->`)
- [ ] No unmatched block delimiters

### High Rules (🟡 — each violation = -1 point)

- [ ] Button `<a>` has `has-custom-font-size` when `fontSize` is set
- [ ] Button `<a>` has `has-border-color` when border color is set
- [ ] Button `<a>` has `wp-element-button` always
- [ ] Separator blocks include `has-alpha-channel-opacity`
- [ ] File block download buttons have `aria-describedby`
- [ ] Blocks with `style.css` have `has-custom-css` (7.0+)
- [ ] No version-incompatible attributes for `minimumWordPressVersion`
- [ ] All `is-style-*` classes have `register_block_style()` in `functions.php`

## Semantic Checklist

- [ ] Heading levels descend logically
- [ ] Landmark regions used correctly
- [ ] Contrast ratios plausible
- [ ] Alt text present for images or noted decorative
- [ ] Patterns are reusable
- [ ] Query loops target correct post type
- [ ] Template parts wired into templates
- [ ] Preview HTML matches comp layout
- [ ] Colors match extracted palette
- [ ] Font sizes match typography scale
- [ ] Spacing values match comp rhythm

## Scoring

Tally critical errors: ___
Tally high errors: ___
Semantic issues found? Y/N

```
startScore = 5
if (criticalErrors > 0): startScore -= 2
if (criticalErrors > 3): startScore -= 1
if (highErrors > 0): startScore -= 1
if (highErrors > 4): startScore -= 1
if (semanticIssuesFound): startScore -= 1
finalScore = clamp(startScore, 1, 5)
```

| Score | Action |
|-------|--------|
| 5 | Deliver |
| 4 | Deliver |
| 3 | Fix critical errors, re-check, deliver |
| 2 | Regenerate failing files |
| 1 | Full regeneration required |

## Iteration Log

| Iteration | Critical | High | Semantic | Score | Action |
|-----------|----------|------|----------|-------|--------|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
