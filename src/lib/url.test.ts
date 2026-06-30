import { describe, expect, it } from 'bun:test';
import { isSafeUrl } from './url';

describe('isSafeUrl', () => {
	it('accepts http and https URLs', () => {
		expect(isSafeUrl('https://www.netflix.com/cancelplan')).toBe(true);
		expect(isSafeUrl('http://example.com')).toBe(true);
	});

	it('rejects javascript: URLs', () => {
		expect(isSafeUrl('javascript:alert(1)')).toBe(false);
	});

	it('rejects data: URLs', () => {
		expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
	});

	it('rejects other non-http(s) schemes', () => {
		expect(isSafeUrl('file:///etc/passwd')).toBe(false);
		expect(isSafeUrl('mailto:someone@example.com')).toBe(false);
	});

	it('rejects malformed URLs', () => {
		expect(isSafeUrl('not a url')).toBe(false);
		expect(isSafeUrl('')).toBe(false);
	});
});
