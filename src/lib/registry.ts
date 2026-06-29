/**
 * A small, bundled registry of well-known subscription providers and their
 * official cancellation pages. Used to autofill the cancel URL + category when
 * a user types a recognized service name. Degrades gracefully: unknown services
 * simply get no autofill.
 *
 * URLs point at official help/cancellation pages, not deep account links, so
 * they stay valid without per-user state.
 */
export interface RegistryEntry {
	name: string;
	category: string;
	cancelUrl: string;
	notes?: string;
}

export const REGISTRY: RegistryEntry[] = [
	{
		name: 'Netflix',
		category: 'Streaming',
		cancelUrl: 'https://www.netflix.com/cancelplan'
	},
	{
		name: 'Spotify',
		category: 'Music',
		cancelUrl: 'https://www.spotify.com/account/subscription/'
	},
	{
		name: 'Disney+',
		category: 'Streaming',
		cancelUrl: 'https://www.disneyplus.com/account/subscription'
	},
	{
		name: 'Amazon Prime',
		category: 'Shopping',
		cancelUrl: 'https://www.amazon.com/gp/primecentral'
	},
	{
		name: 'YouTube Premium',
		category: 'Streaming',
		cancelUrl: 'https://www.youtube.com/paid_memberships'
	},
	{
		name: 'Apple Music',
		category: 'Music',
		cancelUrl: 'https://music.apple.com/account/subscriptions',
		notes: 'Also manageable via Settings > [your name] > Subscriptions on iOS.'
	},
	{
		name: 'iCloud+',
		category: 'Cloud Storage',
		cancelUrl: 'https://support.apple.com/en-us/HT207594',
		notes: 'Manage under Settings > [your name] > iCloud > Manage Account Storage.'
	},
	{
		name: 'HBO Max',
		category: 'Streaming',
		cancelUrl: 'https://www.max.com/account'
	},
	{
		name: 'Max',
		category: 'Streaming',
		cancelUrl: 'https://www.max.com/account'
	},
	{
		name: 'Hulu',
		category: 'Streaming',
		cancelUrl: 'https://secure.hulu.com/account'
	},
	{
		name: 'Adobe Creative Cloud',
		category: 'Software',
		cancelUrl: 'https://account.adobe.com/plans'
	},
	{
		name: 'Microsoft 365',
		category: 'Software',
		cancelUrl: 'https://account.microsoft.com/services'
	},
	{
		name: 'Google One',
		category: 'Cloud Storage',
		cancelUrl: 'https://one.google.com/settings'
	},
	{
		name: 'Dropbox',
		category: 'Cloud Storage',
		cancelUrl: 'https://www.dropbox.com/account/plan'
	},
	{
		name: 'Notion',
		category: 'Productivity',
		cancelUrl: 'https://www.notion.so/my-integrations'
	},
	{
		name: 'GitHub',
		category: 'Software',
		cancelUrl: 'https://github.com/settings/billing'
	},
	{
		name: 'ChatGPT Plus',
		category: 'Software',
		cancelUrl: 'https://chatgpt.com/#settings/Subscription'
	},
	{
		name: 'LinkedIn Premium',
		category: 'Productivity',
		cancelUrl: 'https://www.linkedin.com/premium/manage/'
	},
	{
		name: 'Audible',
		category: 'Audiobooks',
		cancelUrl: 'https://www.audible.com/account/overview'
	},
	{
		name: 'PlayStation Plus',
		category: 'Gaming',
		cancelUrl: 'https://www.playstation.com/account/'
	},
	{
		name: 'Xbox Game Pass',
		category: 'Gaming',
		cancelUrl: 'https://account.microsoft.com/services'
	},
	{
		name: 'Nintendo Switch Online',
		category: 'Gaming',
		cancelUrl: 'https://accounts.nintendo.com/'
	}
];

const BY_NAME = new Map(REGISTRY.map((e) => [e.name.toLowerCase(), e]));

/** Case-insensitive exact lookup of a provider by name. */
export function findProvider(name: string): RegistryEntry | undefined {
	return BY_NAME.get(name.trim().toLowerCase());
}
