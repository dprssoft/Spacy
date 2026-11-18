import type * as Y from 'yjs';
import { buildCanvas, type CanvasBlock } from './businessModelCanvas';

// Ash Maurya's layout: the business model canvas grid with the startup's blocks.
const BLOCKS: CanvasBlock[] = [
	['Problem', 0, 0, 1, 1, 'red'],
	['Solution', 1, 0, 1, 0.5, 'green'],
	['Key metrics', 1, 0.5, 1, 0.5, 'green'],
	['Unique value proposition', 2, 0, 1, 1, 'yellow'],
	['Unfair advantage', 3, 0, 1, 0.5, 'violet'],
	['Channels', 3, 0.5, 1, 0.5, 'violet'],
	['Customer segments', 4, 0, 1, 1, 'blue'],
	['Cost structure', 0, 1, 2.5, 0, 'gray'],
	['Revenue streams', 2.5, 1, 2.5, 0, 'teal']
];

export const buildLeanCanvas = (doc: Y.Doc): void => buildCanvas(doc, 'Lean canvas', BLOCKS);
