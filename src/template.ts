import { moment } from "obsidian";
import nunjucks from "nunjucks";
import { Annotation, Bookmark } from "./interfaces";

/*
* The note template is rendered with Nunjucks (Jinja-style syntax).
* An empty template setting means DEFAULT_TEMPLATE, which reproduces the
* note layout the importer produced before templates existed.
*
* Whitespace: trimBlocks + lstripBlocks are on, so a {% tag %} on its own
* line leaves no blank line behind. {%- / -%} still strip whitespace manually.
*/
export const DEFAULT_TEMPLATE = `{{ frontmatter }}{{ content }}
{%- if highlights.length %}

# Annotations
{% for highlight in highlights %}
> {{ highlight.text }} - [#]({{ highlight.readeck_url }})
{%- if highlight.note %}

>
{{ ("**Note:** " + highlight.note) | blockquote }}
{%- endif %}
{%- if not loop.last %}


{% endif %}
{% endfor %}
{% endif %}`;

/*
* What a template can use, shown under the template field in the settings.
* A test checks that every context field is listed here and in the README.
*/
export const TEMPLATE_REFERENCE: { name: string; description: string }[] = [
	{ name: "title", description: "Bookmark title" },
	{ name: "url", description: "Original article URL" },
	{ name: "site", description: "Host name, e.g. nesslabs.com" },
	{ name: "site_name", description: "Site name, e.g. Ness Labs" },
	{ name: "description", description: "Short description" },
	{ name: "lang", description: "Language code, e.g. en" },
	{ name: "authors", description: "List of authors" },
	{ name: "labels", description: "List of Readeck labels" },
	{ name: "created", description: "Date saved in Readeck (use the date filter)" },
	{ name: "published", description: "Publication date, may be empty" },
	{ name: "word_count", description: "Number of words" },
	{ name: "reading_time", description: "Reading time in minutes" },
	{ name: "id", description: "Readeck bookmark id" },
	{ name: "readeck_url", description: "Link to the bookmark in Readeck" },
	{ name: "thumbnail", description: "URL of the article's thumbnail image in Readeck" },
	{ name: "thumbnail_path", description: "Vault path of the downloaded thumbnail, e.g. for cover: \"[[{{ thumbnail_path }}]]\"; empty in modes without images" },
	{ name: "content", description: "The article as Markdown" },
	{ name: "highlights", description: "List of highlights; each has text, note, color, created, id, readeck_url" },
	{ name: "frontmatter", description: "The default frontmatter block" },
	{ name: "now", description: "Time of the import" },
	{ name: "bookmark", description: "Everything Readeck sends, e.g. bookmark.note, bookmark.resources.image.src, bookmark.read_progress" },
];

export const FILTER_REFERENCE: { name: string; description: string }[] = [
	{ name: "date(\"YYYY-MM-DD\")", description: "Format a date (moment.js tokens)" },
	{ name: "blockquote", description: "Prefix every line with \"> \"" },
	{ name: "yaml", description: "Quote text safely for frontmatter" },
];

export interface HighlightContext {
	id: string;
	text: string;
	/* the user's own note on this highlight, empty when there is none */
	note: string;
	color: string;
	created: Date | string;
	readeck_url: string;
}

export interface TemplateContext {
	id: string;
	title: string;
	url: string;
	site: string;
	site_name: string;
	description: string;
	authors: string[];
	labels: string[];
	lang: string;
	word_count: number | null;
	reading_time: number | null;
	created: Date | string | null;
	published: Date | string | null;
	readeck_url: string;
	thumbnail: string;
	thumbnail_path: string;
	now: Date;
	content: string;
	frontmatter: string;
	highlights: HighlightContext[];
	bookmark: Bookmark;
}

function createEnvironment(): nunjucks.Environment {
	const env = new nunjucks.Environment(null, {
		autoescape: false,
		throwOnUndefined: false,
		trimBlocks: true,
		lstripBlocks: true,
	});

	// {{ created | date("YYYY-MM-DD") }}; empty input renders as an empty string
	env.addFilter("date", (value: unknown, format = "YYYY-MM-DD") => {
		if (value === null || value === undefined || value === "") return "";
		const m = moment(value as Date | string);
		return m.isValid() ? m.format(format) : "";
	});

	// {{ highlight.text | blockquote }} prefixes every line with "> ",
	// so multi-line highlights stay inside a quote or callout
	env.addFilter("blockquote", (value: unknown) =>
		String(value ?? "").split("\n").map(line => `> ${line}`).join("\n"));

	// {{ title | yaml }} renders a safely quoted YAML string for frontmatter
	env.addFilter("yaml", (value: unknown) => JSON.stringify(value ?? ""));

	return env;
}

export class NoteTemplate {
	private template: nunjucks.Template;

	/* Throws a Nunjucks TemplateError when the template has a syntax error. */
	constructor(source: string) {
		const src = source.trim() === "" ? DEFAULT_TEMPLATE : source;
		this.template = new nunjucks.Template(src, createEnvironment(), undefined, true);
	}

	render(context: TemplateContext): string {
		return this.template.render(context);
	}

	/* Returns the error message for an invalid template, or null when it compiles. */
	static validate(source: string): string | null {
		try {
			new NoteTemplate(source);
			return null;
		} catch (error) {
			return templateErrorMessage(error);
		}
	}
}

/* Nunjucks prefixes errors with "(unknown path)" for string templates; drop it for readable notices. */
export function templateErrorMessage(error: unknown): string {
	const message = error instanceof Error ? error.message : String(error);
	return message.replace(/^\(unknown path\)\s*/, "").replace(/\s+/g, " ").trim();
}

export function buildTemplateContext(
	apiUrl: string,
	bookmarkId: string,
	bookmark: Bookmark,
	content: string | null,
	annotations: Annotation[],
	frontmatter: string,
	thumbnailPath = "",
): TemplateContext {
	const readeckUrl = `${apiUrl}/bookmarks/${bookmarkId}`;
	return {
		id: bookmarkId,
		title: bookmark.title ?? "",
		url: bookmark.url ?? "",
		site: bookmark.site ?? "",
		site_name: bookmark.site_name ?? "",
		description: bookmark.description ?? "",
		authors: bookmark.authors ?? [],
		labels: bookmark.labels ?? [],
		lang: bookmark.lang ?? "",
		word_count: bookmark.word_count ?? null,
		reading_time: bookmark.reading_time ?? null,
		created: bookmark.created ?? null,
		published: bookmark.published ?? null,
		readeck_url: readeckUrl,
		thumbnail: bookmark.resources?.thumbnail?.src ?? "",
		thumbnail_path: thumbnailPath,
		now: new Date(),
		content: content ?? "",
		frontmatter,
		highlights: annotations.map(annotation => ({
			id: annotation.id,
			text: annotation.text,
			note: annotation.note ?? "",
			color: annotation.color,
			created: annotation.created,
			readeck_url: `${readeckUrl}#annotation-${annotation.id}`,
		})),
		bookmark,
	};
}
