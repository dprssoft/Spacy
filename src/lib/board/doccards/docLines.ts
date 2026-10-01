import type { DocNode } from './markdown';

export interface DocLine {
	text: string;
	kind: 'h' | 'p' | 'li';
}

/** Plain lines for static rendering: headings, paragraphs and prefixed list items. */
export function docLines(doc: DocNode): DocLine[] {
	const out: DocLine[] = [];
	walk(doc.content ?? [], out, 0);
	return out;
}

function walk(nodes: DocNode[], out: DocLine[], depth: number) {
	for (const node of nodes) {
		switch (node.type) {
			case 'heading':
				pushText(out, 'h', '', inlineText(node));
				break;
			case 'paragraph':
				pushText(out, depth ? 'li' : 'p', '  '.repeat(depth), inlineText(node));
				break;
			case 'codeBlock':
				for (const l of inlineText(node).split('\n')) out.push({ text: l, kind: 'p' });
				break;
			case 'horizontalRule':
				out.push({ text: '———', kind: 'p' });
				break;
			case 'bulletList':
			case 'orderedList':
			case 'taskList': {
				const start = Number(node.attrs?.start ?? 1) || 1;
				(node.content ?? []).forEach((item, i) => {
					const marker =
						node.type === 'bulletList'
							? '•'
							: node.type === 'orderedList'
								? `${start + i}.`
								: item.attrs?.checked
									? '☑'
									: '☐';
					const [first, ...rest] = item.content ?? [];
					const indent = '  '.repeat(depth);
					if (first?.type === 'paragraph' || first?.type === 'heading')
						pushText(out, 'li', `${indent}${marker} `, inlineText(first));
					else {
						out.push({ text: `${indent}${marker}`, kind: 'li' });
						if (first) walk([first], out, depth + 1);
					}
					walk(rest, out, depth + 1);
				});
				break;
			}
			default:
				if (node.content) walk(node.content, out, depth);
		}
	}
}

function pushText(out: DocLine[], kind: DocLine['kind'], prefix: string, text: string) {
	const [first = '', ...rest] = text.split('\n');
	out.push({ text: prefix + first, kind });
	const pad = ' '.repeat(prefix.length);
	for (const l of rest) out.push({ text: pad + l, kind });
}

function inlineText(node: DocNode): string {
	return (node.content ?? [])
		.map((c) =>
			c.type === 'text'
				? (c.text ?? '')
				: c.type === 'hardBreak'
					? '\n'
					: c.type === 'mention'
						? `@${String(c.attrs?.label ?? c.attrs?.id ?? '')}`
						: inlineText(c)
		)
		.join('');
}
