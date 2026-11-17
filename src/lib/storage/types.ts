import type { StoredBlob } from './storedBlob';

export interface BoardMeta {
	id: string;
	title: string;
	createdAt: number; // epoch ms
	updatedAt: number;
	openedAt: number;
	starred: boolean;
	deletedAt: number | null; // non-null = in trash
	thumbnail: Blob | null;
	viewport: { x: number; y: number; zoom: number } | null;
}

export interface AssetRecord {
	id: string;
	boardId: string;
	blob: Blob;
	mime: string;
	width: number;
	height: number;
	createdAt: number;
}

/** How the records sit in IndexedDB: a Blob the browser refused is kept as bytes (`storedBlob.ts`). */
export type StoredBoardMeta = Omit<BoardMeta, 'thumbnail'> & { thumbnail: StoredBlob | null };
export type StoredAssetRecord = Omit<AssetRecord, 'blob'> & { blob: StoredBlob };

export type BoardFilter = 'recent' | 'starred' | 'all' | 'trash';
export type BoardSort = 'opened' | 'updated' | 'created' | 'title';
