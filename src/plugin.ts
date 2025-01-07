import { Notice, Plugin, TFile } from "obsidian";
import { DEFAULT_SETTINGS, ReadeckPluginSettings } from "./interfaces";
import { RDSettingTab } from "./settings";
import { ReadeckApi } from "./api"
import { Utils } from "./utils"
import TurndownService from 'turndown';

export default class RDPlugin extends Plugin {
	settings: ReadeckPluginSettings;
	api: ReadeckApi;
	turndownService: TurndownService;

	async onload() {
		console.log('Readeck Importer: Loading plugin v' + this.manifest.version);

		await this.loadSettings();

		this.addSettingTab(new RDSettingTab(this.app, this));

		this.addCommand({
			id: 'get-readeck-data',
			name: 'Get Readeck Data',
			callback: () => this.getReadeckData(),
		});

		this.api = new ReadeckApi(this.settings);

		this.turndownService = new TurndownService();
		this.turndownService.addRule('rd-annotation', {
			// @ts-ignore
			filter: ['rd-annotation'],
			replacement: function (content) {
				return '==' + content + '=='
			}
		})
	}

	async getReadeckData() {
		const bookmarks = await this.api.getBookmarks();

		if(!bookmarks) {
			new Notice(`Error getting bookmarks`);
			return;
		}

		const bookmarksData = new Map();
		const annotationsData = new Map();
		const articlesData = new Map();
		for (const bookmark of bookmarks) {
			bookmarksData.set(bookmark.id, bookmark);

			if (this.settings.getAnnotations) {
				const annotations = await this.api.getBookmarkAnnotations(bookmark.id);
				if(!annotations) {
					new Notice(`Error getting annotations for ${bookmark.title}`);
					continue;
				}
				if (annotations.length > 0) {
					annotationsData.set(bookmark.id, annotations);
				}
			}
			
			if (this.settings.getArticle) {
				const article = await this.api.getBookmarkArticle(bookmark.id);
				articlesData.set(bookmark.id, article);
				if(!article) {
					new Notice(`Error getting article for ${bookmark.title}`);
					continue;
				}
			}
		}

		await this.addNotes(bookmarksData, annotationsData, articlesData);
	}

	async addNotes(bookmarksData: Map<string, any>, annotationsData: Map<string, any>, articlesData: Map<string, any>) {
		const RDFolder = this.app.vault.getAbstractFileByPath(this.settings.folder);
		if (!RDFolder) {
			await this.app.vault.createFolder(this.settings.folder);
		}

		for (const [bookmarkId, bookmark] of bookmarksData) {
			const bookmarkAnnotations = annotationsData.get(bookmarkId);
			const article = articlesData.get(bookmarkId);

			// continue if no annotations and setting is false
			if (!bookmarkAnnotations && !this.settings.createNoteIfNoAnnotations) {
				continue;
			}

			const sanitizedFileName = Utils.sanitizeFileName(bookmark.title);
			const notePath = `${this.settings.folder}/${sanitizedFileName}.md`;

			const existingFile = this.app.vault.getAbstractFileByPath(notePath);
			// continue if the note already exists and not overwrite
			if (existingFile && existingFile instanceof TFile && !this.settings.overwriteIfExists) {
				new Notice(`Skipping ${bookmark.title}, it already exists`);
				continue;
			}

			// build the note content
			let noteContent = '';
			
			// build properties
			if (this.settings.setProperties) {
				const bookmarkLabels = bookmark.labels.map((label: any) => `  - ${label}`).join('\n');
				const bookmarkAuthors = bookmark.authors.map((author: any) => `  - ${author}`).join('\n');
				const properties = `---\n` +
					`url: ${bookmark.url}\n` +
					`created: ${bookmark.created}\n` +
					`updated: ${bookmark.updated}\n` +
					`authors:\n${bookmarkAuthors}\n` +
					`site: ${bookmark.site}\n` +
					`href: ${bookmark.href}\n` +
					`tags:\n${bookmarkLabels}\n` +
					`---`;
				noteContent += `${properties}\n`;
			}

			// build annotations
			if (this.settings.getAnnotations) {
				let annotationsContent = "# Annotations\n";
				if (bookmarkAnnotations) {
					annotationsContent = annotationsContent + bookmarkAnnotations.map(
						(ann: any) =>
							`> ${ann.text}` +
							` - [#](${this.settings.apiUrl}/bookmarks/${bookmark.id}#annotation-${ann.id})`
					).join('\n\n');
				}
				noteContent += `${annotationsContent}\n\n`
			}

			// build article
			if (this.settings.getArticle) {
				if(article) {
					const markdownArticle = this.turndownService.turndown(article)
					noteContent += `# Article\n${markdownArticle}`;
				}
			}

			// set the note
			if (existingFile && existingFile instanceof TFile && this.settings.overwriteIfExists) {
				await this.app.vault.modify(existingFile, noteContent);
				new Notice(`Overwriting note for ${bookmark.title}`);
			} else {
				await this.app.vault.create(notePath, noteContent);
				new Notice(`Creating note for ${bookmark.title}`);
			}
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
