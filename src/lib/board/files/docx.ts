// A small .docx → HTML converter: text, headings, bold/italic/underline/strike, links and lists.
// Images, tables' layout, comments and the like are dropped; doc cards can't show them anyway.
// No dependency: a .docx is a zip of XML files, read with DecompressionStream and DOMParser.

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/** The files of a zip archive (stored or deflated entries), by path. */
export async function unzip(data: ArrayBuffer): Promise<Map<string, Uint8Array>> {
	const view = new DataView(data);
	const bytes = new Uint8Array(data);
	// The end-of-central-directory record is in the last 64 KB (after an optional comment).
	let eocd = -1;
	for (let i = data.byteLength - 22; i >= Math.max(0, data.byteLength - 65_557); i--) {
		if (view.getUint32(i, true) === 0x06054b50) {
			eocd = i;
			break;
		}
	}
	if (eocd < 0) throw new Error('Not a zip file');
	const count = view.getUint16(eocd + 10, true);
	let p = view.getUint32(eocd + 16, true);
	const files = new Map<string, Uint8Array>();
	const utf8 = new TextDecoder();
	for (let n = 0; n < count; n++) {
		if (view.getUint32(p, true) !== 0x02014b50) throw new Error('Corrupt zip file');
		const method = view.getUint16(p + 10, true);
		const size = view.getUint32(p + 20, true);
		const nameLen = view.getUint16(p + 28, true);
		const extraLen = view.getUint16(p + 30, true);
		const commentLen = view.getUint16(p + 32, true);
		const local = view.getUint32(p + 42, true);
		const name = utf8.decode(bytes.subarray(p + 46, p + 46 + nameLen));
		p += 46 + nameLen + extraLen + commentLen;
		const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
		const raw = bytes.subarray(start, start + size);
		if (method === 0) files.set(name, raw);
		else if (method === 8) files.set(name, await inflate(raw));
	}
	return files;
}

