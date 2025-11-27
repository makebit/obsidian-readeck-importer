
export interface ReadeckPluginSettings {
	apiUrl: string;
	apiToken: string;
	username: string,
	folder: string;
	lastSyncAt: string;
	overwrite: boolean;
	delete: boolean;
	mode: string;
}

export type oAuthClient = {
    client_id: string;
    client_name: string;
    client_uri: string;
    logo_uri: string;
    redirect_uris: string[]; 
    software_id: string;
    software_version: string;
    token_endpoint_auth_method?: string;
    grant_types: string[]; 
    response_types: string[]; 
}

export interface DeviceAuthorization {
    device_code: string;
    user_code: string;
    verification_uri: string;
    verification_uri_complete: string;
    expires_in: number;
    interval: number;
}

export interface AccessToken {
	id: string
	access_token: string
	token_type: string // "Bearer"
	scope: string
}

export type oAuthErrorEnum =
	| "access_denied"
	| "authorization_pending"
	| "expired_token"
	| "invalid_client"
	| "invalid_client_metadata"
	| "invalid_grant"
	| "invalid_redirect_uri"
	| "invalid_request"
	| "invalid_scope"
	| "server_error"
	| "slow_down"
	| "unauthorized_client";

export interface oAuthError {
	error: oAuthErrorEnum;
	error_description: string;
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
	overwrite: false,
	delete: false,
	mode: "text",
}
