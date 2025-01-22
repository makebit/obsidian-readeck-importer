# Readeck Importer Plugin

The Readeck Importer is a plugin for Obsidian that enables users to seamlessly import their saved bookmarks from [Readeck](https://readeck.org/) into their Obsidian vault. This plugin is perfect for those who want to organize and annotate their Readeck bookmarks within Obsidian's powerful note-taking environment.

## Features
- Import bookmarks directly from Readeck.
- Save imported bookmarks to a specified folder in your Obsidian vault.
- Optionally fetch full articles and annotations from Readeck.
- Flexible import settings, including overwriting existing files.
- Automatically set properties and metadata for imported bookmarks.

## Installation

1. Download the plugin files and place them in your Obsidian plugins folder (`.obsidian/plugins/readeck-importer`).
2. Enable the plugin in the Obsidian settings under **Settings > Community Plugins**.
3. Configure the plugin settings as described below.

## Plugin Settings

The plugin provides the following configurable options:

- API URL: URL of the Readeck instance (without trailing "/").
- API Token: The Readeck API token for authentication.
- Folder: The folder where to save the notes.
- Create if no annotations: Create the note even if the article has no annotations.
- Overwrite if it already exists: Overwrite the note if the bookmark already exists. Warning: the note will be overwritten.
- Set properties: Set the properties of the note.
- Get article: Create the note with the text of the article.
- Get annotations: Create the note with the annotations of the article.

## How to Use

1. Configure the plugin settings in **Settings > Readeck Importer**.
2. Use the "Import from Readeck" command from the command palette.
3. The plugin will fetch your bookmarks and save them in the specified folder.

## Development

If you wish to contribute to the plugin or customize it for your needs:

1. Clone the repository and run `npm install` to install dependencies.
2. Build the plugin using `npm run dev`.

## License

This project is licensed under the MIT License. See the LICENSE file for details.