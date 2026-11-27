/*
* When images are not downloaded, the Markdown from Readeck still points at
* "imgs/<file>" (the resource_prefix of the sync request), files that never
* exist in the vault. Readeck serves the same images at stable public URLs:
*   lead image, icon, thumbnail: the src listed in the bookmark's resources
*   images inside the article:   <readeck>/bm/<first 2 chars of id>/<id>/_resources/<file>
*/

export interface BookmarkResources {
	[name: string]: { src?: string } | undefined;
}

const IMAGE_LINK = /\]\(\.?\/?imgs\/([^)\s]+)\)/g;

export function remoteImageUrl(apiUrl: string, bookmarkId: string, file: string, resources?: BookmarkResources): string {
	for (const resource of Object.values(resources ?? {})) {
		const src = resource?.src;
		if (src && src.split("/").pop() === file && src.includes(`/${bookmarkId}/`)) return src;
	}
	return `${apiUrl}/bm/${bookmarkId.slice(0, 2)}/${bookmarkId}/_resources/${file}`;
}

/* Points every "imgs/<file>" image link of a bookmark at its Readeck URL. */
export function linkImagesRemotely(markdown: string, apiUrl: string, bookmarkId: string, resources?: BookmarkResources): string {
	return markdown.replace(IMAGE_LINK, (_match, file: string) =>
		`](${remoteImageUrl(apiUrl, bookmarkId, file, resources)})`);
}
