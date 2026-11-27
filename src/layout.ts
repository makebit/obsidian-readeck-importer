/*
* Note layout. "folder" (the default) keeps every bookmark in its own folder:
*   <folder>/<id>/<title>.md   and   <folder>/<id>/imgs/<file>
* "flat" puts all notes side by side and the images in one attachments folder:
*   <folder>/<title>.md        and   <folder>/attachments/<id>/<file>
* In the flat layout a note is recognised by "readeck_id" in its frontmatter,
* not by its path, so it can be renamed or moved and still gets updated.
*/

export type NoteLayout = "folder" | "flat";

export function attachmentsFolder(folder: string, id: string, layout: NoteLayout): string {
	return layout === "flat" ? `${folder}/attachments/${id}` : `${folder}/${id}/imgs`;
}

/*
* Readeck's Markdown links images as "imgs/<file>", relative to the note. In the
* flat layout they become vault-absolute links in angle brackets (spaces allowed),
* which keep pointing at this bookmark's own file even after the note is moved;
* Obsidian would otherwise fall back to any file of the same name, and names
* like image.png repeat across articles.
*/
export function relinkImagesToAttachments(markdown: string, folder: string, id: string): string {
	return markdown.replace(/\]\(\.?\/?imgs\/([^)\s]+)\)/g,
		(_match, file: string) => `](<${folder}/attachments/${id}/${file}>)`);
}

/* Makes sure the note's frontmatter carries readeck_id, adding a frontmatter block if there is none. */
export function withReadeckId(content: string, id: string): string {
	const line = `readeck_id: "${id}"`;
	const match = content.match(/^---\n([\s\S]*?)\n?---\n/);
	if (!match) return `---\n${line}\n---\n${content}`;
	if (/^readeck_id:/m.test(match[1])) return content;
	return `---\n${line}\n${content.slice(4)}`;
}

/* <folder>/<name>.md, or "<name> (2).md", "<name> (3).md" … when that path is taken by another bookmark. */
export function uniqueNotePath(folder: string, name: string, isTaken: (path: string) => boolean): string {
	const base = name.trim() === "" ? "Untitled" : name;
	let path = `${folder}/${base}.md`;
	for (let n = 2; isTaken(path); n++) path = `${folder}/${base} (${n}).md`;
	return path;
}
