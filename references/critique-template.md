# Critique Report Template

Use this template when writing `critique.md` during the hybrid machine+LLM critique phase.

## When to use

- After generating WordPress patterns/templates
- Before calling the output complete
- Whenever the pipeline enters the `critique` stage

## Template

```markdown
# Critique Report

Date: <YYYY-MM-DD HH:MM>
Iteration: <N>

## Machine Validation

```
<paste full validator output here>
```

Validator error count: <N>
Validator warning count: <N>
Machine base score: <1-4>

## Semantic Review

| Check | Status | Notes |
|-------|--------|-------|
| Heading hierarchy | ✓/✗ | |
| Landmark usage | ✓/✗ | |
| Contrast | ✓/✗ | |
| Pattern reusability | ✓/✗ | |
| Query loop correctness | ✓/✗ | |
| Token fidelity | ✓/✗ | |

## Issues Found

1. <Issue description with file path>
2. <Issue description with file path>
...

## Recommended Fixes

1. <Specific action>
2. <Specific action>
...

## Final Score

**<1-5>**

- Machine base: <score>
- Semantic deductions: <N>
- Final: <score>
```

## Scoring reference

| Final score | Meaning | Action |
|-------------|---------|--------|
| 5 | Flawless | Deliver immediately |
| 4 | Good | Deliver (acceptable) |
| 3 | Fair | Attempt one fix cycle |
| 2 | Poor | Must fix before delivery |
| 1 | Broken | Must regenerate |

## Machine base score table

| Error count | Base score |
|-------------|-----------|
| 0 | 4 |
| 1–3 | 3 |
| 4–6 | 2 |
| 7+ | 1 |
| Validator unavailable | 3 |

## Critical errors (wipe 1 point)

Any of these drops the base score by 1:

- `style.typography.color` does not exist
- `wp-block-paragraph` on `<p>`
- Missing `has-custom-font-size` on button with `fontSize`
- Missing `has-border-color` on button with border color
- Missing `has-alpha-channel-opacity` on separator
- Raw hex in `style.color.text` without `textColor` preset
- `fontFamily` nested in `style.typography`
- Container block using self-closing syntax (`/-->`)
- Unmatched block delimiters
