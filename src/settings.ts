import { App, ButtonComponent, Modal, Notice, PluginSettingTab, Setting, TextComponent } from "obsidian";

import ReadeckPlugin from "./plugin";
import { METADATA_FIELDS } from "./interfaces";

export class RDSettingTab extends PluginSettingTab {
	plugin: ReadeckPlugin;

	constructor(app: App, plugin: ReadeckPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		const loggedIn = this.plugin.settings.apiToken !== "";

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

		let loginButton: ButtonComponent;
		let logoutButton: ButtonComponent;
		new Setting(containerEl)
			.setName('Login')
			.setDesc('Login and get a token')
			.addButton((btn) => {
				loginButton = btn;
				btn
					.setButtonText(loggedIn ? `Logged in as ${this.plugin.settings.username}` : 'Login')
					.setDisabled(loggedIn)
					.setCta()
					.onClick(async () => {
						// Do login
						new LoginModal(this.app, (username, password) => {
							this.plugin.api.getToken(username, password)
								.then(async (token) => {
									// update values
									this.plugin.settings.apiToken = token;
									this.plugin.settings.username = username;
									await this.plugin.saveSettings();
									// update ui
									loginButton.setButtonText(`Logged in as ${this.plugin.settings.username}`);
									loginButton.setDisabled(true);
									logoutButton.setDisabled(false);
								}).catch((error) => {
									console.log("Login error", error);
									new Notice('Login error, check your credentials');
								});
						}).open();

					})
			}
			)
			.addButton((btn) => {
				logoutButton = btn;
				btn
					.setButtonText('Logout')
					.setDisabled(!loggedIn)
					.onClick(async () => {
						// Do logout
						// update values
						this.plugin.settings.apiToken = "";
						this.plugin.settings.username = "";
						await this.plugin.saveSettings();
						// update ui
						loginButton.setButtonText('Login');
						loginButton.setDisabled(false);
						logoutButton.setDisabled(true);
					})
			});

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

		let lastSyncText: TextComponent;
		let lastSyncButton: ButtonComponent;
		new Setting(containerEl)
			.setName('Last Sync')
			.setDesc('Last time the plugin synced with Readeck. The "Sync" command fetches articles updated after this timestamp')
			.addText((text) => {
				lastSyncText = text;
				text.setPlaceholder('MM/dd/yyyy, h:mm:ss a')
					.setValue(this.plugin.settings.lastSyncAt)
					.setDisabled(true);
			})
			.addButton((btn) => {
				lastSyncButton = btn;
				btn.setButtonText('Reset')
					.setTooltip('Reset the last sync timestamp')
					.onClick(async () => {
						this.plugin.settings.lastSyncAt = '';
						await this.plugin.saveSettings();

						new Notice('Last sync reset');
						lastSyncText.setValue('');
						lastSyncButton.setButtonText('Reset').setDisabled(true);
					});
			});

		new Setting(containerEl)
			.setName('Sync on startup')
			.setDesc('Sync bookmarks automatically when Obsidian starts')
			.addToggle(toggle => toggle.setValue(this.plugin.settings.autoSyncOnStartup)
				.onChange(async (value) => {
					this.plugin.settings.autoSyncOnStartup = value;
					await this.plugin.saveData(this.plugin.settings);
				}));

		new Setting(containerEl)
			.setName('Overwrite if it already exists')
			.setDesc('Overwrite the note if the bookmark already exists. Warning: the note will be overwritten')
			.addToggle(toggle => toggle.setValue(this.plugin.settings.overwrite)
				.onChange(async (value) => {
					this.plugin.settings.overwrite = value;
					await this.plugin.saveData(this.plugin.settings);
				}));
		
		new Setting(containerEl)
			.setName('Delete')
			.setDesc('Delete the note if the bookmark was deleted')
			.addToggle(toggle => toggle.setValue(this.plugin.settings.delete)
				.onChange(async (value) => {
					this.plugin.settings.delete = value;
					await this.plugin.saveData(this.plugin.settings);
				}));

		new Setting(containerEl)
			.setName('Set mode')
			.setDesc('Set how the note is created')
			.addDropdown((dropdown) => {
				dropdown
					.addOptions({
						textImagesAnnotations: 'Text + Images + Annotations',
						textImages: 'Text + Images',
						textAnnotations: 'Text + Annotations',
						text: 'Text',
						annotations: 'Annotations',
					})
					.setValue(this.plugin.settings.mode)
					.onChange(async (value) => {
						this.plugin.settings.mode = value;
						await this.plugin.saveData(this.plugin.settings);
					})
			});

		// Metadata fields multi-select configuration
		containerEl.createEl('h3', { text: 'Metadata Sync Settings' });

		new Setting(containerEl)
			.setName('Metadata fields')
			.setDesc('Select which metadata fields to sync to the frontmatter of existing bookmarks');

		// Create multi-select field list
		const metadataFieldsContainer = containerEl.createDiv({ cls: 'metadata-fields-container' });
		
		for (const field of METADATA_FIELDS) {
			new Setting(metadataFieldsContainer)
				.setName(field.label)
				.setDesc(field.key)
				.addToggle(toggle => {
					toggle
						.setValue(this.plugin.settings.metadataFields.includes(field.key))
						.onChange(async (value) => {
							if (value) {
								// Add field
								if (!this.plugin.settings.metadataFields.includes(field.key)) {
									this.plugin.settings.metadataFields.push(field.key);
								}
							} else {
								// Remove field
								this.plugin.settings.metadataFields = this.plugin.settings.metadataFields.filter(
									f => f !== field.key
								);
							}
							await this.plugin.saveSettings();
						});
				});
		}
	}
}

class LoginModal extends Modal {
	constructor(app: App, onSubmit: (username: string, password: string) => void) {
		super(app);

		this.contentEl.addClass("mod-form");
		this.modalEl.addClass("w-auto");
		this.setTitle('Login');

		let username = '';
		let password = '';

		new Setting(this.contentEl)
			.setName('Username')
			.setClass('form-field')
			.setClass('b-0')
			.setClass('align-start')
			.addText((text) =>
				text.onChange((value) => {
					username = value;
				}));

		new Setting(this.contentEl)
			.setName('Password')
			.setClass('form-field')
			.setClass('b-0')
			.setClass('align-start')
			.addText((text) => {
				text.inputEl.type = 'password';
				text.onChange((value) => {
					password = value;
				})
			});

		new Setting(this.contentEl)
			.setClass('b-0')
			.addButton((btn) => btn
				.setButtonText('Submit')
				.setCta()
				.onClick(() => {
					this.close();
					onSubmit(username, password);
				}));
	}
}
