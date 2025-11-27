import { requestUrl } from "obsidian";
import { Annotation, Response, ReadeckPluginSettings, BookmarkStatus, DeviceCodeStart } from "./interfaces";

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

    // Start OAuth Device Code Flow
    async startDeviceCodeFlow(): Promise<DeviceCodeStart> {
        const response = await requestUrl({
            url: `${this.settings.apiUrl}/api/oauth/device`,
            method: 'POST',
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                client_id: "obsidian-readeck-importer",
                scope: "scoped_bookmarks_r",
            }),
        });

        // If endpoint is not available or returns error, surface it to caller for fallback
        // Obsidian's requestUrl returns ok even for non-2xx; check status
        // @ts-ignore - status is available on requestUrl response
        const status: number = (response as any).status ?? 200;
        if (status < 200 || status >= 300) {
            throw new Error(`OAuth device start failed with status ${status}`);
        }

        const data = await response.json as any;
        return data as DeviceCodeStart;
    }

    // Poll OAuth token endpoint until user authorizes or error/expiry
    async pollDeviceToken(device_code: string, intervalSec: number = 5): Promise<string> {
        const grant_type = "urn:ietf:params:oauth:grant-type:device_code";
        let delay = Math.max(1, intervalSec);
        const startTime = Date.now();
        const maxDurationMs = 10 * 60 * 1000; // safety cap: 10 minutes

        while (true) {
            const tokenResp = await requestUrl({
                url: `${this.settings.apiUrl}/api/oauth/token`,
                method: 'POST',
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    grant_type,
                    device_code,
                    client_id: "obsidian-readeck-importer",
                }),
            });

            // @ts-ignore
            const status: number = (tokenResp as any).status ?? 200;
            const body = await tokenResp.json as any;

            if (status >= 200 && status < 300 && body?.access_token) {
                return body.access_token as string;
            }

            const err = body?.error || body?.error_description || '';
            if (err === 'authorization_pending') {
                // keep polling
            } else if (err === 'slow_down') {
                delay += 5; // back off
            } else if (err === 'expired_token' || err === 'access_denied' || status === 400 || status === 401 || status === 403) {
                throw new Error(`OAuth device flow failed: ${err || 'unauthorized'}`);
            }

            if (Date.now() - startTime > maxDurationMs) {
                throw new Error('OAuth device flow timed out');
            }

            await new Promise((resolve) => setTimeout(resolve, delay * 1000));
        }
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
