import { toast } from 'svelte-sonner';
import { downloadBlob } from '$lib/shared/download';
import { slug } from '$lib/shared/slug';
import type { BoardContext } from '../context';
import { getDocJSON } from './docJson';
import { docToMarkdown } from './markdown';

export async function cardMarkdown(ctx: BoardContext, id: string): Promise<string | null> {
	const el = ctx.store.get(id);
	if (el?.type !== 'doccard') return null;
	return docToMarkdown(getDocJSON(ctx, id), { title: el.title });
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

export async function downloadMarkdown(ctx: BoardContext, id: string): Promise<void> {
	const md = await cardMarkdown(ctx, id);
	const el = ctx.store.get(id);
	if (md === null || el?.type !== 'doccard') return;
	downloadBlob(
		new Blob([md], { type: 'text/markdown;charset=utf-8' }),
		`${slug(el.title) || 'doc'}.md`
	);
}
