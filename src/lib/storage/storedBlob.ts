// Safari's private windows (and, now and then, iOS Safari) refuse Blobs in IndexedDB: "Error
// preparing Blob/File data to be stored in object store". Images and thumbnails are then stored as
// their bytes and type instead. Everywhere else they stay Blobs, so existing data never changes, and
// readers always get a Blob back.

/** The bytes of a Blob the browser wouldn't store. */
export interface StoredBytes {
	bytes: ArrayBuffer;
	type: string;
}

/** How a Blob sits in IndexedDB. */
export type StoredBlob = Blob | StoredBytes;

export const fromStored = (v: StoredBlob): Blob =>
	v instanceof Blob ? v : new Blob([v.bytes], { type: v.type });

export const toBytes = async (blob: Blob): Promise<StoredBytes> => ({
	bytes: await blob.arrayBuffer(),
	type: blob.type
});

/** The error a browser gives when it can't put a Blob into IndexedDB. */
export function isBlobRefused(err: unknown): boolean {
	if (!(err instanceof Error) && !(err instanceof DOMException)) return false;
	if (err.name === 'DataCloneError') return true;
	return err.name === 'UnknownError' && /blob|file/i.test(err.message);
}

// Once refused, the rest of the session goes straight to bytes instead of failing a write first.
let refused = false;

/**
 * Runs `write` with Blobs as they are; if the browser refuses them, runs it again with each Blob
 * turned into bytes (`prepare` does that, outside any transaction: one can't stay open across it).
 */
export async function writeWithFallback<T, R>(
	value: T,
	prepare: (value: T) => Promise<T>,
	write: (value: T) => Promise<R>
): Promise<R> {
	if (!refused) {
		try {
			return await write(value);
		} catch (err) {
			if (!isBlobRefused(err)) throw err;
			refused = true;
		}
	}
	return write(await prepare(value));
}

export function resetBlobFallbackForTests(): void {
	refused = false;
}
