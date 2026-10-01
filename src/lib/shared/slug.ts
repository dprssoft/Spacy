const MAX = 60;

/** A filename-safe ASCII slug: "Café plan #2" → "cafe-plan-2". */
export function slug(text: string): string {
	return text
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, MAX)
		.replace(/-+$/, '');
}
