import type { BoardContext } from '../context';
import { rasterize, renderScope } from './exportImage';
import type { StaticSvg } from './staticSvg';

const W = 480;
const H = 300;
const PAD = 24;
export const THUMB_BG = '#f7f7f8';

/** The whole board fitted into 480×300 on a light background (an empty board → background only). */
export async function renderThumbnail(ctx: BoardContext): Promise<Blob | null> {
	return thumbnailFromSvg(
		await renderScope(ctx, { kind: 'board' }, { background: THUMB_BG, padding: 0 })
	);
}

/** Fits a rendered SVG into a 480×300 WebP thumbnail. */
export async function thumbnailFromSvg(out: StaticSvg | null): Promise<Blob | null> {
	const svg = out?.svg ?? `<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>`;
	return rasterize(svg, W, H, 'image/webp', 0.8, (c, img) => {
		c.fillStyle = THUMB_BG;
		c.fillRect(0, 0, W, H);
		if (!out) return;
		const s = Math.min((W - 2 * PAD) / out.width, (H - 2 * PAD) / out.height, 2);
		const w = out.width * s;
		const h = out.height * s;
		c.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
	});
}
