# Gutenberg markup rules

WordPress stores blocks using HTML comment delimiters.

## Core block form

```html
<!-- wp:group {"layout":{"type":"constrained"}} -->
<div class="wp-block-group">
  <!-- wp:heading -->
  <h2 class="wp-block-heading">Heading</h2>
  <!-- /wp:heading -->
</div>
<!-- /wp:group -->
```

Core blocks omit the `core/` namespace in serialized comments. Custom blocks include their namespace.

## Dynamic block form

Dynamic blocks may be self-closing:

```html
<!-- wp:latest-posts {"postsToShow":4} /-->
```

## Rules

- Attributes are JSON inside the opening comment.
- Use double quotes in JSON.
- Preserve opening and closing delimiter order.
- Use self-closing syntax only for blocks whose saved representation permits it.
- Match generated HTML classes and structure expected by the selected WordPress version.
- Do not invent core block attributes.
- Avoid manually serialized markup when the correct shape is uncertain; document the uncertainty and verify in WordPress.

## Pattern headers

Theme pattern files use a PHP comment header followed by block markup:

```php
<?php
/**
 * Title: Service hero
 * Slug: namespace/service-hero
 * Categories: featured, call-to-action
 * Viewport Width: 1440
 */
?>
<!-- wp:group -->
...
<!-- /wp:group -->
```

Use a unique namespaced slug. Include only metadata justified by the pattern.
