const SAFE_PROTOCOL = /^(https?:|mailto:)/i;

/** Allows only http(s) and mailto links (relative or `javascript:` URLs are refused). */
export function isSafeLink(url: string): boolean {
	return SAFE_PROTOCOL.test(url.trim());
}
