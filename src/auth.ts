import { Notice } from "obsidian";
import { DeviceAuthorization, ReadeckPluginSettings } from "./interfaces";
import { ReadeckApi } from "./api";

type AuthServiceDeps = {
	api: ReadeckApi;
	getSettings: () => ReadeckPluginSettings;
	saveSettings: () => Promise<void>;
};

type DeviceModalHandle = {
	close: () => void;
};

type DeviceModalFactory = (device: DeviceAuthorization, onCancel: () => void) => DeviceModalHandle;

export class AuthService {
	private api: ReadeckApi;
	private getSettings: () => ReadeckPluginSettings;
	private saveSettings: () => Promise<void>;

	constructor({ api, getSettings, saveSettings }: AuthServiceDeps) {
		this.api = api;
		this.getSettings = getSettings;
		this.saveSettings = saveSettings;
	}

	private get settings() {
		return this.getSettings();
	}



	async handleOAuth(clientName: string, openDeviceModal: DeviceModalFactory): Promise<boolean> {
		const oauthClient = await this.api.createoAuthClient(clientName);
		const deviceAuth = await this.api.authorizeDevice(oauthClient.client_id);
		let cancelled = false;
		const deviceModal = openDeviceModal(deviceAuth, () => {
			cancelled = true;
		});
		const accessTokenResp = await this.api.pollDeviceToken(
			oauthClient.client_id,
			deviceAuth.device_code,
			deviceAuth.interval,
			deviceAuth.expires_in
		);
		if (cancelled) {
			return false;
		}

		this.settings.apiToken = accessTokenResp.access_token;
		await this.saveSettings();

		deviceModal.close();
		return true;
	}

	async handleLogin(username: string, password: string): Promise<boolean> {
		try {
			const token = await this.api.getToken(username, password);
			this.settings.apiToken = token;
			this.settings.username = username;
			await this.saveSettings();
			return true;
		} catch (error) {
			console.log("Login error", error);
			new Notice("Login error, check your credentials");
			return false;
		}
	}

	async logout() {
		// clear oauth token
		await this.api.revokeOAuthToken(this.settings.apiToken);
		this.settings.apiToken = "";
		this.settings.username = "";
		await this.saveSettings();
	}
}
