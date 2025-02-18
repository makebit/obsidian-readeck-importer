import { requestUrl } from "obsidian";
import { ReadeckPluginSettings } from "./interfaces";

export class ReadeckApi {
    settings: ReadeckPluginSettings;

    constructor(settings: ReadeckPluginSettings) {
        this.settings = settings;
    }

    async getBookmarks() {
        try {
            const response = await requestUrl({
                url: `${this.settings.apiUrl}/api/bookmarks`,
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.settings.apiToken}`
                }
            });
            const bookmarks = await response.json;
            return bookmarks;
        } catch (error) {
            console.log("Readeck Importer: error", error);
            return null;
        }
    }

    async getBookmarkAnnotations(bookmarkId: string) {
        try {
            const annotationResponse = await requestUrl({
                url: `${this.settings.apiUrl}/api/bookmarks/${bookmarkId}/annotations`,
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.settings.apiToken}`
                }
            });
            const annotations = await annotationResponse.json;
            return annotations;
        } catch (error) {
            console.log("Readeck Importer: error", error);
            return null;
        }

    }

    async getBookmarkMD(bookmarkId: string) {
        try {
            const articleResponse = await requestUrl({
                url: `${this.settings.apiUrl}/api/bookmarks/${bookmarkId}/article.md?v=${Date.now()}`,
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.settings.apiToken}`
                }
            });
            const text = await articleResponse.text;
            return text;
        } catch (error) {
            console.log("Readeck Importer: error", error);
            return null;
        }
    }

    async getBookmarkMultipart(bookmarkId: string) {
        try {
            const articleResponse = await requestUrl({
                url: `${this.settings.apiUrl}/api/bookmarks/${bookmarkId}/article.md?v=${Date.now()}`,
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.settings.apiToken}`,
                    'Accept': 'multipart/alternative',
                }
            });
            return articleResponse;
        } catch (error) {
            console.log("Readeck Importer: error", error, "bookmarkId:", bookmarkId);
            return null;
        }
    }

    async getToken(username: string, password: string) {
        try {
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
        } catch (error) {
            console.log("Readeck login: error", error);
            return null;
        }
    }
}
