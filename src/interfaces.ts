export interface ReadeckPluginSettings {
	apiUrl: string;
	apiToken: string;
	username: string,
	folder: string;
	overwrite: boolean;
	mode: string;
}

export const DEFAULT_SETTINGS: ReadeckPluginSettings = {
	apiUrl: "",
	apiToken: "",
	username: "",
	folder: "Readeck",
	overwrite: false,
	mode: "text",
}
