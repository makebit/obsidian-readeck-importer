import { requestUrl } from "obsidian";
import { Annotation, Bookmark, ReadeckPluginSettings } from "./interfaces";

export class ReadeckApi {
    settings: ReadeckPluginSettings;

    constructor(settings: ReadeckPluginSettings) {
        this.settings = settings;
    }

    async getBookmarks(): Promise<Bookmark[]> {
        const response = await requestUrl({
            url: `${this.settings.apiUrl}/api/bookmarks`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.settings.apiToken}`
            }
        });
        const bookmarks = await response.json;
        return bookmarks;
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

    async getBookmarkMD(bookmarkId: string): Promise<string> {
        const articleResponse = await requestUrl({
            url: `${this.settings.apiUrl}/api/bookmarks/${bookmarkId}/article.md?v=${Date.now()}`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.settings.apiToken}`
            }
        });
        const text = await articleResponse.text;
        return text;
    }

    async getBookmarkMultipart(bookmarkId: string) {
        const articleResponse = await requestUrl({
            url: `${this.settings.apiUrl}/api/bookmarks/${bookmarkId}/article.md?v=${Date.now()}`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.settings.apiToken}`,
                'Accept': 'multipart/alternative',
            }
        });
        return articleResponse;
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
