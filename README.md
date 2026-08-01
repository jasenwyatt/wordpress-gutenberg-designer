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

It checks required files, JSON parsing, `theme.json` version, pattern headers, Gutenberg delimiter balance, avoidable raw color values in block markup, preset cross-references, version-gated attributes, and common `save()` mismatch patterns (duplicate preset class + inline style).

**This is structural validation only.** It catches many errors but cannot verify that Gutenberg's `save()` function will accept the markup. The next tier must load the result into WordPress.

### Next validation tier: WordPress environment

For production handoffs, verify patterns in a real WordPress instance:

1. **Using `wp-env` (recommended for CI):**
   ```bash
   cd /path/to/generated-output/wordpress
   npx wp-env start
   npx wp-env run tests-cli wp eval 'parse_blocks(file_get_contents("patterns/service-hero.php"));'
   ```

2. **Using a staging site:**
   - Activate the generated theme.
   - Insert each pattern via the block inserter.
   - Check for "unexpected or invalid content" warnings.
   - Verify frontend rendering matches the comp.

3. **Using `parse_blocks()` programmatically:**
   ```php
   $markup = file_get_contents( 'patterns/service-hero.php' );
   // Strip PHP header
   $blocks = parse_blocks( preg_replace('/<\?php[^]*?\?>/', '', $markup) );
   foreach ( $blocks as $block ) {
     if ( is_array( $block ) && ! empty( $block['blockName'] ) ) {
       $block_type = WP_Block_Type_Registry::get_instance()->get_registered( $block['blockName'] );
       if ( ! $block_type ) {
         // Unregistered block — will break in editor
       }
     }
   }
   ```

4. **Editor console checks:**
   - Open browser DevTools on the block editor.
   - Watch for `blocks` validation errors in the console.
   - Look for `wp.blocks.*` warnings about unsupported attributes.

5. **Frontend screenshot comparison:**
   - Use Playwright or similar to capture the rendered frontend.
   - Compare against the source comp with visual diffing.

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
