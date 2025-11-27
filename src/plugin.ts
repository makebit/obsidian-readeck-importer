import { Notice, Plugin, TFile, TFolder } from "obsidian";
import { Annotation, BookmarkData, BookmarkStatus, DEFAULT_SETTINGS, ReadeckPluginSettings } from "./interfaces";
import { RDSettingTab } from "./settings";
import { ReadeckApi } from "./api"
import { Utils } from "./utils"
import { MultipartPart } from "@mjackson/multipart-parser";


export default class RDPlugin extends Plugin {
	settings: ReadeckPluginSettings;
	api: ReadeckApi;
	bookmarkFolderPath: string;
	bookmarkImagesFolderPath: string;

	async onload() {
		console.log('Readeck Importer: Loading plugin v' + this.manifest.version);

		await this.loadSettings();

		this.addSettingTab(new RDSettingTab(this.app, this));

		this.addCommand({
			id: 'get-readeck-data',
			name: 'Get readeck data',
			callback: () => this.getReadeckData(),
		});

		this.addCommand({
			id: 'resync',
			name: 'Resync all bookmarks',
			callback: async () => {
				this.settings.lastSyncAt = ''
				await this.saveSettings()
				new Notice('Readeck Last Sync reset')
				await this.getReadeckData()
			},
		  })

		this.api = new ReadeckApi(this.settings);

		// Auto sync on startup if configured
		this.app.workspace.onLayoutReady(async () => {
			if (this.settings.apiToken === "") {
				return; // Not logged in

			}
			if (this.settings.autoSyncOnStartup === false) {
				return;
			}
			await this.getReadeckData();
		})
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
			new Notice(`Error getting bookmarks, error ${error}`);
			return;
		}

		// Check if bookmarks were returned
		if (bookmarksStatus.length <= 0) {
			new Notice("No new bookmarks found");
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

		if (get.md || get.annotations) {
			// Fetch bookmarks data in multipart format
			const bookmarksMPData = await this.getBookmarksData(toUpdateIds, get.md, get.res, true);
			// Parse multipart data
			await this.parseBookmarksMP(bookmarksData, bookmarksMPData);
		}
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
				this.addBookmarkMD(id, bookmark.json.title, bookmark.text, bookmark.annotations, bookmarkFolderPath);
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
		await this.saveSettings()
	}

	async getBookmarkAnnotations(bookmarkId: string) {
		const annotations = await this.api.getBookmarkAnnotations(bookmarkId);
		if (!annotations) {
			new Notice(`Error getting annotations for ${bookmarkId}`);
		}
		return annotations;
	}

	async getBookmarksData(
		ids: string[] = [],
        markdown: boolean = false,
        resources: boolean = false,
		json: boolean = false,
	) {
		const multipart = await this.api.getBookmarks(ids, markdown, resources, json);
		return multipart;
	}

	async addBookmarkMD(bookmarkId: string, bookmarkTitle: string, bookmarkContent: string | null, bookmarkAnnotations: Annotation[], bookmarkFolderPath?: string) {
		const filePath = `${bookmarkFolderPath}/${Utils.sanitizeFileName(bookmarkTitle)}.md`;
		let noteContent = bookmarkContent || '';
		if (bookmarkAnnotations.length > 0) {
			const annotations = this.buildAnnotations(bookmarkId, bookmarkAnnotations);
			noteContent += `\n\n${annotations}`;
		}
		await this.createFile(bookmarkTitle, filePath, noteContent);
	}

	async parseBookmarksMP(bookmarksData: Map<string, BookmarkData>, bookmarksMPData: any): Promise<boolean> {
		const partsData: MultipartPart[] = await Utils.parseMultipart(bookmarksMPData);

		for (const partData of partsData) {
			const mediaType = partData.mediaType || '';
			const bookmarkId = partData.headers.get('Bookmark-Id') || '';	
			const bookmark: BookmarkData = bookmarksData.get(bookmarkId)!;
			if (mediaType == 'text/markdown') {
				const markdownContent = await partData.text();
				bookmark.text = markdownContent;
			} else if (mediaType.includes('image')) {
				bookmark.images.push({
					filename: partData.filename,
					content: partData.body,
				});
			} else if (mediaType.includes('json')) {
				const jsonText = await partData.text();
				bookmark.json = JSON.parse(jsonText);
			} else {
				console.warn(`Unknown content type: ${partData.mediaType}`);
			}
		}
		return true;
	}

	async addBookmarkAnnotations(bookmark: any, bookmarkMetadata: any, annotationsData: any) {
		const filePath = `${this.settings.folder}/${Utils.sanitizeFileName(bookmark.title)}.md`;
		const annotations = this.buildAnnotations(bookmark, annotationsData);
		const metadataAnnotations = `---\n${bookmarkMetadata}---\n${annotations}`;
		await this.createFile(bookmark, filePath, metadataAnnotations);
	}

	buildAnnotations(bookmarkId: string, bookmarkAnnotations: Annotation[]) {
		let annotationsContent = "# Annotations\n";
		if (bookmarkAnnotations.length > 0) {
			annotationsContent = annotationsContent + bookmarkAnnotations.map(
				(ann: any) =>
					`> ${ann.text}` +
					` - [#](${this.settings.apiUrl}/bookmarks/${bookmarkId}#annotation-${ann.id})`
			).join('\n\n');
		}
		return annotationsContent
	}

	async createFile(bookmarkTitle: string, filePath: string, content: any, showNotice: boolean = true) {
		const file = this.app.vault.getAbstractFileByPath(filePath);

		if (file && file instanceof TFile) {
			if (this.settings.overwrite) {
				// the file exists and overwrite is true
				await this.app.vault.modify(file, content);
				if (showNotice) { new Notice(`Overwriting note for ${bookmarkTitle}`); }
			} else {
				// the file exists and overwrite is false
				if (showNotice) { new Notice(`Note for ${bookmarkTitle} already exists`); }
			}
		} else if (!file) {
			// create file if not exists
			await this.app.vault.create(filePath, content);
			if (showNotice) { new Notice(`Creating note for ${bookmarkTitle}`); }
		}
	}

	async createFolderIfNotExists(id: string, path: string, showNotice: boolean = false) {
		const folder = this.app.vault.getAbstractFileByPath(path);

		if (folder && folder instanceof TFolder) {
			if (showNotice) { new Notice(`Folder already exists in ${id}`); }
		} else {
			// create file if not exists
			await this.app.vault.createFolder(path);
			if (showNotice) { new Notice(`Creating folder for ${id}`); }
		}
	}

	async deleteFolder(id: string, path:string, showNotice: boolean = false) {
		const folder = this.app.vault.getAbstractFileByPath(path);

		if (folder && folder instanceof TFolder) {
			await this.app.vault.delete(folder, true);
			if (showNotice) { new Notice(`Deleting bookmark ${id}`); }
		} else if (!folder) {
			if (showNotice) { new Notice(`Error deleting bookmark ${id}`); }
		}
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
