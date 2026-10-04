import type { DocMark, DocNode } from '../doccards/markdown';
import type { Manuscript } from './compile';
import { zipStored } from './zip';

// A manuscript as a Word document (WordprocessingML, no dependency): styles for Title,
// Heading 1–3, Normal, Quote and Code; bullet and numbered lists; links; a page break before each
// chapter.

const W_NS =
	'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

const esc = (s: string) =>
	s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

class Writer {
	readonly body: string[] = [];
	readonly links: string[] = [];
	/** Numbered lists restart at 1: each gets its own numbering instance (ids from 2). */
	orderedLists = 0;

	para(
		runs: string,
		opts: {
			style?: string;
			align?: string;
			num?: { id: number; level: number };
			pageBreakBefore?: boolean;
		} = {}
	) {
		const pr = [
			opts.style && `<w:pStyle w:val="${opts.style}"/>`,
			opts.pageBreakBefore && '<w:pageBreakBefore/>',
			opts.num &&
				`<w:numPr><w:ilvl w:val="${opts.num.level}"/><w:numId w:val="${opts.num.id}"/></w:numPr>`,
			opts.align && `<w:jc w:val="${opts.align}"/>`
		]
			.filter(Boolean)
			.join('');
		this.body.push(`<w:p>${pr ? `<w:pPr>${pr}</w:pPr>` : ''}${runs}</w:p>`);
	}

	text(s: string, marks: DocMark[] = []): string {
		const has = (t: string) => marks.some((m) => m.type === t);
		const rpr = [
			has('bold') && '<w:b/>',
			has('italic') && '<w:i/>',
			has('underline') && '<w:u w:val="single"/>',
			has('strike') && '<w:strike/>',
			has('code') && '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/>'
		]
			.filter(Boolean)
			.join('');
		const run = s
			.split('\n')
			.map((part) => `<w:t xml:space="preserve">${esc(part)}</w:t>`)
			.join('<w:br/>');
		const r = `<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ''}${run}</w:r>`;
		const link = marks.find((m) => m.type === 'link');
		const href = typeof link?.attrs?.href === 'string' ? link.attrs.href : null;
		if (!href || !/^(https?:|mailto:)/i.test(href)) return r;
		this.links.push(href);
		return `<w:hyperlink r:id="rIdLink${this.links.length}"><w:r><w:rPr><w:rStyle w:val="Hyperlink"/>${rpr}</w:rPr>${run}</w:r></w:hyperlink>`;
	}

	inline(nodes: DocNode[] = []): string {
		return nodes
			.map((n) =>
				n.type === 'text'
					? this.text(n.text ?? '', n.marks)
					: n.type === 'mention'
						? this.text(String(n.attrs?.label ?? ''), n.marks)
						: n.type === 'hardBreak'
							? '<w:r><w:br/></w:r>'
							: ''
			)
			.join('');
	}

	block(n: DocNode, ctx: { list?: { id: number; level: number }; quote?: boolean } = {}): void {
		const align = ({ center: 'center', right: 'right', justify: 'both' } as Record<string, string>)[
			String(n.attrs?.align ?? '')
		];
		switch (n.type) {
			case 'paragraph':
				this.para(this.inline(n.content), {
					style: ctx.quote ? 'Quote' : undefined,
					align,
					num: ctx.list
				});
				return;
			case 'heading':
				this.para(this.inline(n.content), {
					style: `Heading${Math.min(3, Number(n.attrs?.level ?? 1))}`,
					align
				});
				return;
			case 'blockquote':
				for (const c of n.content ?? []) this.block(c, { ...ctx, quote: true });
				return;
			case 'codeBlock':
				for (const line of (n.content ?? [])
					.map((c) => c.text ?? '')
					.join('')
					.split('\n'))
					this.para(this.text(line), { style: 'Code' });
				return;
			case 'horizontalRule':
				this.para(this.text('* * *'), { align: 'center' });
				return;
			case 'bulletList':
			case 'orderedList':
			case 'taskList': {
				const level = ctx.list ? ctx.list.level + 1 : 0;
				const id =
					n.type === 'orderedList'
						? ctx.list && level > 0 && ctx.list.id > 1
							? ctx.list.id
							: 2 + this.orderedLists++
						: 1;
				for (const item of n.content ?? []) {
					const kids = item.content ?? [];
					kids.forEach((k, i) => {
						if (k.type === 'paragraph' && i === 0 && item.type === 'taskItem') {
							const box = item.attrs?.checked ? '☑ ' : '☐ ';
							this.para(this.text(box) + this.inline(k.content), { num: { id, level } });
						} else if (k.type === 'paragraph' && i === 0)
							this.para(this.inline(k.content), { num: { id, level } });
						else this.block(k, { list: { id, level } });
					});
				}
				return;
			}
			default:
				for (const c of n.content ?? []) this.block(c, ctx);
		}
	}
}

