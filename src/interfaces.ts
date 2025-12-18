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
	metadataFields: string[];
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

// Bookmark detail interface, corresponds to the data returned by /api/bookmarks/{id}
export interface BookmarkDetail {
	id: string;
	href: string;
	created: string;
	updated: string;
	state: number;
	loaded: boolean;
	url: string;
	title: string;
	site_name: string;
	site: string;
	authors: string[];
	lang: string;
	text_direction: string;
	document_type: string;
	type: string;
	has_article: boolean;
	description: string;
	omit_description: boolean;
	is_deleted: boolean;
	is_marked: boolean;
	is_archived: boolean;
	labels: string[];
	read_progress: number;
	resources: {
		article?: { src: string };
		icon?: { src: string; width: number; height: number };
		image?: { src: string; width: number; height: number };
		log?: { src: string };
		props?: { src: string };
		thumbnail?: { src: string; width: number; height: number };
	};
	links?: {
		url: string;
		domain: string;
		title: string;
		is_page: boolean;
		content_type: string;
	}[];
	word_count: number;
	reading_time: number;
}

// Available metadata field definitions
export const METADATA_FIELDS = [
	{ key: 'title', label: 'Title' },
	{ key: 'url', label: 'Original URL' },
	{ key: 'site_name', label: 'Site Name' },
	{ key: 'authors', label: 'Authors' },
	{ key: 'description', label: 'Description' },
	{ key: 'labels', label: 'Labels' },
	{ key: 'created', label: 'Created Time' },
	{ key: 'updated', label: 'Updated Time' },
	{ key: 'word_count', label: 'Word Count' },
	{ key: 'reading_time', label: 'Reading Time' },
	{ key: 'cover', label: 'Cover Image' },
	{ key: 'read_progress', label: 'Read Progress' },
	{ key: 'is_deleted', label: 'Is Deleted' },
	{ key: 'is_marked', label: 'Is Marked' },
	{ key: 'is_archived', label: 'Is Archived' },
	{ key: 'links', label: 'Links' },
] as const;

export type MetadataFieldKey = typeof METADATA_FIELDS[number]['key'];

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
	metadataFields: ['title', 'url', 'labels', 'cover'],
}
