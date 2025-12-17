import { MultipartPart, parseMultipart } from '@mjackson/multipart-parser';
import { BookmarkDetail } from './interfaces';

export class Utils {
    static sanitizeFileName(fileName: string): string {
        // Replace illegal characters with an underscore or a safe character
        return fileName
            .replace(/[<>:"/\\|?*]/g, '')  // Replace illegal characters on Windows
            .replace(/[\x00-\x1F\x80-\x9F]/g, '')  // Remove control characters
            .replace(/^\.+$/, '')  // Avoid names like "." or ".."
            .replace(/^\s+|\s+$/g, '')  // Trim leading/trailing spaces
            .replace(/[\s.]+$/, '')  // Remove trailing spaces or periods
            .substring(0, 255);  // Limit filename length
    }

    static async parseMultipart(articleData: any): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                // Get the content type and boundary from headers
                const contentType = articleData.headers['content-type'];
                const RE_BOUNDARY = /^multipart\/.+?(?:; boundary=(?:(?:"(.+)")|(?:([^\s]+))))$/i;
                const match = RE_BOUNDARY.exec(contentType);
                if (!match) {
                    throw new Error("Invalid multipart content-type");
                }
                const boundary = match[1] || match[2];
                let multipartMessage = Buffer.from(articleData.arrayBuffer);
                const parts: MultipartPart[] = [];

                await parseMultipart(multipartMessage, { boundary }, async (part) => {
                    parts.push(part);
                  });

                resolve(parts);
            } catch (error) {
                console.error("Error parsing multipart data:", error);
                reject(error);
            }
        });
    }

    static updateImagePaths(text: string, oldPath: string, newPath: string) {
        const imageRegex = /!\[.*?\]\(\.\/(.*?\.(?:png|jpg|jpeg|gif|svg|webp))\)/g;

        const updatedtext = text.replace(imageRegex, (match, imageId) => {
            return match.replace(`${oldPath}${imageId}`, `${newPath}${imageId}`);
        });

        return updatedtext;
    }

	static parseDateStrToISO(date: string): string | undefined {
		const syncAtDate = new Date(date);
		return isNaN(syncAtDate.getTime())
			? undefined
			: syncAtDate.toISOString();
	}

	/**
	 * Build YAML Frontmatter based on bookmark detail and configured fields
	 * @param detail - Bookmark detail from API
	 * @param fields - Fields to include in frontmatter
	 * @param bookmarkFolderPath - Absolute path to bookmark folder (from vault root)
	 */
	static buildFrontmatter(detail: BookmarkDetail, fields: string[], bookmarkFolderPath: string): string {
		const lines: string[] = ['---'];

		for (const field of fields) {
			const value = this.getFieldValue(detail, field, bookmarkFolderPath);
			if (value !== null && value !== undefined) {
				const yamlValue = this.formatYamlValue(field, value);
				lines.push(`${field}: ${yamlValue}`);
			}
		}

		lines.push('---');
		return lines.join('\n');
	}

	/**
	 * Get the value for a specific field from bookmark detail
	 * @param detail - Bookmark detail from API
	 * @param field - Field name
	 * @param bookmarkFolderPath - Absolute path to bookmark folder (from vault root)
	 */
	static getFieldValue(detail: BookmarkDetail, field: string, bookmarkFolderPath: string): any {
		switch (field) {
			case 'title':
				return detail.title;
			case 'url':
				return detail.url;
			case 'site_name':
				return detail.site_name;
			case 'authors':
				return detail.authors;
			case 'description':
				return detail.description;
			case 'labels':
				return detail.labels;
			case 'created':
				return detail.created;
			case 'updated':
				return detail.updated;
			case 'word_count':
				return detail.word_count;
			case 'reading_time':
				return detail.reading_time;
			case 'read_progress':
				return detail.read_progress;
			case 'cover':
				// Use absolute path from vault root for cover image
				return `${bookmarkFolderPath}/imgs/thumbnail.jpeg`;
			default:
				return null;
		}
	}

	/**
	 * Format value as YAML
	 */
	static formatYamlValue(field: string, value: any): string {
		if (Array.isArray(value)) {
			if (value.length === 0) {
				return '[]';
			}
			// Format array as YAML list
			return '\n' + value.map(v => `  - "${this.escapeYamlString(String(v))}"`).join('\n');
		}
		if (typeof value === 'string') {
			// Strings need to escape special characters
			return `"${this.escapeYamlString(value)}"`;
		}
		if (typeof value === 'number') {
			return String(value);
		}
		return String(value);
	}

	/**
	 * Escape special characters in YAML string
	 */
	static escapeYamlString(str: string): string {
		return str
			.replace(/\\/g, '\\\\')
			.replace(/"/g, '\\"')
			.replace(/\n/g, '\\n')
			.replace(/\r/g, '\\r');
	}

	/**
	 * Update the Frontmatter section of file content
	 * If Frontmatter already exists, replace it; otherwise add it at the beginning
	 */
	static updateFrontmatter(content: string, newFrontmatter: string): string {
		// Match existing Frontmatter
		const frontmatterRegex = /^---\n[\s\S]*?\n---\n?/;
		const match = content.match(frontmatterRegex);

		if (match) {
			// Replace existing Frontmatter
			return content.replace(frontmatterRegex, newFrontmatter + '\n');
		} else {
			// Add Frontmatter at the beginning of file
			return newFrontmatter + '\n\n' + content;
		}
	}
}
