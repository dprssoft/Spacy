import { describe, expect, it } from 'vitest';
import { docxToHtml, unzip } from './docx';

const enc = new TextEncoder();

async function deflate(data: Uint8Array): Promise<Uint8Array> {
	const stream = new Blob([data as BlobPart])
		.stream()
		.pipeThrough(new CompressionStream('deflate-raw'));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** A minimal zip (no CRCs: the reader doesn't check them). Every other entry is deflated. */
async function zip(files: Record<string, string>): Promise<ArrayBuffer> {
	const parts: Uint8Array[] = [];
	const central: Uint8Array[] = [];
	let offset = 0;
	let i = 0;
	for (const [name, text] of Object.entries(files)) {
		const nameBytes = enc.encode(name);
		const method = i++ % 2 ? 8 : 0;
		const data = method ? await deflate(enc.encode(text)) : enc.encode(text);
		const local = new DataView(new ArrayBuffer(30));
		local.setUint32(0, 0x04034b50, true);
		local.setUint16(8, method, true);
		local.setUint32(18, data.length, true);
		local.setUint16(26, nameBytes.length, true);
		const cd = new DataView(new ArrayBuffer(46));
		cd.setUint32(0, 0x02014b50, true);
		cd.setUint16(10, method, true);
		cd.setUint32(20, data.length, true);
		cd.setUint16(28, nameBytes.length, true);
		cd.setUint32(42, offset, true);
		parts.push(new Uint8Array(local.buffer), nameBytes, data);
		central.push(new Uint8Array(cd.buffer), nameBytes);
		offset += 30 + nameBytes.length + data.length;
	}
	const cdSize = central.reduce((n, p) => n + p.length, 0);
	const end = new DataView(new ArrayBuffer(22));
	end.setUint32(0, 0x06054b50, true);
	end.setUint16(10, Object.keys(files).length, true);
	end.setUint32(12, cdSize, true);
	end.setUint32(16, offset, true);
	return new Blob([...parts, ...central, new Uint8Array(end.buffer)] as BlobPart[]).arrayBuffer();
}

const NS = `xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"`;
const p = (inner: string, pPr = '') => `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${inner}</w:p>`;
const r = (text: string, rPr = '') =>
	`<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}<w:t xml:space="preserve">${text}</w:t></w:r>`;
const li = (text: string, numId: number, level = 0) =>
	p(r(text), `<w:numPr><w:ilvl w:val="${level}"/><w:numId w:val="${numId}"/></w:numPr>`);

const styles = `<w:styles ${NS}>
	<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style>
	<w:style w:type="paragraph" w:styleId="Ttulo2"><w:name w:val="heading 2"/></w:style>
	<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/></w:style>
</w:styles>`;
const numbering = `<w:numbering ${NS}>
	<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/></w:lvl><w:lvl w:ilvl="1"><w:numFmt w:val="decimal"/></w:lvl></w:abstractNum>
	<w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/></w:lvl></w:abstractNum>
	<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
	<w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`;
const rels = `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
	<Relationship Id="rId9" Type="hyperlink" Target="https://example.com" TargetMode="External"/>
	<Relationship Id="rId10" Type="hyperlink" Target="javascript:alert(1)" TargetMode="External"/>
</Relationships>`;

async function convert(body: string) {
	return docxToHtml(
		await zip({
			'[Content_Types].xml': '<Types/>',
			'word/document.xml': `<w:document ${NS}><w:body>${body}</w:body></w:document>`,
			'word/styles.xml': styles,
			'word/numbering.xml': numbering,
			'word/_rels/document.xml.rels': rels
		})
	);
}

describe('unzip', () => {
	it('reads stored and deflated entries', async () => {
		const files = await unzip(await zip({ 'a.txt': 'stored', 'b.txt': 'deflated '.repeat(50) }));
		const dec = new TextDecoder();
		expect(dec.decode(files.get('a.txt'))).toBe('stored');
		expect(dec.decode(files.get('b.txt'))).toBe('deflated '.repeat(50));
	});

	it('rejects files that are not zips', async () => {
		await expect(
			unzip(enc.encode('plain text, not a zip').buffer as ArrayBuffer)
		).rejects.toThrow();
	});
});

describe('docxToHtml', () => {
	it('converts headings by style name, in any language', async () => {
		const html = await convert(
			p(r('Doc'), '<w:pStyle w:val="Title"/>') +
				p(r('One'), '<w:pStyle w:val="Heading1"/>') +
				p(r('Dos'), '<w:pStyle w:val="Ttulo2"/>') +
				p(r('Body'))
		);
		expect(html).toBe('<h1>Doc</h1><h1>One</h1><h2>Dos</h2><p>Body</p>');
	});

	it('keeps bold, italic, underline, strike, tabs, breaks and escapes text', async () => {
		const html = await convert(
			p(
				r('B', '<w:b/>') +
					r('notB', '<w:b w:val="0"/>') +
					r('I', '<w:i/>') +
					r('U', '<w:u w:val="single"/>') +
					r('S', '<w:strike/>') +
					'<w:r><w:tab/><w:t>a&lt;b</w:t><w:br/><w:t>c</w:t></w:r>'
			)
		);
		expect(html).toBe('<p><strong>B</strong>notB<em>I</em><u>U</u><s>S</s>\ta&lt;b<br>c</p>');
	});

	it('keeps http(s) links and drops others', async () => {
		const html = await convert(
			p(
				`<w:hyperlink r:id="rId9">${r('site')}</w:hyperlink> <w:hyperlink r:id="rId10">${r('bad')}</w:hyperlink>`
			)
		);
		expect(html).toBe('<p><a href="https://example.com">site</a>bad</p>');
	});

	it('builds bullet, numbered and nested lists', async () => {
		const html = await convert(
			li('a', 1) +
				li('a1', 1, 1) +
				li('a2', 1, 1) +
				li('b', 1) +
				p(r('mid')) +
				li('one', 2) +
				li('two', 2)
		);
		expect(html).toBe(
			'<ul><li><p>a</p><ol><li><p>a1</p></li><li><p>a2</p></li></ol></li><li><p>b</p></li></ul>' +
				'<p>mid</p><ol><li><p>one</p></li><li><p>two</p></li></ol>'
		);
	});

	it('flattens tables into paragraphs', async () => {
		const html = await convert(
			`<w:tbl><w:tr><w:tc>${p(r('x'))}</w:tc><w:tc>${p(r('y'))}</w:tc></w:tr></w:tbl>`
		);
		expect(html).toBe('<p>x</p><p>y</p>');
	});

	it('rejects a zip that is not a Word document', async () => {
		await expect(docxToHtml(await zip({ 'other.xml': '<x/>' }))).rejects.toThrow(/Word/);
	});
});