async function inflate(raw: Uint8Array): Promise<Uint8Array> {
	const stream = new Blob([raw as BlobPart])
		.stream()
		.pipeThrough(new DecompressionStream('deflate-raw'));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

const escapeHtml = (s: string) =>
	s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function parseXml(files: Map<string, Uint8Array>, path: string): Document | null {
	const data = files.get(path);
	if (!data) return null;
	const doc = new DOMParser().parseFromString(new TextDecoder().decode(data), 'application/xml');
	return doc.getElementsByTagName('parsererror').length ? null : doc;
}

/** Direct children in the WordprocessingML namespace with this local name. */
const kids = (el: Element, name: string) =>
	[...el.children].filter((c) => c.namespaceURI === W && c.localName === name);
const kid = (el: Element | undefined, name: string) => (el ? kids(el, name)[0] : undefined);
const val = (el: Element | undefined) => el?.getAttributeNS(W, 'val') ?? null;
/** On/off properties like <w:b/>: present means on, unless w:val says otherwise. */
const on = (el: Element | undefined) => !!el && !['0', 'false', 'none'].includes(val(el) ?? '');

/** Heading level per paragraph style id, from the style names ("heading 1", "Title"). */
function headingStyles(styles: Document | null): Map<string, number> {
	const out = new Map<string, number>();
	for (const s of styles ? [...styles.getElementsByTagNameNS(W, 'style')] : []) {
		const id = s.getAttributeNS(W, 'styleId');
		const name = (val(kid(s, 'name')) ?? '').toLowerCase();
		const level = name === 'title' ? 1 : Number(/^heading (\d)$/.exec(name)?.[1] ?? 0);
		if (id && level) out.set(id, Math.min(level, 3));
	}
	return out;
}

/** Whether a list (numId) is numbered at a level, from numbering.xml. Defaults to bullets. */
function numberedLists(numbering: Document | null): (numId: string, level: number) => boolean {
	if (!numbering) return () => false;
	const abstract = new Map<string, Element>();
	for (const a of numbering.getElementsByTagNameNS(W, 'abstractNum'))
		abstract.set(a.getAttributeNS(W, 'abstractNumId') ?? '', a);
	const nums = new Map<string, Element>();
	for (const n of numbering.getElementsByTagNameNS(W, 'num')) {
		const a = abstract.get(val(kid(n, 'abstractNumId')) ?? '');
		if (a) nums.set(n.getAttributeNS(W, 'numId') ?? '', a);
	}
	return (numId, level) => {
		const list = nums.get(numId);
		if (!list) return false;
		const lvl = kids(list, 'lvl').find((l) => l.getAttributeNS(W, 'ilvl') === String(level));
		const fmt = val(kid(lvl, 'numFmt'));
		return !!fmt && fmt !== 'bullet' && fmt !== 'none';
	};
}

function relationships(rels: Document | null): Map<string, string> {
	const out = new Map<string, string>();
	for (const r of rels ? [...rels.getElementsByTagName('Relationship')] : [])
		if (r.getAttribute('TargetMode') === 'External')
			out.set(r.getAttribute('Id') ?? '', r.getAttribute('Target') ?? '');
	return out;
}

/** Converts a .docx file to HTML for the doc card schema. Throws when it isn't a Word document. */
export async function docxToHtml(data: ArrayBuffer): Promise<string> {
	const files = await unzip(data);
	const doc = parseXml(files, 'word/document.xml');
	const body = doc?.getElementsByTagNameNS(W, 'body')[0];
	if (!body) throw new Error('Not a Word document');
	const headings = headingStyles(parseXml(files, 'word/styles.xml'));
	const isNumbered = numberedLists(parseXml(files, 'word/numbering.xml'));
	const links = relationships(parseXml(files, 'word/_rels/document.xml.rels'));

	const runs = (parent: Element): string => {
		let html = '';
		for (const node of parent.children) {
			if (node.namespaceURI !== W) continue;
			if (node.localName === 'hyperlink') {
				const href = links.get(node.getAttributeNS(R, 'id') ?? '');
				const inner = runs(node);
				html +=
					href && /^(https?:|mailto:)/i.test(href)
						? `<a href="${escapeHtml(href)}">${inner}</a>`
						: inner;
			} else if (node.localName === 'r') {
				let text = '';
				for (const c of node.children) {
					if (c.localName === 't') text += escapeHtml(c.textContent ?? '');
					else if (c.localName === 'tab') text += '\t';
					else if (c.localName === 'br') text += '<br>';
				}
				if (!text) continue;
				const pr = kid(node, 'rPr');
				if (on(kid(pr, 'strike'))) text = `<s>${text}</s>`;
				if (on(kid(pr, 'u'))) text = `<u>${text}</u>`;
				if (on(kid(pr, 'i'))) text = `<em>${text}</em>`;
				if (on(kid(pr, 'b'))) text = `<strong>${text}</strong>`;
				html += text;
			} else if (['ins', 'smartTag', 'sdt', 'sdtContent', 'fldSimple'].includes(node.localName)) {
				html += runs(node);
			}
		}
		return html;
	};

	const out: string[] = [];
	// Open lists, outermost first: their tag and level.
	const open: { tag: 'ul' | 'ol'; level: number }[] = [];
	const closeTo = (level: number) => {
		while (open.length && open[open.length - 1]!.level > level)
			out.push(`</li></${open.pop()!.tag}>`);
	};

	const paragraph = (p: Element) => {
		const pr = kid(p, 'pPr');
		const num = kid(pr, 'numPr');
		const numId = val(kid(num, 'numId'));
		const content = runs(p);
		if (num && numId && numId !== '0') {
			const level = Number(val(kid(num, 'ilvl')) ?? 0);
			const tag = isNumbered(numId, level) ? 'ol' : 'ul';
			closeTo(level);
			const top = open[open.length - 1];
			if (top && top.level === level && top.tag !== tag) {
				out.push(`</li></${open.pop()!.tag}>`);
			}
			const cur = open[open.length - 1];
			if (cur && cur.level === level) out.push('</li>');
			else {
				open.push({ tag, level });
				out.push(`<${tag}>`);
			}
			out.push(`<li><p>${content}</p>`);
			return;
		}
		closeTo(-1);
		const level = headings.get(val(kid(pr, 'pStyle')) ?? '');
		out.push(level ? `<h${level}>${content}</h${level}>` : `<p>${content}</p>`);
	};

	const block = (el: Element) => {
		if (el.namespaceURI !== W) return;
		if (el.localName === 'p') paragraph(el);
		else if (el.localName === 'tbl')
			for (const row of kids(el, 'tr'))
				for (const cell of kids(row, 'tc')) for (const p of kids(cell, 'p')) paragraph(p);
		else if (el.localName === 'sdt')
			for (const c of kid(el, 'sdtContent')?.children ?? []) block(c);
	};
	for (const el of body.children) block(el);
	closeTo(-1);
	return out.join('');
}
