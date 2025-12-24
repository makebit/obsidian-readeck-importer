import { Notice, Plugin } from "obsidian";
import { DEFAULT_SETTINGS, ReadeckPluginSettings } from "./interfaces";
import { RDSettingTab } from "./settings";
import { ReadeckApi } from "./api"
import { BookmarksService } from "./bookmarks";
import { AuthService } from "./auth";


export default class RDPlugin extends Plugin {
	settings: ReadeckPluginSettings;
	api: ReadeckApi;
	bookmarks: BookmarksService;
	auth: AuthService;

	async onload() {
		console.log('Readeck Importer: Loading plugin v' + this.manifest.version);

		await this.loadSettings();

		this.api = new ReadeckApi(this.settings);
		this.bookmarks = new BookmarksService({
			app: this.app,
			api: this.api,
			getSettings: () => this.settings,
			saveSettings: () => this.saveSettings(),
		});
		this.auth = new AuthService({
			api: this.api,
			getSettings: () => this.settings,
			saveSettings: () => this.saveSettings(),
		});

		this.addSettingTab(new RDSettingTab(this.app, this));

		this.addCommand({
			id: 'get-readeck-data',
			name: 'Get readeck data',
			callback: () => this.bookmarks.getReadeckData(),
		});

		this.addCommand({
			id: 'resync',
			name: 'Resync all bookmarks',
			callback: async () => {
				this.settings.lastSyncAt = ''
				await this.saveSettings()
				new Notice('Readeck Last Sync reset')
				await this.bookmarks.getReadeckData()
			},
		  })

		// Auto sync on startup if configured
		this.app.workspace.onLayoutReady(async () => {
			if (this.settings.apiToken === "") {
				return; // Not logged in

			}
			if (this.settings.autoSyncOnStartup === false) {
				return;
			}
			await this.bookmarks.getReadeckData();
		})
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
