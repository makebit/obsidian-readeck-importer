# Readeck Importer Plugin

The Readeck Importer is a plugin for Obsidian that enables users to seamlessly import their saved bookmarks from [Readeck](https://readeck.org/) into their Obsidian vault. This plugin is perfect for those who want to organize and annotate their Readeck bookmarks within Obsidian's powerful note-taking environment.

## Features
- Import bookmarks directly from Readeck.
- Save imported bookmarks to a specified folder in your Obsidian vault.
- Optionally fetch full bookmarks, images and annotations from Readeck.
- Flexible import settings, including overwriting existing files.
- Automatically set properties and metadata for imported bookmarks.

## Installation

1. Download the plugin files and place them in your Obsidian plugins folder (`.obsidian/plugins/readeck-importer`).
2. Enable the plugin in the Obsidian settings under **Settings > Community Plugins**.
3. Configure the plugin settings as described below.

## Plugin Settings

The plugin provides the following configurable options:
- **API URL**: The base URL of the Readeck instance (without a trailing `/`).  
- **Folder**: The folder for saving notes.  
- **Overwrite**: If enabled, replaces an existing note with the new one. Warning: notes will be overwritten.
- **Mode**: Defines the content to be saved:  
  - **Text**: Save the text.  
  - **Text + Images**: Save text along with images.  
  - **Text + Annotations**: Save text and annotations.  
  - **Text + Images + Annotations**: Save text, images, and annotations.  
  - **Annotations**: Save the annotations.
- **Note template**: A [Nunjucks](https://mozilla.github.io/nunjucks/templating.html) template that shapes every imported note. Leave it at the default to keep the classic layout; **Reset to default** restores it. A template with a syntax error is reported in the settings and stops the sync before any note is written.

## Note template

The template uses Nunjucks (Jinja-style) syntax: `{{ variable }}`, `{% for %}`, `{% if %}` and filters like `{{ value | filter }}`.

Block tags on their own line leave no blank line behind (Nunjucks `trimBlocks` and `lstripBlocks` are on), so loops and conditions can be written one tag per line. For finer control, `{%-` and `-%}` strip the whitespace before or after a tag.

### Variables

| Variable | Description |
|---|---|
| `title`, `url`, `site`, `site_name`, `description`, `lang` | Bookmark metadata (strings) |
| `authors`, `labels` | Lists of strings |
| `created`, `published` | Dates (format with the `date` filter) |
| `word_count`, `reading_time` | Numbers (reading time in minutes) |
| `id`, `readeck_url` | Readeck bookmark id and its link in Readeck |
| `content` | The article as Markdown (empty in Annotations mode) |
| `highlights` | List of highlights, each with `text`, `color`, `created`, `id`, `readeck_url` |
| `frontmatter` | The default frontmatter block, ready to use as is |
| `now` | The import time |
| `bookmark` | The raw bookmark data from Readeck |

### Filters

| Filter | Example | Result |
|---|---|---|
| `date(format)` | `{{ published \| date("YYYY-MM-DD") }}` | Date formatted with [moment.js tokens](https://momentjs.com/docs/#/displaying/format/) |
| `blockquote` | `{{ highlight.text \| blockquote }}` | Prefixes every line with `> `, so multi-line highlights stay inside a quote or callout |
| `yaml` | `title: {{ title \| yaml }}` | A safely quoted YAML string for frontmatter |

All [built-in Nunjucks filters](https://mozilla.github.io/nunjucks/templating.html#builtin-filters) such as `join`, `default` and `length` work too.

### Example

```
---
title: {{ title | yaml }}
url: {{ url }}
published: {{ published | date("YYYY-MM-DD") }}
imported: {{ now | date("YYYY-MM-DD") }}
tags:
{% for label in labels %}
  - {{ label }}
{% endfor %}
---

# {{ title }}

## Highlights

{% for highlight in highlights %}
> [!quote] {{ highlight.created | date("YYYY-MM-DD") }} · [open in Readeck]({{ highlight.readeck_url }})
{{ highlight.text | blockquote }}

{% else %}
_No highlights yet._

{% endfor %}
## Content

{{ content }}
```

## How to Use

1. Configure the plugin settings in **Settings > Readeck Importer**.
2. Use the "Readeck Importer: Get Readeck Data" command from the command palette.
3. The plugin will fetch your bookmarks and save them in the specified folder.

## Development

If you wish to contribute to the plugin or customize it for your needs:

1. Clone the repository and run `npm install` to install dependencies.
2. Build the plugin using `npm run dev`.

## License

This project is licensed under the MIT License. See the LICENSE file for details.
