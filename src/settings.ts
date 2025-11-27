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

		new Setting(containerEl)
			.setName('API URL')
			.setDesc('URL of Readeck instance (without trailing "/"). E.g. https://readeck.domain.tld')
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
			.setDesc('Login via OAuth. Attempts deprecated username/password login if oAuth fails')
			.addButton((btn) => {
				loginButton = btn;
				btn
					.setButtonText(loggedIn ? `Registered "${client_name}" application` : 'Login')
					.setDisabled(loggedIn)
					.setCta()
					.onClick(async () => {
						loginButton.setDisabled(true);
						let cancelled = false;
						try {
							// Attempt OAuth device flow, fallback to password login if not supported
							// Step 1: Start oAuth device authorization
							const oauthClient = await this.plugin.api.createoAuthClient(client_name);
							
							// Step 2: Show modal with user code and verification URL
            				const deviceAuth = await this.plugin.api.authorizeDevice(oauthClient.client_id);
							const deviceCodeModal = new DeviceCodeModal(this.app, deviceAuth, () => { cancelled = true; });
							deviceCodeModal.open();

							// Step 3: Poll for token
							const acessTokenResp = await this.plugin.api.pollDeviceToken(oauthClient.client_id, deviceAuth.device_code, deviceAuth.interval, deviceAuth.expires_in);
							if (cancelled) {
								loginButton.setDisabled(false);
								return;
							}

							// update values
							this.plugin.settings.apiToken = acessTokenResp.access_token;
							await this.plugin.saveSettings();

							// update ui
							loginButton.setButtonText(`Registered "${client_name}" application`);
							loginButton.setDisabled(true);
							logoutButton.setDisabled(false);
							deviceCodeModal.close();
						} catch (err) {
							new Notice('OAuth device flow not available or failed, attempting password login');
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
									}).finally(() => {
										loginButton.setDisabled(this.plugin.settings.apiToken !== "");
									});
							}).open();
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