const LIST_LEVELS = (fmt: 'bullet' | 'decimal') =>
	Array.from({ length: 9 }, (_, i) => {
		const text = fmt === 'bullet' ? ['•', '◦', '▪'][i % 3] : `%${i + 1}.`;
		return `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/><w:lvlText w:val="${text}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${720 * (i + 1)}" w:hanging="360"/></w:pPr></w:lvl>`;
	}).join('');

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles ${W_NS}>
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/><w:spacing w:before="2400" w:after="240"/></w:pPr><w:rPr><w:b/><w:sz w:val="56"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/></w:pPr><w:rPr><w:i/><w:sz w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="480" w:after="240"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="360" w:after="160"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="30"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="720" w:right="720"/></w:pPr><w:rPr><w:i/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="20"/></w:rPr></w:style>
<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="1F5FBF"/><w:u w:val="single"/></w:rPr></w:style>
</w:styles>`;

export function manuscriptToDocx(m: Manuscript): Uint8Array {
	const w = new Writer();
	let first = true;
	if (m.titlePage) {
		w.para(w.text(m.titlePage.title), { style: 'Title' });
		if (m.titlePage.author) w.para(w.text(m.titlePage.author), { style: 'Subtitle' });
		if (m.titlePage.date) w.para(w.text(m.titlePage.date), { align: 'center' });
		first = false;
	}
	for (const ch of m.chapters) {
		let pageBreak = !first;
		if (ch.heading) {
			w.para(w.text(ch.heading), { style: 'Heading1', pageBreakBefore: pageBreak });
			pageBreak = false;
		}
		ch.scenes.forEach((s, i) => {
			if (i > 0 && m.separator === 'stars') w.para(w.text('* * *'), { align: 'center' });
			if (i > 0 && m.separator === 'blank') w.para('');
			if (s.title) {
				w.para(w.text(s.title), { style: 'Heading2', pageBreakBefore: pageBreak });
				pageBreak = false;
			}
			for (const b of s.blocks) {
				if (pageBreak) {
					w.para('', { pageBreakBefore: true });
					pageBreak = false;
				}
				w.block(b);
			}
		});
		first = false;
	}
	const nums = [
		'<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>',
		...Array.from(
			{ length: w.orderedLists },
			(_, i) =>
				`<w:num w:numId="${i + 2}"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>`
		)
	].join('');
	const numbering = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering ${W_NS}><w:abstractNum w:abstractNumId="0">${LIST_LEVELS('bullet')}</w:abstractNum><w:abstractNum w:abstractNumId="1">${LIST_LEVELS('decimal')}</w:abstractNum>${nums}</w:numbering>`;
	const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W_NS}><w:body>${w.body.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
	const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>${w.links
		.map(
			(href, i) =>
				`<Relationship Id="rIdLink${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${esc(href)}" TargetMode="External"/>`
		)
		.join('')}</Relationships>`;
	return zipStored({
		'[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>`,
		'_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
		'word/document.xml': document,
		'word/styles.xml': STYLES,
		'word/numbering.xml': numbering,
		'word/_rels/document.xml.rels': rels
	});
}
