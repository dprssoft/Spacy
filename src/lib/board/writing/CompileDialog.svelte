<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { toast } from 'svelte-sonner';
	import { getDocsMap } from '$lib/model/doc';
	import { downloadBlob } from '$lib/shared/download';
	import { getPref, setPref } from '$lib/shared/localPrefs';
	import { slug } from '$lib/shared/slug';
	import { getBoard } from '../context';
	import type { DocNode } from '../doccards/markdown';
	import { fragmentToJSON } from '../doccards/fragmentJson';
	import { compile, DEFAULT_COMPILE, manuscriptToMarkdown, type Separator } from './compile';
	import { compileDialog } from './compileDialogState.svelte';
	import { manuscriptToDocx } from './docxWriter';
	import { manuscriptToHtml } from './manuscriptHtml';

	let { boardTitle }: { boardTitle: string } = $props();

	const ctx = getBoard();
	type Format = 'md' | 'docx' | 'print';
	let format = $state<Format>(getPref<Format>('compile:format', 'docx'));
	let chapterHeadings = $state(DEFAULT_COMPILE.chapterHeadings);
	let numberChapters = $state(DEFAULT_COMPILE.numberChapters);
	let sceneTitles = $state(DEFAULT_COMPILE.sceneTitles);
	let separator = $state<Separator>(DEFAULT_COMPILE.separator);
	let skipCollapsed = $state(DEFAULT_COMPILE.skipCollapsed);
	let withTitle = $state(true);
	// svelte-ignore state_referenced_locally
	let title = $state(boardTitle);
	let author = $state(getPref<string>('author', ''));
	let date = $state(
		new Date().toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' })
	);

	const chapters = $derived(ctx.outline.chapters);
	const key = (f: { id: string } | null) => f?.id ?? '';
	let excluded = $state<string[]>([]);
	const included = $derived(chapters.filter((c) => !excluded.includes(key(c.frame))));
	const words = $derived(
		included.reduce((n, c) => n + c.cards.reduce((m, x) => m + ctx.words.cardWords(x.id), 0), 0)
	);

	const content = (id: string): DocNode => {
		const frag = getDocsMap(ctx.doc).get(id);
		return frag ? fragmentToJSON(frag) : { type: 'doc', content: [] };
	};

	function build() {
		return compile(chapters, content, {
			chapterHeadings,
			numberChapters,
			sceneTitles,
			separator,
			skipCollapsed,
			include: new Set(included.map((c) => key(c.frame))),
			titlePage: withTitle
				? { title: title.trim() || 'Untitled', author: author.trim(), date: date.trim() }
				: null
		});
	}

	let printFrame = $state<HTMLIFrameElement>();
	function run() {
		setPref('compile:format', format);
		if (author.trim()) setPref('author', author.trim());
		const m = build();
		const name = slug(title || boardTitle) || 'manuscript';
		if (format === 'md') {
			downloadBlob(
				new Blob([manuscriptToMarkdown(m)], { type: 'text/markdown;charset=utf-8' }),
				`${name}.md`
			);
		} else if (format === 'docx') {
			downloadBlob(
				new Blob([manuscriptToDocx(m) as BlobPart], {
					type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
				}),
				`${name}.docx`
			);
		} else if (printFrame) {
			// The browser's print dialog has "Save as PDF".
			printFrame.srcdoc = manuscriptToHtml(m, title || boardTitle);
			printFrame.onload = () => printFrame?.contentWindow?.print();
			return;
		}
		toast.success('Manuscript compiled');
	}

	const field =
		'h-8 rounded-md border border-border bg-bg px-2 text-sm focus:border-accent focus:outline-none';
	const check = 'flex items-center gap-2 text-sm';
</script>

