/**
 * Roving tabindex for a toolbar (WAI-ARIA toolbar pattern): the toolbar is a single tab stop and
 * the arrow keys (plus Home/End) move between its buttons. Use as a Svelte attachment.
 */
export function rovingTabindex(selector = 'button') {
	return (root: HTMLElement) => {
		const items = () =>
			[...root.querySelectorAll<HTMLElement>(selector)].filter((b) => b.offsetParent !== null);

		const setCurrent = (current: HTMLElement | undefined) => {
			for (const b of items()) {
				const want = b === current ? 0 : -1;
				// Only write real changes: setting an attribute to the same value still notifies
				// the observer below.
				if (b.tabIndex !== want || !b.hasAttribute('tabindex')) b.tabIndex = want;
			}
		};
		const sync = () => {
			const all = items();
			const current =
				all.find((b) => b === document.activeElement) ??
				all.find((b) => b.tabIndex === 0 && b.getAttribute('aria-pressed') === 'true') ??
				all.find((b) => b.getAttribute('aria-pressed') === 'true') ??
				all[0];
			setCurrent(current);
		};

		const onKeydown = (e: KeyboardEvent) => {
			const all = items();
			const i = all.indexOf(document.activeElement as HTMLElement);
			if (i === -1 || e.ctrlKey || e.metaKey || e.altKey) return;
			let next: number;
			if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (i + 1) % all.length;
			else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft')
				next = (i - 1 + all.length) % all.length;
			else if (e.key === 'Home') next = 0;
			else if (e.key === 'End') next = all.length - 1;
			else return;
			// Before the buttons' own handlers: arrows navigate (menus open with Enter or Space).
			e.preventDefault();
			e.stopPropagation();
			setCurrent(all[next]);
			all[next]?.focus();
		};
		const onFocusin = (e: FocusEvent) => {
			if (e.target instanceof HTMLElement && items().includes(e.target)) setCurrent(e.target);
		};

		sync();
		// Buttons re-render (pressed state, tooltips): keep exactly one tab stop.
		const observer = new MutationObserver(sync);
		observer.observe(root, {
			subtree: true,
			attributes: true,
			attributeFilter: ['aria-pressed'],
			childList: true
		});
		root.addEventListener('keydown', onKeydown, true);
		root.addEventListener('focusin', onFocusin);
		return () => {
			observer.disconnect();
			root.removeEventListener('keydown', onKeydown, true);
			root.removeEventListener('focusin', onFocusin);
		};
	};
}
