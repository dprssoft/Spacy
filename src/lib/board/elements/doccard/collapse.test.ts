import { describe, expect, it } from 'vitest';
import { DOC_CARD_HEADER_H } from '$lib/model/defaults';
import { getDocsMap } from '$lib/model/doc';
import type { DocCardElement } from '$lib/model/types';
import { testCtx } from '../../testCtx';
import { createDocCard } from '../../tools/create';
import { setCollapsed } from './collapse';

describe('setCollapsed', () => {
	it('collapses to the header and restores the height, each one undo step', () => {
		const ctx = testCtx();
		const id = createDocCard(ctx, { x: 0, y: 0 });
		const card = () => ctx.store.get(id) as DocCardElement;
		expect([card().w, card().h]).toEqual([360, 280]);
		expect(getDocsMap(ctx.doc).has(id)).toBe(true);
		setCollapsed(ctx, card(), true);
		expect(card()).toMatchObject({ collapsed: true, h: DOC_CARD_HEADER_H, expandedH: 280 });
		setCollapsed(ctx, card(), false);
		expect(card()).toMatchObject({ collapsed: false, h: 280 });
		ctx.undo.undo();
		expect(card().h).toBe(DOC_CARD_HEADER_H);
		ctx.undo.undo();
		expect(card().h).toBe(280);
	});
});
