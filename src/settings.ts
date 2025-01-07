import { App, PluginSettingTab, Setting } from "obsidian";

import ReadeckPlugin from "./plugin";

export class RDSettingTab extends PluginSettingTab {
	plugin: ReadeckPlugin;

	constructor(app: App, plugin: ReadeckPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		containerEl.createEl('h2', { text: 'Readeck Integration Settings' });

		new Setting(containerEl)
			.setName('API URL')
			.setDesc('URL of Readeck instance (without trailing "/")')
			.addText(text => text
				.setPlaceholder('Enter your API URL')
				.setValue(this.plugin.settings.apiUrl)
				.onChange(async (value) => {
					this.plugin.settings.apiUrl = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('API Token')
			.setDesc('The Readeck API token')
			.addText(text => text
				.setPlaceholder('Enter your API token')
				.setValue(this.plugin.settings.apiToken)
				.onChange(async (value) => {
					this.plugin.settings.apiToken = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Folder')
			.setDesc('The folder where to save the notes')
			.addText(text => text
				.setPlaceholder('Readeck')
				.setValue(this.plugin.settings.folder)
				.onChange(async (value) => {
					this.plugin.settings.folder = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Create if no annotations')
			.setDesc('Create the note even if the article has no annotations')
			.addToggle(toggle => toggle.setValue(this.plugin.settings.createNoteIfNoAnnotations)
				.onChange((value) => {
					this.plugin.settings.createNoteIfNoAnnotations = value;
					this.plugin.saveData(this.plugin.settings);
				}));

		new Setting(containerEl)
			.setName('Overwrite if it already exists')
			.setDesc('Overwrite the note if the bookmark already exists. Warning: the note will be overwritten')
			.addToggle(toggle => toggle.setValue(this.plugin.settings.overwriteIfExists)
				.onChange((value) => {
					this.plugin.settings.overwriteIfExists = value;
					this.plugin.saveData(this.plugin.settings);
				}));

		new Setting(containerEl)
			.setName('Set properties')
			.setDesc('Set the properties of the note')
			.addToggle(toggle => toggle.setValue(this.plugin.settings.setProperties)
				.onChange((value) => {
					this.plugin.settings.setProperties = value;
					this.plugin.saveData(this.plugin.settings);
				}));

		new Setting(containerEl)
			.setName('Get article')
			.setDesc('Create the note with the text of the article')
			.addToggle(toggle => toggle.setValue(this.plugin.settings.getArticle)
				.onChange((value) => {
					this.plugin.settings.getArticle = value;
					this.plugin.saveData(this.plugin.settings);
				}));

		new Setting(containerEl)
			.setName('Get annotations')
			.setDesc('Create the note with the annotations of the article')
			.addToggle(toggle => toggle.setValue(this.plugin.settings.getAnnotations)
				.onChange((value) => {
					this.plugin.settings.getAnnotations = value;
					this.plugin.saveData(this.plugin.settings);
				}));
	}
}
