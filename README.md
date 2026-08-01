# WordPress Gutenberg Designer

Draft Open Design plugin for converting a comp, screenshot, or mockup into a WordPress-native Gutenberg implementation package.

## MVP scope

This version generates:

- visual analysis,
- a WordPress implementation plan,
- `wordpress-design.json`,
- `theme.json`,
- block patterns,
- templates and template parts when requested,
- minimal scoped CSS,
- a responsive HTML preview,
- a validation and handoff report.

It does **not** generate custom React blocks. It may identify custom-block candidates in the report when core blocks, patterns, Query Loop, and block styles are not enough.

## Install locally

From a checkout or extracted folder:

```bash
od plugin validate ./wordpress-gutenberg-designer
od plugin install ./wordpress-gutenberg-designer
```

Then apply it through the Open Design UI or CLI. A representative CLI command is:

```bash
od plugin apply wordpress-gutenberg-designer \
  --input designComp=/absolute/path/to/desktop-comp.png \
  --input mobileComp=/absolute/path/to/mobile-comp.png \
  --input existingThemeJson=/absolute/path/to/theme.json \
  --input artifactType="Full page pattern" \
  --input implementationStrategy="Core blocks preferred" \
  --input namespace="client-theme" \
  --input minimumWordPressVersion="6.6" \
  --input projectNotes="The cards come from a service CPT and should use Query Loop."
```

The exact local-file syntax may vary with the Open Design build. The UI file pickers are the intended first test path.

## Suggested first test

Use one desktop landing-page comp and, ideally, one mobile comp. Choose:

- **WordPress output:** Full page pattern
- **Implementation strategy:** Core blocks preferred
- **Namespace:** a short theme or client slug
- **Existing theme.json:** include it when testing against a real project

Review the plan checkpoint before generation. Check whether the plugin correctly identifies:

- pattern boundaries,
- Query Loop content,
- existing token reuse,
- responsive stacking,
- design details that need scoped CSS,
- components that genuinely cannot be represented with core blocks.

## Validate generated output

The included dependency-free validator checks the basic handoff shape:

```bash
node scripts/validate-output.mjs /path/to/generated-output
```

It checks required files, JSON parsing, `theme.json` version, pattern headers, Gutenberg delimiter balance, and avoidable raw color values in block markup.

This is not a substitute for loading the result into WordPress. The next validation tier should use `wp-env`, `parse_blocks()`, editor console checks, and frontend screenshot comparison.

## Plugin structure

```text
wordpress-gutenberg-designer/
  SKILL.md
  open-design.json
  README.md
  assets/
  references/
  examples/
  preview/
  scripts/
  evals/
```

## Current limitations

- The plugin relies on the selected agent's vision support for comp inspection.
- A single desktop comp cannot prove mobile behavior; assumptions are recorded instead.
- It cannot discover an existing site's registered blocks unless those files or a future WordPress MCP/site profile are supplied.
- It does not guarantee exact saved markup for every core block version. Generated patterns should be verified in the target WordPress version.
- The validator is intentionally conservative and structural, not a full Gutenberg parser.

## Useful official references

- Open Design plugin spec: `https://github.com/nexu-io/open-design/blob/main/plugins/spec/SPEC.md`
- Open Design plugin schema: `https://github.com/nexu-io/open-design/blob/main/docs/schemas/open-design.plugin.v1.json`
- Gutenberg block markup: `https://developer.wordpress.org/block-editor/getting-started/fundamentals/markup-representation-block/`
- theme.json v3: `https://developer.wordpress.org/block-editor/reference-guides/theme-json-reference/theme-json-living/`
- Theme pattern registration: `https://developer.wordpress.org/themes/patterns/registering-patterns/`

## License

MIT
