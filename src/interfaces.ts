export interface ReadeckPluginSettings {
	apiUrl: string;
	apiToken: string;
	username: string,
	folder: string;
	overwrite: boolean;
	mode: string;
}

export interface Bookmark {
	id: string,
	href: string,
	created: string,
	updated: string,
	state: number,
	loaded: boolean,
	url: string,
	title: string,
	site_name: string,
	site: string,
	authors: string[],
	lang: string,
	text_direction: string,
	document_type: string,
	type: string,
	has_article: boolean,
	description: string,
	is_deleted: boolean,
	is_marked: boolean,
	is_archived: boolean,
	labels: string[],
	read_progress: number,
	resources: any,
	word_count: number,
	reading_time: number,
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
	overwrite: false,
	mode: "text",
}
