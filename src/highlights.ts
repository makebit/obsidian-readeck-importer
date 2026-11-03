/*
* Colored highlights (Obsidian 1.14+): a color emoji right after the opening
* "==" sets the highlight color, e.g. "==🔴text==".
*
* Readeck's Markdown export marks highlights as "==text==" without a color.
* The article HTML (GET /api/bookmarks/{id}/article) marks the same segments,
* in the same order, as <rd-annotation data-annotation-color="...">. The two
* are paired by position, and every pair must also match by text; if anything
* disagrees the Markdown is left as it is rather than colored wrongly.
*/

export const HIGHLIGHT_COLOR_EMOJI: Record<string, string> = {
	red: "🔴",
	orange: "🟠",
	yellow: "🟡",
	green: "🟢",
	blue: "🔵",
	purple: "🟣",
};

/* Emoji for a Readeck color name; unknown colors get none (Obsidian's default highlight). */
export function highlightEmoji(color: string | undefined): string {
	return HIGHLIGHT_COLOR_EMOJI[(color ?? "").trim().toLowerCase()] ?? "";
}

/* One highlight's text as a colored highlight; each line is wrapped on its own, since "==" cannot span lines. */
export function colorHighlightText(text: string, color: string | undefined): string {
	const emoji = highlightEmoji(color);
	return text.split("\n").map(line => {
		const [, lead, core, trail] = line.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
		return core === "" ? line : `${lead}==${emoji}${core}==${trail}`;
	}).join("\n");
}

export interface HtmlHighlightSegment {
	id: string;
	color: string;
	text: string;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " " };

function decodeEntities(text: string): string {
	return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
		if (code[0] === "#") {
			const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
			return Number.isFinite(n) ? String.fromCodePoint(n) : match;
		}
		return ENTITIES[code.toLowerCase()] ?? match;
	});
}

/* Text used to check that a Markdown segment and an HTML segment are the same highlight. */
function comparable(text: string): string {
	return text.replace(/[*_`\\]/g, "").replace(/\s+/g, " ").trim();
}

/* Highlight segments of the article HTML, in document order. */
export function extractHtmlHighlights(html: string): HtmlHighlightSegment[] {
	const segments: HtmlHighlightSegment[] = [];
	const re = /<rd-annotation\b([^>]*)>([\s\S]*?)<\/rd-annotation>/gi;
	for (const match of html.matchAll(re)) {
		const attrs = match[1];
		const attr = (name: string) => (attrs.match(new RegExp(`${name}="([^"]*)"`, "i")) ?? [])[1] ?? "";
		segments.push({
			id: attr("data-annotation-id-value"),
			color: attr("data-annotation-color"),
			text: decodeEntities(match[2].replace(/<[^>]+>/g, "")),
		});
	}
	return segments;
}

/*
* Returns the Markdown with every "==text==" highlight colored, or null when
* the Markdown and HTML highlights do not line up (then nothing is changed).
* Whitespace just inside the markers is moved outside them, because "== text =="
* does not render as a highlight (Readeck produces that around links).
*/
export function colorizeHighlights(markdown: string, html: string): string | null {
	const htmlSegments = extractHtmlHighlights(html);
	const mdSegments = [...markdown.matchAll(/==([\s\S]*?)==/g)];
	if (mdSegments.length === 0 || mdSegments.length !== htmlSegments.length) return null;

	for (let i = 0; i < mdSegments.length; i++) {
		if (comparable(mdSegments[i][1]) !== comparable(htmlSegments[i].text)) return null;
	}

	let i = 0;
	return markdown.replace(/==([\s\S]*?)==/g, (_match, inner: string) => {
		const { color } = htmlSegments[i++];
		const [, lead, core, trail] = inner.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
		if (core === "") return inner;
		return `${lead}==${highlightEmoji(color)}${core}==${trail}`;
	});
}
