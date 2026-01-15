import { App, Notice, TFile, TFolder } from "obsidian";
import { Annotation, Bookmark, BookmarkData, BookmarkStatus, ReadeckPluginSettings } from "./interfaces";
import { ReadeckApi } from "./api";
import { Utils } from "./utils";
import { MultipartPart } from "@mjackson/multipart-parser";

type BookmarksServiceDeps = {
	app: App;
	api: ReadeckApi;
	getSettings: () => ReadeckPluginSettings;
	saveSettings: () => Promise<void>;
};

export class BookmarksService {
	private app: App;
	private api: ReadeckApi;
	private getSettings: () => ReadeckPluginSettings;
	private saveSettings: () => Promise<void>;

	constructor({ app, api, getSettings, saveSettings }: BookmarksServiceDeps) {
		this.app = app;
		this.api = api;
		this.getSettings = getSettings;
		this.saveSettings = saveSettings;
	}

	private get settings() {
		return this.getSettings();
	}

	/*
	* Fetch Readeck data and process bookmarks
	* 1. Get bookmark status since last sync
	* 2. For each updated bookmark, fetch data based on mode
	* 3. Create/update markdown notes and save images
	* 4. Delete removed bookmarks if setting enabled
	* 5. Update last sync time
	*/
	async getReadeckData() {
		const { lastSyncAt } = this.settings;

		// Get bookmark status since last sync
		let bookmarksStatus: BookmarkStatus[] = [];
		try {
			const response = await this.api.getBookmarksStatus(
				Utils.parseDateStrToISO(lastSyncAt)
			);
			bookmarksStatus = response.items;
		} catch (error) {
			new Notice(`Readeck importer: Error getting bookmarks, error ${error}`);
			return;
		}

		// Check if bookmarks were returned
		if (bookmarksStatus.length <= 0) {
			new Notice("Readeck importer: No new bookmarks found");
			return;
		}

		// Ensure bookmarks folder exists
		const bookmarksFolder = this.app.vault.getAbstractFileByPath(this.settings.folder);
		if (!bookmarksFolder) {
			await this.app.vault.createFolder(this.settings.folder);
		}

		// Determine what data to fetch based on mode
		let get = {
			md: false,
			res: false,
			annotations: false
		};
		if (this.settings.mode == "text") {
			get.md = true;
		} else if (this.settings.mode == "textImages") {
			get.md = true;
			get.res = true;
		} else if (this.settings.mode == "textAnnotations") {
			get.md = true;
			get.annotations = true;
		} else if (this.settings.mode == "textImagesAnnotations") {
			get.md = true;
			get.res = true;
			get.annotations = true;
		} else if (this.settings.mode == "annotations") {
			get.annotations = true;
		}
		
		// Initialize bookmarks data structure (a map of bookmark ID to its data)
		const toUpdateIds = bookmarksStatus.filter(b => b.type === 'update').map(b => b.id);
		const bookmarksData = new Map<string, BookmarkData>();
		for (const id of toUpdateIds) {
			bookmarksData.set(id, { id: id, text: null, json: { title: '' }, images: [], annotations: [] });
		}

		// Fetch bookmarks data in multipart format
		const bookmarksMPData = await this.getBookmarksData(toUpdateIds, get.md, get.res, true);
		// Parse multipart data
		await this.parseBookmarksMP(bookmarksData, bookmarksMPData);		

		if (get.annotations) {
			// Fetch annotations for each updated bookmark
			for (const bookmarkId of toUpdateIds) {
				const annotationsData = await this.getBookmarkAnnotations(bookmarkId);
				for (const annotationData of annotationsData) {
					const bookmark: BookmarkData = bookmarksData.get(bookmarkId)!;
					bookmark.annotations.push(annotationData);
				}
			}
		}

		// Process each bookmark
		for (const [id, bookmark] of bookmarksData.entries()) {
			// Create markdown note
			if (bookmark.text || bookmark.annotations.length > 0) {
				// Create bookmark folder
				const bookmarkFolderPath = `${this.settings.folder}/${id}`;
				await this.createFolderIfNotExists(id, bookmarkFolderPath);
				const bookmarkHeader = this.generateBookmarkHeader(bookmark.json);
				const bookmarkContent = bookmarkHeader + (bookmark.text || '');
				this.addBookmarkMD(id, bookmark.json.title, bookmarkContent, bookmark.annotations, bookmarkFolderPath);
			}

			// Save images
			if (bookmark.images.length > 0 && bookmark.json) {
				const bookmarkImgsFolderPath = `${this.settings.folder}/${id}/imgs`;
				await this.createFolderIfNotExists(id, bookmarkImgsFolderPath);
				for (const image of bookmark.images) {
					const filePath = `${bookmarkImgsFolderPath}/${image.filename}`;
					await this.createFile(bookmark.json.title, filePath, image.content, false);
				}
			}
		}

		// Delete removed bookmarks
		if (this.settings.delete) {
			const toDeleteIds = bookmarksStatus.filter(b => b.type === 'delete').map(b => b.id);
			for (const id of toDeleteIds) {
				const bookmarkFolderPath = `${this.settings.folder}/${id}`;
				await this.deleteFolder(id, bookmarkFolderPath, true);
			}
		}
		
		// Update last sync time
		this.settings.lastSyncAt = new Date().toLocaleString();
		await this.saveSettings();
	}

	private async getBookmarkAnnotations(bookmarkId: string) {
		const annotations = await this.api.getBookmarkAnnotations(bookmarkId);
		if (!annotations) {
			new Notice(`Readeck importer: Error getting annotations for ${bookmarkId}`);
		}
		return annotations;
	}