<Dialog.Root bind:open={compileDialog.open}>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-black/40" />
		<Dialog.Content
			class="fixed top-1/2 left-1/2 z-50 flex max-h-[90dvh] w-[min(94vw,640px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-border bg-surface shadow-xl"
		>
			<div class="flex items-center border-b border-border px-5 py-3">
				<Dialog.Title class="text-base font-semibold">Compile manuscript</Dialog.Title>
				<Dialog.Close class="ml-auto h-8 rounded-md px-2 text-sm text-muted hover:bg-surface-2"
					>Close</Dialog.Close
				>
			</div>
			<Dialog.Description class="sr-only"
				>Turn this page's doc cards into one document, in outline order.</Dialog.Description
			>
			<div class="grid min-h-0 gap-5 overflow-y-auto p-5 sm:grid-cols-2">
				<div class="flex flex-col gap-3">
					<fieldset class="flex flex-col gap-1.5">
						<legend class="mb-1 text-xs font-semibold text-muted uppercase">Format</legend>
						{#each [['docx', 'Word (.docx)'], ['md', 'Markdown (.md)'], ['print', 'Print or save as PDF']] as [value, label] (value)}
							<label class={check}><input type="radio" bind:group={format} {value} />{label}</label>
						{/each}
					</fieldset>
					<fieldset class="flex flex-col gap-1.5">
						<legend class="mb-1 text-xs font-semibold text-muted uppercase">Structure</legend>
						<label class={check}
							><input type="checkbox" bind:checked={chapterHeadings} />Chapter headings (frame
							titles)</label
						>
						<label class={check}
							><input
								type="checkbox"
								bind:checked={numberChapters}
								disabled={!chapterHeadings}
							/>Number chapters</label
						>
						<label class={check}
							><input type="checkbox" bind:checked={sceneTitles} />Scene titles (card titles)</label
						>
						<label class={check}
							><input type="checkbox" bind:checked={skipCollapsed} />Leave out collapsed cards</label
						>
						<label class="flex items-center gap-2 text-sm"
							>Between scenes
							<select bind:value={separator} class={field}>
								<option value="stars">* * *</option>
								<option value="blank">A blank line</option>
								<option value="none">Nothing</option>
							</select>
						</label>
					</fieldset>
					<fieldset class="flex flex-col gap-1.5">
						<legend class="mb-1 text-xs font-semibold text-muted uppercase">Title page</legend>
						<label class={check}
							><input type="checkbox" bind:checked={withTitle} />Include a title page</label
						>
						{#if withTitle}
							<input class={field} bind:value={title} aria-label="Title" placeholder="Title" />
							<input class={field} bind:value={author} aria-label="Author" placeholder="Author" />
							<input class={field} bind:value={date} aria-label="Date" placeholder="Date" />
						{/if}
					</fieldset>
				</div>
				<fieldset class="flex min-h-0 flex-col gap-1.5">
					<legend class="mb-1 text-xs font-semibold text-muted uppercase">Chapters</legend>
					{#each chapters as ch (key(ch.frame))}
						<label class="{check} justify-between rounded-md px-1 py-1 hover:bg-surface-2">
							<span class="flex min-w-0 items-center gap-2">
								<input
									type="checkbox"
									checked={!excluded.includes(key(ch.frame))}
									onchange={(e) =>
										(excluded = e.currentTarget.checked
											? excluded.filter((k) => k !== key(ch.frame))
											: [...excluded, key(ch.frame)])}
								/>
								<span class="truncate">{ch.frame?.title || 'Not in a chapter'}</span>
							</span>
							<span class="text-xs text-muted tabular-nums">{ch.cards.length} cards</span>
						</label>
					{:else}
						<p class="text-sm text-muted">No doc cards on this page yet.</p>
					{/each}
				</fieldset>
			</div>
			<div class="flex items-center gap-3 border-t border-border px-5 py-3">
				<p class="text-sm text-muted" data-testid="compile-summary">
					{included.length}
					{included.length === 1 ? 'chapter' : 'chapters'} · {words.toLocaleString('en')} words
				</p>
				<button
					type="button"
					class="ml-auto h-9 rounded-md bg-accent px-4 text-sm font-medium text-accent-contrast disabled:opacity-50"
					disabled={included.length === 0}
					onclick={run}>{format === 'print' ? 'Print' : 'Download'}</button
				>
			</div>
			<iframe bind:this={printFrame} title="Print view" class="hidden" data-testid="print-frame"
			></iframe>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
