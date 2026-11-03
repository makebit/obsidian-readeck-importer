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
{%- if not loop.last %}


{% endif %}
{% endfor %}
{% endif %}`;

export interface HighlightContext {
	id: string;
	text: string;
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
		now: new Date(),
		content: content ?? "",
		frontmatter,
		highlights: annotations.map(annotation => ({
			id: annotation.id,
			text: annotation.text,
			color: annotation.color,
			created: annotation.created,
			readeck_url: `${readeckUrl}#annotation-${annotation.id}`,
		})),
		bookmark,
	};
}
