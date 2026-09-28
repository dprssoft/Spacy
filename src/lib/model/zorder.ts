import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';

// Keys use the library's default base-52 alphabet, which sorts correctly with plain
// string comparison. Never use localeCompare on z keys.

export function compareZ(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

export const zAbove = (z: string | null): string => generateKeyBetween(z, null);
export const zBelow = (z: string | null): string => generateKeyBetween(null, z);
export const zBetween = (a: string | null, b: string | null): string => generateKeyBetween(a, b);
export const zManyAbove = (z: string | null, n: number): string[] =>
	generateNKeysBetween(z, null, n);
export const zManyBelow = (z: string | null, n: number): string[] =>
	generateNKeysBetween(null, z, n);