	private async getBookmarksData(
		ids: string[] = [],
        markdown: boolean = false,
        resources: boolean = false,
		json: boolean = false,
	) {
		const multipart = await this.api.getBookmarks(ids, markdown, resources, json);
		return multipart;
	}

	private async addBookmarkMD(bookmarkId: string, bookmarkTitle: string, bookmarkContent: string | null, bookmarkAnnotations: Annotation[], bookmarkFolderPath?: string) {
		const filePath = `${bookmarkFolderPath}/${Utils.sanitizeFileName(bookmarkTitle)}.md`;
		let noteContent = bookmarkContent || '';
		if (bookmarkAnnotations.length > 0) {
			const annotations = this.buildAnnotations(bookmarkId, bookmarkAnnotations);
			noteContent += `\n${annotations}`;
		}
		await this.createFile(bookmarkTitle, filePath, noteContent);
	}

	private async parseBookmarksMP(bookmarksData: Map<string, BookmarkData>, bookmarksMPData: any): Promise<boolean> {
		const partsData: MultipartPart[] = await Utils.parseMultipart(bookmarksMPData);

		for (const partData of partsData) {
			const mediaType = partData.mediaType || '';
			const bookmarkId = partData.headers.get('Bookmark-Id') || '';	
			const bookmark: BookmarkData = bookmarksData.get(bookmarkId)!;
			if (mediaType == 'text/markdown') {
				const markdownContent = await partData.text();
				// Remove bookmark properties if present
				bookmark.text = markdownContent.replace(/^---[\s\S]*?---\s*/, '');
			} else if (mediaType.includes('image')) {
				bookmark.images.push({
					filename: partData.filename,
					content: partData.body,
				});
			} else if (mediaType.includes('json')) {
				const jsonText = await partData.text();
				// Parse JSON with date conversion
				bookmark.json = JSON.parse(jsonText, (key, value) => {
					if (key === 'created' || key === 'published') {
						return new Date(value);
					}
					return value;
				});
			} else {
				console.warn(`Unknown content type: ${partData.mediaType}`);
			}
		}
		return true;
	}

	private buildAnnotations(bookmarkId: string, bookmarkAnnotations: Annotation[]) {
		let annotationsContent = "# Annotations\n";
		if (bookmarkAnnotations.length > 0) {
			annotationsContent = annotationsContent + bookmarkAnnotations.map(
				(ann: any) =>
					`> ${ann.text}` +
					` - [#](${this.settings.apiUrl}/bookmarks/${bookmarkId}#annotation-${ann.id})`
			).join('\n\n');
		}
		return annotationsContent;
	}

	private generateBookmarkHeader(bookmark: Bookmark): string {
		let header = `---\n`;
		if (bookmark.title) {
			header += `title: "${bookmark.title.replace(/"/g, '\\"')}"\n`;
		}
		if (bookmark.url) {
			header += `url: "${bookmark.url}"\n`;
		}
		if (bookmark.site) {
			header += `site: "${bookmark.site}"\n`;
		}
		if (bookmark.created) {
			header += `created: "${bookmark.created.toISOString()}"\n`;
		}
		if (bookmark.published) {
			header += `published: "${bookmark.published.toISOString().split('T')[0]}"\n`;
		}
		if (bookmark.authors && bookmark.authors.length > 0) {
			header += `authors:\n- ${bookmark.authors.join('\n- ')}\n`;
		}
		if (bookmark.labels && bookmark.labels.length > 0) {
			header += `labels:\n- ${bookmark.labels.join('\n- ')}\n`;
		}
		header += `---\n`;
		return header;
	}

	private async createFile(bookmarkTitle: string, filePath: string, content: any, showNotice: boolean = true) {
		const file = this.app.vault.getAbstractFileByPath(filePath);

		if (file && file instanceof TFile) {
			if (this.settings.overwrite) {
				// the file exists and overwrite is true
				await this.app.vault.modify(file, content);
				if (showNotice) { new Notice(`Readeck importer: Overwriting note for ${bookmarkTitle}`); }
			} else {
				// the file exists and overwrite is false
				if (showNotice) { new Notice(`Readeck importer: Note for ${bookmarkTitle} already exists`); }
			}
		} else if (!file) {
			// create file if not exists
			await this.app.vault.create(filePath, content);
			if (showNotice) { new Notice(`Readeck importer: Creating note for ${bookmarkTitle}`); }
		}
	}

	private async createFolderIfNotExists(id: string, path: string, showNotice: boolean = false) {
		const folder = this.app.vault.getAbstractFileByPath(path);

		if (folder && folder instanceof TFolder) {
			if (showNotice) { new Notice(`Readeck importer: Folder already exists in ${id}`); }
		} else {
			// create file if not exists
			await this.app.vault.createFolder(path);
			if (showNotice) { new Notice(`Readeck importer: Creating folder for ${id} for Readeck`); }
		}
	}

	private async deleteFolder(id: string, path:string, showNotice: boolean = false) {
		const folder = this.app.vault.getAbstractFileByPath(path);

		if (folder && folder instanceof TFolder) {
			await this.app.vault.delete(folder, true);
			if (showNotice) { new Notice(`Readeck importer: Deleting bookmark ${id}`); }
		} else if (!folder) {
			if (showNotice) { new Notice(`Readeck importer: Error deleting bookmark ${id}`); }
		}
	}
}
