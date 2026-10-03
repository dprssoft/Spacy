<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import Maximize from '@lucide/svelte/icons/maximize';
	import Minimize from '@lucide/svelte/icons/minimize';
	import Pause from '@lucide/svelte/icons/pause';
	import Play from '@lucide/svelte/icons/play';
	import Repeat from '@lucide/svelte/icons/repeat';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import RotateCw from '@lucide/svelte/icons/rotate-cw';
	import type { MediaElement } from '$lib/model/types';
	import { getBoard } from '../context';
	import * as cmd from './commands';
	import { initialState, type MediaController } from './controller';
	import MediaMoreMenu from './MediaMoreMenu.svelte';
	import { RATES } from './mediaPrefs';
	import type { MoreItem } from './menuItem';
	import { NativeController } from './native';
	import { formatTime } from './poster';
	import Scrubber from './Scrubber.svelte';
	import VolumeControl from './VolumeControl.svelte';

	let {
		el,
		controller,
		compact = false,
		fullscreen = false
	}: {
		el: MediaElement;
		controller: MediaController;
		compact?: boolean;
		fullscreen?: boolean;
	} = $props();

	const ctx = getBoard();
	// A plain snapshot of the controller's state, refreshed on every change it reports.
	let s = $state(initialState());
	let can = $state({ rate: false, pip: false, captions: false });
	$effect(() => {
		const c = controller;
		s = { ...c.state };
		can = { ...c.can };
		return c.subscribe(() => {
			s = { ...c.state };
			can = { ...c.can };
		});
	});

	let remaining = $state(false);
	let captions = $state(false);
	// Spoken state; loop changes override it until the next play/pause.
	let announce = $derived(s.playing ? 'Playing' : s.ready ? 'Paused' : '');

	const btn =
		'inline-flex h-8 min-w-8 items-center justify-center rounded-md px-1 text-muted hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none';
	const audio = $derived(el.provider === 'audio');
	const native = $derived(controller instanceof NativeController ? controller : null);

	const more = $derived<(MoreItem | null)[]>([
		{
			label: 'Loop',
			keys: 'Shift+L',
			checked: el.loop,
			run: () => {
				cmd.toggleLoop(ctx, el);
				announce = el.loop ? 'Loop off' : 'Loop on';
			}
		},
		null,
		{ label: 'Set start here', run: () => cmd.setClipEdge(ctx, el, controller, 'start') },
		{ label: 'Set end here', run: () => cmd.setClipEdge(ctx, el, controller, 'end') },
		{
			label: 'Clear clip',
			disabled: el.start === 0 && el.end === null,
			run: () => cmd.clearClip(ctx, el)
		},
		null,
		...(can.captions && native
			? [{ label: 'Captions', checked: captions, run: () => (captions = native.toggleCaptions()) }]
			: []),
		...(can.pip && native ? [{ label: 'Picture in picture', run: () => native.togglePip() }] : []),
		{ label: 'Open link', run: () => window.open(el.url, '_blank', 'noopener,noreferrer') },
		{ label: 'Copy link at this time', run: () => cmd.copyLinkAt(el, controller) }
	]);
</script>

<div
	role="group"
	aria-label="Media controls: {el.title}"
	data-interactive
	data-testid="media-controls"
	class="pointer-events-auto flex items-center gap-1 rounded-xl border border-border bg-surface p-1 text-text shadow-lg"
>
	<button
		type="button"
		class={btn}
		aria-label={s.playing ? 'Pause' : 'Play'}
		aria-keyshortcuts="K"
		data-testid="media-toggle"
		onclick={() => cmd.togglePlay(controller, el)}
	>
		{#if s.playing}<Pause class="size-4 fill-current" aria-hidden="true" />{:else}<Play
				class="size-4 fill-current"
				aria-hidden="true"
			/>{/if}
	</button>
	{#if !compact}
		<button
			type="button"
			class={btn}
			aria-label="Back 10 seconds"
			aria-keyshortcuts="J"
			onclick={() => cmd.seekBy(controller, -10)}
		>
			<RotateCcw class="size-4" aria-hidden="true" />
		</button>
		<button
			type="button"
			class={btn}
			aria-label="Forward 10 seconds"
			aria-keyshortcuts="L"
			onclick={() => cmd.seekBy(controller, 10)}
		>
			<RotateCw class="size-4" aria-hidden="true" />
		</button>
		<Scrubber
			time={s.time}
			duration={s.duration}
			buffered={s.buffered}
			start={el.start}
			end={el.end}
			onseek={(t) => controller.seek(t)}
		/>
	{/if}
	<button
		type="button"
		class="{btn} text-xs tabular-nums"
		aria-label="Show {remaining ? 'elapsed' : 'remaining'} time"
		data-testid="media-time"
		onclick={() => (remaining = !remaining)}
	>
		{remaining && s.duration ? `−${formatTime(s.duration - s.time)}` : formatTime(s.time)} / {formatTime(
			s.duration
		)}
	</button>
	{#if !compact}
		<VolumeControl
			volume={s.volume}
			muted={s.muted}
			{btn}
			onvolume={(v) => cmd.setVolume(controller, v)}
			onmute={(m) => cmd.setMuted(controller, m)}
		/>
		{#if can.rate}
			<DropdownMenu.Root>
				<DropdownMenu.Trigger class="{btn} text-xs tabular-nums" aria-label="Speed {s.rate}×"
					>{s.rate}×</DropdownMenu.Trigger
				>
				<DropdownMenu.Portal>
					<DropdownMenu.Content
						side="top"
						sideOffset={8}
						data-interactive
						class="z-50 rounded-lg border border-border bg-surface p-1 shadow-lg"
					>
						<DropdownMenu.RadioGroup
							value={String(s.rate)}
							onValueChange={(v) => cmd.setRate(controller, Number(v))}
						>
							{#each RATES as r (r)}
								<DropdownMenu.RadioItem
									value={String(r)}
									class="flex h-8 cursor-default items-center rounded-md px-3 text-sm outline-none select-none data-[highlighted]:bg-surface-2 data-[state=checked]:font-semibold"
									>{r}×</DropdownMenu.RadioItem
								>
							{/each}
						</DropdownMenu.RadioGroup>
					</DropdownMenu.Content>
				</DropdownMenu.Portal>
			</DropdownMenu.Root>
		{/if}
	{/if}
	{#if el.loop}<Repeat class="mx-1 size-4 text-accent" aria-label="Loop on" />{/if}
	<MediaMoreMenu items={more} {btn} />
	{#if !audio}
		<button
			type="button"
			class={btn}
			aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
			aria-keyshortcuts="F"
			onclick={() => cmd.toggleFullscreen(el.id)}
		>
			{#if fullscreen}<Minimize class="size-4" aria-hidden="true" />{:else}<Maximize
					class="size-4"
					aria-hidden="true"
				/>{/if}
		</button>
	{/if}
	<span class="sr-only" aria-live="polite">{announce}</span>
</div>
