import type { ThemeId } from './themes';

export type Currency = 'EUR' | 'USD';

export const CURRENCIES: Currency[] = ['EUR', 'USD'];

export type BillingCycle = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export const BILLING_CYCLES: BillingCycle[] = [
	'daily',
	'weekly',
	'monthly',
	'quarterly',
	'yearly'
];

export type SubscriptionStatus = 'active' | 'cancelled' | 'paused';

export interface Subscription {
	id: number;
	name: string;
	category: string | null;
	/** Price in minor units (cents) of `currency`, per `cycleCount` x `cycle`. */
	amount: number;
	currency: Currency;
	cycle: BillingCycle;
	/** e.g. billed every 3 months => cycle="monthly", cycleCount=3. */
	cycleCount: number;
	startDate: string | null;
	nextRenewal: string | null;
	status: SubscriptionStatus;
	cancelUrl: string | null;
	cancelNotes: string | null;
	cancelledAt: string | null;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
}

export type SubscriptionInput = Omit<
	Subscription,
	'id' | 'cancelledAt' | 'createdAt' | 'updatedAt'
>;

export interface Settings {
	/** Currency the dashboard totals are shown in. */
	displayCurrency: Currency;
	/** How many USD make 1 EUR. */
	fxEurToUsd: number;
	/** Visual theme. The id is a `ThemeId` from `$lib/themes`. */
	theme: ThemeId;
}

/** Shape of the JSON files produced by `exportData` and consumed by `importData`. */
export interface ExportBundle {
	version: 1;
	exportedAt: string;
	settings: Settings;
	subscriptions: Subscription[];
}
