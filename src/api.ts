import { requestUrl } from "obsidian";
import { Annotation, Response, ReadeckPluginSettings, BookmarkStatus, oAuthClient, DeviceAuthorization, AccessToken, oAuthError, oAuthErrorEnum, InfoObject } from "./interfaces";
import manifest from "../manifest.json";

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

    async getInfo(): Promise<InfoObject> {
        const response = await requestUrl({
            url: `${this.settings.apiUrl}/api/info`,
            method: 'GET',
            headers: {
                'Accept': "application/json",
            }
        });
        if (response.status !== 200) {
            throw new Error(`Failed to get Readeck info: ${response}`);
        }
        
        // backwards compatibility for older readeck versions without /info endpoint
        try {
            JSON.parse(response.text);
        }
        catch (e) {
            return {} as InfoObject; // return empty object if no json for older readeck versions
        }
       
        return response.json as InfoObject;
    }

    async createoAuthClient(client_name: string): Promise<oAuthClient> {
        try {
            const response = await requestUrl({
                url: `${this.settings.apiUrl}/api/oauth/client`,
                method: 'POST',
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    client_name,
                    client_uri: "https://github.com/makebit/obsidian-readeck-importer",
                    software_id: 'obsidian-readeck-importer-' + manifest.version,
                    software_version: manifest.version,
                    grant_types: ["urn:ietf:params:oauth:grant-type:device_code"],
                })
            })
            return response.json as oAuthClient;
        } catch (e) {
            throw new Error(`Creating OAuth client failed: ${e.message}`);
        }
    };

    // Request OAuth Device Code
    async authorizeDevice(client_id: string): Promise<DeviceAuthorization> {
        const response = await requestUrl({
            url: `${this.settings.apiUrl}/api/oauth/device`,
            method: 'POST',
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                client_id: client_id,
                scope: "bookmarks:read", 
            }),
        });
        
        const statusCode = response.status as number;
        switch (statusCode) {
            case 200:
                return response.json as DeviceAuthorization;
            case 400:
                const error = await response.json as oAuthError;
                throw new Error(`OAuth device authorization failed: ${error.error_description}`);
            default:
                throw new Error(`OAuth device authorization unexpected error: ${response.json}`);
        }
    }

    // Poll OAuth token endpoint until user authorizes or error/expiry
    async pollDeviceToken(client_id: string, device_code: string, intervalSec: number, maxDurationSeconds: number ): Promise<AccessToken> {
        let delay = Math.max(1, intervalSec);
        const grant_type = "urn:ietf:params:oauth:grant-type:device_code";
        const startTime = Date.now();

        while (true) {
            if (Date.now() - startTime > maxDurationSeconds * 1000) {
                throw new Error('OAuth device flow timed out');
            }

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
                    client_id,
                }),
                throw: false,
            });

            const statusCode = tokenResp.status as number;

            switch (statusCode) {
                case 201:
                    return tokenResp.json as AccessToken;
                case 400:
                    const body = await tokenResp.json as oAuthError;
                    switch (body.error as oAuthErrorEnum) {
                        case 'authorization_pending':
                            break;
                        case 'slow_down':
                            delay += 5;
                            break;
                        case 'expired_token':
                        case 'access_denied':
                            throw new Error(`OAuth device flow failed: ${body.error_description || body.error}`);
                        default:
                            throw new Error(`OAuth device flow error: ${body.error_description || body.error}`);
                    }
                    break;
                default:
                    throw new Error(`OAuth device flow unexpected status ${statusCode}`);
            }

            await new Promise((resolve) => setTimeout(resolve, delay * 1000));
        }
    }

    async revokeOAuthToken(token: string): Promise<void> {
        try {
            const response = await requestUrl({
                url: `${this.settings.apiUrl}/api/oauth/revoke`,
                method: 'POST',
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({
                    token: token,
                }),
            });
        } catch (e) {
            throw new Error(`Revoking OAuth token failed: ${e.message}`);
        }
    }

    // Password-based authentication to get API token. Used as fallback if OAuth device flow is unavailable. i.E. readeck versions < 0.22
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
