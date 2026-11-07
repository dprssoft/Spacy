import { toast } from 'svelte-sonner';
import { downloadBlob } from '$lib/shared/download';
import { slug } from '$lib/shared/slug';
import type { BoardContext } from '../context';
import { getDocJSON } from './docJson';
import { docToMarkdown } from './markdown';

/** Text of a comment thread as one footnote line. */
const footnote = (ctx: BoardContext, threadId: string): string | null => {
	const t = ctx.comments.thread(threadId);
	if (!t) return null;
	const text = t.messages.map((m) => `${m.author || 'Anonymous'}: ${m.text}`).join(' — ');
	return t.resolved ? `${text} (resolved)` : text;
};

export async function cardMarkdown(
	ctx: BoardContext,
	id: string,
	opts: { comments?: boolean } = {}
): Promise<string | null> {
	const el = ctx.store.get(id);
	if (el?.type === 'table') return docToMarkdown(getDocJSON(ctx, id));
	if (el?.type !== 'doccard') return null;
	return docToMarkdown(getDocJSON(ctx, id), {
		title: el.title,
		link: (mentioned) => {
			const m = ctx.store.get(mentioned);
			return m?.type === 'media' ? m.url : null;
		},
		comment: opts.comments ? (threadId) => footnote(ctx, threadId) : undefined
	});
}

export async function copyMarkdown(ctx: BoardContext, id: string): Promise<void> {
	const md = await cardMarkdown(ctx, id);
	if (md === null) return;
	try {
		await navigator.clipboard.writeText(md);
		toast.success('Copied as Markdown');
	} catch {
		toast.error('Couldn’t copy to the clipboard');
	}
}

export async function downloadMarkdown(
	ctx: BoardContext,
	id: string,
	opts: { comments?: boolean } = {}
): Promise<void> {
	const md = await cardMarkdown(ctx, id, opts);
	const el = ctx.store.get(id);
	if (md === null || el?.type !== 'doccard') return;
	downloadBlob(
		new Blob([md], { type: 'text/markdown;charset=utf-8' }),
		`${slug(el.title) || 'doc'}.md`
	);
}
