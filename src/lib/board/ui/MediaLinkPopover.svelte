<script lang="ts">
	import { Popover, Tooltip } from 'bits-ui';
	import Clapperboard from '@lucide/svelte/icons/clapperboard';
	import { getBoard } from '../context';
	import { visibleWorldRect } from '../engine/viewport';
	import { createMedia } from '../media/createMedia';
	import { parseMediaUrl } from '../media/parseMediaUrl';
	import { layout } from '$lib/shared/layout.svelte';
	import { mediaPrompt } from './mediaPromptState.svelte';

	let { button, tip }: { button: string; tip: string } = $props();

	const ctx = getBoard();
	let url = $state('');
	let touched = $state(false);

	const valid = $derived(parseMediaUrl(url) !== null);
	const showError = $derived(touched && url.trim() !== '' && !valid);

	$effect(() => {
		if (!mediaPrompt.open) {
			url = '';
			touched = false;
		}
	});

	function add(e: SubmitEvent) {
		e.preventDefault();
		touched = true;
		if (!valid) return;
		const v = visibleWorldRect(ctx.viewport.vp, ctx.viewport.size);
		if (createMedia(ctx, url, { x: v.x + v.w / 2, y: v.y + v.h / 2 })) mediaPrompt.open = false;
	}
</script>

<Popover.Root bind:open={mediaPrompt.open}>
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props: tipProps })}
				<Popover.Trigger {...tipProps}>
					{#snippet child({ props })}
						<button
							{...props}
							type="button"
							class="{button} max-sm:hidden"
							aria-label="Media"
							data-tool="media"
						>
							<Clapperboard class="size-[18px]" aria-hidden="true" />
						</button>
					{/snippet}
				</Popover.Trigger>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Portal>
			<Tooltip.Content side="bottom" sideOffset={6} class={tip}>Media — play a link</Tooltip.Content
			>
		</Tooltip.Portal>
	</Tooltip.Root>
	<Popover.Portal>
		<Popover.Content
			side="bottom"
			align="start"
			sideOffset={8}
			collisionPadding={8}
			customAnchor={layout.compact ? '[data-insert-menu]' : null}
			data-interactive
			class="z-50 w-80 max-w-[calc(100vw-16px)] rounded-xl border border-border bg-surface p-3 shadow-lg"
		>
			<form onsubmit={add} class="flex flex-col gap-2">
				<label for="media-url" class="text-sm font-medium">Media link</label>
				<div class="flex gap-2">
					<input
						id="media-url"
						bind:value={url}
						type="url"
						inputmode="url"
						autocomplete="off"
						placeholder="https://youtube.com/watch?v=…"
						aria-invalid={showError}
						aria-describedby="media-url-hint"
						onblur={() => (touched = true)}
						class="h-8 min-w-0 flex-1 rounded-md border border-border bg-bg px-2 text-sm placeholder:text-muted focus:border-accent focus:outline-none aria-invalid:border-danger"
					/>
					<button
						type="submit"
						class="h-8 rounded-md bg-accent px-3 text-sm font-medium text-accent-contrast disabled:opacity-50"
						disabled={!url.trim()}>Add</button
					>
				</div>
				<p
					id="media-url-hint"
					class="text-xs"
					class:text-danger={showError}
					class:text-muted={!showError}
				>
					{showError
						? 'Paste a YouTube, Vimeo, audio or video link'
						: 'YouTube, Vimeo, or a link to an audio or video file. You can also paste a link on the board.'}
				</p>
			</form>
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>
