<script lang="ts">
	import { Popover } from 'bits-ui';
	import Volume1 from '@lucide/svelte/icons/volume-1';
	import Volume2 from '@lucide/svelte/icons/volume-2';
	import VolumeX from '@lucide/svelte/icons/volume-x';

	let {
		volume,
		muted,
		btn,
		onvolume,
		onmute
	}: {
		volume: number;
		muted: boolean;
		btn: string;
		onvolume: (v: number) => void;
		onmute: (m: boolean) => void;
	} = $props();

	const Icon = $derived(muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2);
</script>

<div class="flex items-center">
	<button
		type="button"
		class={btn}
		aria-label={muted ? 'Unmute' : 'Mute'}
		aria-keyshortcuts="M"
		onclick={() => onmute(!muted)}
	>
		<Icon class="size-4" aria-hidden="true" />
	</button>
	<Popover.Root>
		<Popover.Trigger class="{btn} w-5 min-w-5 px-0 text-[10px]" aria-label="Volume">
			{Math.round((muted ? 0 : volume) * 100)}
		</Popover.Trigger>
		<Popover.Portal>
			<Popover.Content
				side="top"
				sideOffset={8}
				data-interactive
				class="z-50 rounded-lg border border-border bg-surface p-3 shadow-lg"
			>
				<input
					type="range"
					min="0"
					max="100"
					step="1"
					aria-label="Volume"
					value={Math.round((muted ? 0 : volume) * 100)}
					oninput={(e) => onvolume(Number(e.currentTarget.value) / 100)}
					class="h-28 w-4 accent-accent [direction:rtl] [writing-mode:vertical-lr]"
				/>
			</Popover.Content>
		</Popover.Portal>
	</Popover.Root>
</div>
