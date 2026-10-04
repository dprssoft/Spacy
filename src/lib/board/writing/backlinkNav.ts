import type { BoardContext } from '../context';
import { jumpToElement } from '../doccards/jumpTo';

/** Opens a card where it mentions `targetId`: flies to the card and flashes the mention chip. */
export function openBacklink(ctx: BoardContext, cardId: string, targetId: string): void {
	if (!jumpToElement(ctx, cardId)) return;
	setTimeout(() => {
		const chip = document.querySelector<HTMLElement>(
			`[data-element-id="${CSS.escape(cardId)}"] .mention[data-id="${CSS.escape(targetId)}"]`
		);
		if (!chip) return;
		chip.classList.remove('mention-flash');
		void chip.offsetWidth; // restart the animation
		chip.classList.add('mention-flash');
		setTimeout(() => chip.classList.remove('mention-flash'), 1800);
	}, 450);
}
