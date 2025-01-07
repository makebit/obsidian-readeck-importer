export interface ReadeckPluginSettings {
	apiUrl: string;
	apiToken: string;
	folder: string;
	createNoteIfNoAnnotations: boolean;
	setProperties: boolean;
	getArticle: boolean;
	getAnnotations: boolean;
	overwriteIfExists: boolean;
}

export const DEFAULT_SETTINGS: ReadeckPluginSettings = {
	apiUrl: "https://readeck-url",
	apiToken: "",
	folder: "Readeck",
	createNoteIfNoAnnotations: true,
	overwriteIfExists: false,
	setProperties: true,
	getArticle: true,
	getAnnotations: true,
}
