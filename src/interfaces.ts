export interface ReadeckPluginSettings {
	apiUrl: string;
	apiToken: string;
	username: string,
	folder: string;
	lastSyncAt: string;
	autoSyncOnStartup: boolean;
	overwrite: boolean;
	delete: boolean;
	mode: string;
}

export interface Response<T> {
	items: T[];
}

export interface BookmarkStatus {
	id: string,
	time: Date,
	type: string,
}

export interface BookmarkData {
	id: string;
	text: string | null;
	json: Bookmark;
	images: any[];
	annotations: Annotation[];
}

export interface Bookmark {
	title: string,
}

export interface Annotation {
	id: string,
	href: string,
	text: string,
	created: Date,
	color: string,
	bookmark_id: string,
	bookmark_href: string,
	bookmark_url: string,
	bookmark_title: string,
	bookmark_site_name: string,
}

export const DEFAULT_SETTINGS: ReadeckPluginSettings = {
	apiUrl: "",
	apiToken: "",
	username: "",
	folder: "Readeck",
	lastSyncAt: "",
	autoSyncOnStartup: true,
	overwrite: false,
	delete: false,
	mode: "text",
}
