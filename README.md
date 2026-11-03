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

Example values are from a real Readeck bookmark.

| Variable | Type | Example |
|---|---|---|
| `title` | text | `Interstitial journaling: combining notes, to-do and time tracking` |
| `url` | text | `https://nesslabs.com/interstitial-journaling` |
| `site` | text | `nesslabs.com` |
| `site_name` | text | `Ness Labs` |
| `description` | text | `Your mind at work` |
| `lang` | text | `en` |
| `authors` | list of text | `["Anne-Laure Le Cunff"]` |
| `labels` | list of text | `["fire", "review"]` |
| `created` | date, saved in Readeck | use `{{ created \| date("YYYY-MM-DD") }}` → `2025-12-17` |
| `published` | date, may be empty | `{{ published \| date("YYYY-MM-DD") }}` → `2020-04-15` |
| `word_count` | number | `673` |
| `reading_time` | number, minutes | `3` |
| `id` | text, Readeck bookmark id | `8fV5nHaQwi3pG7RRcZciNx` |
| `readeck_url` | text, the bookmark in Readeck | `https://readeck.example/bookmarks/8fV5nHaQwi3pG7RRcZciNx` |
| `thumbnail` | text, URL of the thumbnail image in Readeck | `https://readeck.example/bm/8f/8fV5nHaQwi3pG7RRcZciNx/img/thumbnail.png` |
| `thumbnail_path` | text, vault path of the downloaded thumbnail; empty in modes without images | `Readeck/8fV5nHaQwi3pG7RRcZciNx/imgs/thumbnail.png`, e.g. `cover: "[[{{ thumbnail_path }}]]"` |
| `content` | text, the article as Markdown | empty in Annotations mode |
| `highlights` | list, see below | loop with `{% for highlight in highlights %}` |
| `frontmatter` | text, the default frontmatter block | `---\ntitle: "…"\n…\n---` |
| `now` | date, time of the import | `{{ now \| date("YYYY-MM-DD") }}` |
| `bookmark` | object, everything Readeck sends, see below | `{{ bookmark.read_progress }}` |

**Each highlight** in `highlights`:

| Field | Type | Example |
|---|---|---|
| `text` | text, the highlighted passage | `Track time. Type /time to insert the current time…` |
| `note` | text, your own note on the highlight | empty if none |
| `color` | text | `yellow`, `red`, `blue` or `green` |
| `created` | date | `{{ highlight.created \| date("YYYY-MM-DD") }}` → `2026-01-28` |
| `id` | text | `dAUNBCc7T7A1ALnfSSxv1` |
| `readeck_url` | text, the highlight in Readeck | `https://readeck.example/bookmarks/8fV5…#annotation-dAUN…` |

**Useful fields of `bookmark`** beyond the variables above (anything Readeck adds later appears here too):

| Field | Example |
|---|---|
| `bookmark.note` | your note on the whole bookmark |
| `bookmark.resources.image.src` | the article's cover image URL, e.g. for `cover: {{ bookmark.resources.image.src }}` |
| `bookmark.is_marked`, `bookmark.is_archived` | `true` / `false` (favourite, archived) |
| `bookmark.read_progress` | `100` (percent) |
| `bookmark.updated` | date of the last change in Readeck |
| `bookmark.type`, `bookmark.document_type` | `article`, `photo` or `video` |
| `bookmark.links` | list of links in the article, each with `url`, `domain`, `title` |

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
{% if highlight.note %}
>
{{ highlight.note | blockquote }}
{% endif %}

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
