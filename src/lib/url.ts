/**
 * Only `http(s)` URLs are safe to hand to `window.open()`. Cancellation
 * links are user-entered, or come from an imported backup file someone
 * else created — a `javascript:` or `data:` URL there would execute in
 * the page's context the moment someone clicks Cancel. This guards
 * against that without restricting normal cancellation pages at all.
 */
export function isSafeUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return url.protocol === 'http:' || url.protocol === 'https:';
	} catch {
		return false;
	}
}
