import { getDB } from '../db';

/** `sync` store key set when an image is too large to sync. */
export const keyTooLarge = (asset: string) => `too-large:${asset}`;

/** Whether sync skipped this image for its size (it stays on this device). */
export async function isAssetTooLarge(asset: string): Promise<boolean> {
	return (await (await getDB()).get('sync', keyTooLarge(asset))) === true;
}
