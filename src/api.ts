import { requestUrl } from "obsidian";
import { Annotation, Response, ReadeckPluginSettings, BookmarkStatus, BookmarkDetail } from "./interfaces";

export class ReadeckApi {
    settings: ReadeckPluginSettings;

    constructor(settings: ReadeckPluginSettings) {
        this.settings = settings;
    }

    async getBookmarksStatus(
        lastSyncAt: string = ''
    ): Promise<Response<BookmarkStatus>> {
        const params = new URLSearchParams({
            ...(lastSyncAt && { since: lastSyncAt })
        });

        const response = await requestUrl({
            url: `${this.settings.apiUrl}/api/bookmarks/sync?${params.toString()}`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.settings.apiToken}`
            }
        });

        return {
			items: await response.json
		};
    }

    async getBookmarks(
        ids: string[] = [],
        markdown: boolean = false,
        resources: boolean = false,
        json: boolean = false,
    ) {
        const articleResponse = await requestUrl({
            url: `${this.settings.apiUrl}/api/bookmarks/sync`,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.settings.apiToken}`,
                'Accept': 'multipart/mixed',
                'Content-type': 'application/json',
            },
            body: JSON.stringify({
                "id": ids,
                "with_json": json,
                "with_html": false,
                "with_markdown": markdown,
                "with_resources": resources,
                "resource_prefix": "./imgs"
            }),
        });
        return articleResponse;
    }

    async getBookmarkAnnotations(bookmarkId: string): Promise<Annotation[]> {
        const annotationResponse = await requestUrl({
            url: `${this.settings.apiUrl}/api/bookmarks/${bookmarkId}/annotations`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.settings.apiToken}`
            }
        });
        const annotations = await annotationResponse.json;
        return annotations;
    }

    async getBookmarkDetail(bookmarkId: string): Promise<BookmarkDetail> {
        const response = await requestUrl({
            url: `${this.settings.apiUrl}/api/bookmarks/${bookmarkId}`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.settings.apiToken}`
            }
        });
        return response.json;
    }

    async getToken(username: string, password: string): Promise<string> {
        const tokenResponse = await requestUrl({
            url: `${this.settings.apiUrl}/api/auth`,
            method: 'POST',
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                username: username,
                password: password,
                application: "obsidian-readeck-importer",
                roles: ["scoped_bookmarks_r"],
            }),
        });
        const token: string = await tokenResponse.json.token;
        return token;
    }
}
