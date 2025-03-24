import { Notice, Plugin, TFile } from "obsidian";
import { Annotation, Bookmark, DEFAULT_SETTINGS, ReadeckPluginSettings } from "./interfaces";
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

		this.api = new ReadeckApi(this.settings);

		this.bookmarkFolderPath = this.settings.folder;
		this.bookmarkImagesFolderPath = `${this.settings.folder}/imgs`
	}

	async getReadeckData() {

		let bookmarks: Bookmark[];

		try {
			bookmarks = await this.api.getBookmarks();
		} catch (error) {
			console.log("Readeck Importer: error", error);
			new Notice(`Error getting bookmarks`);
			return;
		}

		if (bookmarks.length <= 0) {
			new Notice("No bookmarks found");
			return;
		}

		const bookmarksFolder = this.app.vault.getAbstractFileByPath(this.bookmarkFolderPath);
		if (!bookmarksFolder) {
			await this.app.vault.createFolder(this.settings.folder);
		}

		if (["textImages", "textImagesAnnotations"].includes(this.settings.mode)) {
			const bookmarksImgsFolder = this.app.vault.getAbstractFileByPath(this.bookmarkImagesFolderPath);
			if (!bookmarksImgsFolder) {
				await this.app.vault.createFolder(`${this.settings.folder}/imgs`);
			}
		}

		for (const bookmark of bookmarks) {
			try {
				if (this.settings.mode == "text") {
					const bookmarkData = await this.getBookmarkMD(bookmark.id);
					this.addBookmarkMD(bookmark, bookmarkData, []);
				} else if (this.settings.mode == "textImages") {
					const bookmarkData = await this.getBookmarkMP(bookmark.id);
					this.addBookmarkMP(bookmark, bookmarkData, []);
				} else if (this.settings.mode == "textAnnotations") {
					const bookmarkData = await this.getBookmarkMD(bookmark.id);
					const annotationsData = await this.getBookmarkAnnotations(bookmark.id);
					this.addBookmarkMD(bookmark, bookmarkData, annotationsData);
				} else if (this.settings.mode == "textImagesAnnotations") {
					const bookmarkData = await this.getBookmarkMP(bookmark.id);
					const annotationsData = await this.getBookmarkAnnotations(bookmark.id);
					this.addBookmarkMP(bookmark, bookmarkData, annotationsData);
				} else if (this.settings.mode == "annotations") {
					const annotationsData = await this.getBookmarkAnnotations(bookmark.id);
					if (annotationsData.length > 0) {
						const bookmarkData = await this.getBookmarkMD(bookmark.id);
						this.addBookmarkAnnotations(bookmark, annotationsData, bookmarkData);
					}
				}
			} catch (error) {
				console.log(`Error getting data for ${bookmark.title}`, error);
				new Notice(`Error getting data for ${bookmark.title}`);
			}
		}
	}

	async getBookmarkAnnotations(bookmarkId: string) {
		const annotations = await this.api.getBookmarkAnnotations(bookmarkId);
		return annotations;
	}

	async getBookmarkMD(bookmarkId: string) {
		const text = await this.api.getBookmarkMD(bookmarkId);
		return text;
	}

	async getBookmarkMP(bookmarkId: string) {
		const multipart = await this.api.getBookmarkMultipart(bookmarkId);
		return multipart;
	}

	async addBookmarkMD(bookmark: Bookmark, bookmarkData: any, annotationsData: Annotation[]) {
		const filePath = `${this.bookmarkFolderPath}/${Utils.sanitizeFileName(bookmark.title)}.md`;
		let noteContent = bookmarkData;
		if (annotationsData) {
			const annotations = this.buildAnnotations(bookmark, annotationsData);
			noteContent += `\n\n${annotations}`;
		}
		await this.createFile(bookmark, filePath, noteContent);
	}

	async addBookmarkMP(bookmark: Bookmark, bookmarkData: any, annotationsData: Annotation[]) {
		const partsData: MultipartPart[] = await Utils.parseMultipart(bookmarkData);

		const texts = [];
		const images = [];
		for (const partData of partsData) {
			const mediaType = partData.mediaType || '';
			if (mediaType == 'text/markdown') {
				const markdownContent = await partData.text();
				texts.push({
					filename: partData.filename,
					content: markdownContent,
				});
			} else if (mediaType.includes('image')) {
				images.push({
					filename: partData.filename,
					content: partData.body,
				});
			} else {
				console.warn(`Unknown content type: ${partData.mediaType}`);
			}
		}

		for (const text of texts) {
			const filePath = `${this.bookmarkFolderPath}/${Utils.sanitizeFileName(bookmark.title)}.md`;

			let noteContent = Utils.updateImagePaths(text.content, './', './imgs/');
			if (annotationsData) {
				const annotations = this.buildAnnotations(bookmark, annotationsData);
				noteContent += `\n\n${annotations}`
			}
			await this.createFile(bookmark, filePath, noteContent);
		}

		for (const image of images) {
			const filePath = `${this.bookmarkImagesFolderPath}/${image.filename}`;
			await this.createFile(bookmark, filePath, image.content, false);
		}
	}

	async addBookmarkAnnotations(bookmark: Bookmark, annotationsData: Annotation[], bookmarkData: string) {
		const filePath = `${this.bookmarkFolderPath}/${Utils.sanitizeFileName(bookmark.title)}.md`;
		const properties = this.getMDProperties(bookmarkData) + "\n";
		const annotations = this.buildAnnotations(bookmark, annotationsData);
		await this.createFile(bookmark, filePath, properties + annotations);
	}

	getMDProperties(bookmarkData: string) {
		const properties = bookmarkData.match(/(---\n)([\s\S]*?)(\n---)/);
		if (properties) {
			return properties[0];
		}
		return null
	}

	buildAnnotations(bookmark: Bookmark, annotationsData: Annotation[]) {
		let annotationsContent = "# Annotations\n";
		if (annotationsData) {
			annotationsContent = annotationsContent + annotationsData.map(
				(ann: Annotation) =>
					`> ${ann.text.split('\n').join('\n> ')}` +
					` - [#](${this.settings.apiUrl}/bookmarks/${bookmark.id}#annotation-${ann.id})`
			).join('\n\n');
		}
		return annotationsContent
	}

	async createFile(bookmark: Bookmark, filePath: string, content: any, showNotice: boolean = true) {
		const file = this.app.vault.getAbstractFileByPath(filePath);

		if (file && file instanceof TFile) {
			if (this.settings.overwrite) {
				// the file exists and overwrite is true
				await this.app.vault.modify(file, content);
				if (showNotice) { new Notice(`Overwriting note for ${bookmark.title}`); }
			} else {
				// the file exists and overwrite is false
				if (showNotice) { new Notice(`Note for ${bookmark.title} already exists`); }
			}
		} else if (!file) {
			// create file if not exists
			await this.app.vault.create(filePath, content);
			if (showNotice) { new Notice(`Creating note for ${bookmark.title}`); }
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
