import { App, ButtonComponent, Modal, Notice, PluginSettingTab, Setting, TextComponent } from "obsidian";

import ReadeckPlugin from "./plugin";

export class RDSettingTab extends PluginSettingTab {
	plugin: ReadeckPlugin;

	constructor(app: App, plugin: ReadeckPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		const client_name = "Obsidian Readeck Importer";


		containerEl.empty();

		const loggedIn = this.plugin.settings.apiToken !== "";
		let loginMode: "oauth" | "password" = "oauth";

		new Setting(containerEl)
			.setName('API URL')
			.setDesc('URL of Readeck instance (without trailing "/").')
			.addText(text => text
				.setPlaceholder('https://readeck.domain.tld')
				.setValue(this.plugin.settings.apiUrl)
				.onChange(async (value) => {
					this.plugin.settings.apiUrl = value;
					await this.plugin.saveSettings();
				}));

		let loginButton: ButtonComponent;
		let logoutButton: ButtonComponent;

		new Setting(containerEl)
			.setName('Login')
			.setDesc('Login to your Readeck account')
			.addButton((btn) => {
				loginButton = btn;
				btn
					.setButtonText(loggedIn ? `Authenticated` : 'Login')
					.setDisabled(loggedIn)
					.setCta()
					.onClick(async () => {
						// See if readeck instance can get reached
						try {
							const info = await this.plugin.api.getInfo();
							if (info.features.includes("oauth")) {
								loginMode = "oauth";
							} else {
								loginMode = "password";
								new Notice("Readeck Importer: OAuth not supported on this Readeck instance. Consider upgrading your Readeck instance as password login will be removed soon.");
							}
						} catch (err) {
							console.log("Error connecting to Readeck instance", err);
							new Notice('Readeck Importer: error connecting to Readeck instance: ' + err.message);
							loginButton.setDisabled(false);
							return;
						}
						// Login via password if oauth not supported. TODO: Remove this in summer 2026
						if (loginMode === "password") {
							try {
								new LoginModal(this.app, async (username, password) => {
									const success = await this.plugin.auth.handleLogin(username, password);
									if (success) {
										loginButton.setButtonText(`Logged in as ${this.plugin.settings.username}`);
										loginButton.setDisabled(true);
										logoutButton.setDisabled(false);
									}
									loginButton.setDisabled(this.plugin.settings.apiToken !== "");
								}).open();
								return;
							} catch (err) {
								new Notice('Readeck Importer: Login error: ' + err.message);
								loginButton.setDisabled(false);
								return;
							}
						}
						// OAuth login
						if (loginMode !== "oauth") {
							loginButton.setDisabled(false);
							return;
						}
						try {
							const authenticated = await this.plugin.auth.handleOAuth(
								client_name,
								(deviceAuth, onCancel) => {
									const deviceCodeModal = new DeviceCodeModal(this.app, deviceAuth, onCancel);
									deviceCodeModal.open();
									return { close: () => deviceCodeModal.close() };
								}
							);
							if (!authenticated) {
								return;
							}

							loginButton.setButtonText(`Authenticated`);
							loginButton.setDisabled(true);
							logoutButton.setDisabled(false);
						} catch (err) {
							new Notice('Readeck Importer: OAuth login error: ' + err.message);
						} finally {
							if (this.plugin.settings.apiToken === "") {
								loginButton.setDisabled(false);
							}
						}
					})

			}
			)
			.addButton((btn) => {
				logoutButton = btn;
				btn
					.setButtonText('Logout')
					.setDisabled(!loggedIn)
					.onClick(async () => {
						// update ui
						loginButton.setButtonText('Login');
						loginButton.setDisabled(false);
						logoutButton.setDisabled(true);
						await this.plugin.auth.logout();
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

class DeviceCodeModal extends Modal {
    private onCancel: () => void;
    private device: { user_code: string; verification_uri: string; verification_uri_complete?: string };

    constructor(app: App, device: { user_code: string; verification_uri: string; verification_uri_complete?: string }, onCancel: () => void) {
        super(app);
        this.onCancel = onCancel;
        this.device = device;

        this.contentEl.addClass("mod-form");
        this.modalEl.addClass("w-auto");
        this.setTitle('Authorize Readeck');

        const instructions = this.contentEl.createDiv();
        instructions.createEl('p', { text: '1) Open the verification URL in your browser.' });
        const link = instructions.createEl('a', { text: this.device.verification_uri, href: this.device.verification_uri });
        link.setAttr('target', '_blank');

        instructions.createEl('p', { text: '2) Enter this code to authorize:' });
        const codeEl = instructions.createEl('div');
        codeEl.setText(this.device.user_code);
        codeEl.addClass('device-code');

        const actions = new Setting(this.contentEl)
            .addButton(btn => btn
                .setButtonText('Copy Code')
                .onClick(() => navigator.clipboard?.writeText(this.device.user_code)))
            .addButton(btn => btn
                .setButtonText('Open Link')
                .setCta()
                .onClick(() => window.open(this.device.verification_uri_complete || this.device.verification_uri, '_blank')))
            .addButton(btn => btn
                .setButtonText('Cancel')
                .onClick(() => {
                    this.onCancel();
                    this.close();
                }));
    }
}
