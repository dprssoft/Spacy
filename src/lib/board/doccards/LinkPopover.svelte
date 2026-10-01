<script lang="ts">
	import type { Editor } from './editorFactory';
	import { isSafeLink } from './editorFactory';

	let { editor, onclose }: { editor: Editor; onclose(): void } = $props();

	// svelte-ignore state_referenced_locally
	let url = $state(String(editor.getAttributes('link').href ?? ''));
	let invalid = $state(false);

	function focusInput(node: HTMLInputElement) {
		node.focus();
		node.select();
	}

	function apply() {
		const raw = url.trim();
		const chain = editor.chain().focus().extendMarkRange('link');
		if (!raw) {
			chain.unsetLink().run();
			onclose();
			return;
		}
		const href = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
		if (!isSafeLink(href)) {
			invalid = true;
			return;
		}
		chain.setLink({ href }).run();
		onclose();
	}
</script>

<input
	{@attach focusInput}
	bind:value={url}
	type="url"
	placeholder="Paste a link, Enter to apply"
	aria-label="Link URL"
	aria-invalid={invalid}
	class="h-7 w-56 rounded-md border border-border bg-surface px-2 text-sm text-text outline-none focus:border-accent aria-invalid:border-red-500"
	oninput={() => (invalid = false)}
	onkeydown={(e) => {
		e.stopPropagation();
		if (e.key === 'Enter') {
			e.preventDefault();
			apply();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			editor.commands.focus();
			onclose();
		}
	}}
/>
