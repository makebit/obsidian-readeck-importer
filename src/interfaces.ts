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
	mode: "textImagesNotes",
}

export interface PartData {
  bookmarkId: string,
  contentDisposition: {
	base?: string,
	filename?: string,
  },
  contentType: {
	base?: string,
	charset?: string,
  },
  body?: any;
}
