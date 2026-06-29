import type { CancelRecipe } from './types';

/**
 * The bundled "demo provider" recipe drives the mock cancellation site shipped
 * with Solvo (src/routes/demo-provider). It runs fully end-to-end against
 * localhost, so the whole automation pipeline is verifiable without touching a
 * real service. Real recipes plug into the exact same engine.
 */
const DEMO_PROVIDER: CancelRecipe = {
	id: 'demo-provider',
	provider: 'Demo Provider',
	experimental: false,
	steps: [
		{ action: 'goto', url: '/demo-provider/login', description: 'Open the login page' },
		{ action: 'fill', selector: '#email', value: 'demo@solvo.app', description: 'Enter email' },
		{ action: 'fill', selector: '#password', value: 'demo', description: 'Enter password' },
		{ action: 'click', selector: '#login-submit', description: 'Sign in' },
		{
			action: 'waitFor',
			selector: '#cancel-subscription',
			description: 'Wait for the account page'
		},
		{ action: 'click', selector: '#cancel-subscription', description: 'Click "Cancel subscription"' },
		{ action: 'click', selector: '#confirm-cancel', description: 'Confirm cancellation' },
		{
			action: 'assertText',
			selector: '#cancel-result',
			contains: 'cancelled',
			description: 'Verify the confirmation message'
		},
		{ action: 'screenshot', name: 'confirmation', description: 'Capture proof of cancellation' }
	]
};

/**
 * Template showing the shape of a real recipe. Marked experimental and NOT
 * enabled by matching a real subscription name on purpose — real selectors must
 * be filled in and maintained, and the user logs in themselves (the `manual`
 * waitFor pauses for credentials/2FA). Kept here as documentation.
 */
export const REAL_RECIPE_TEMPLATE: CancelRecipe = {
	id: 'example-streaming',
	provider: 'Example Streaming (template)',
	experimental: true,
	steps: [
		{ action: 'goto', url: 'https://provider.example/account', description: 'Open your account' },
		{
			action: 'waitFor',
			selector: '[data-account-home]',
			manual: true,
			timeoutMs: 300000,
			description: 'Log in (and approve 2FA) in the browser window'
		},
		{ action: 'click', selector: 'a[href*="cancel"]', description: 'Go to cancellation' },
		{ action: 'click', selector: 'button.confirm-cancel', description: 'Confirm cancellation' },
		{
			action: 'assertText',
			selector: 'main',
			contains: 'cancelled',
			description: 'Verify confirmation'
		},
		{ action: 'screenshot', name: 'confirmation', description: 'Capture proof' }
	]
};

export const RECIPES: CancelRecipe[] = [DEMO_PROVIDER];

const BY_ID = new Map(RECIPES.map((r) => [r.id, r]));
const BY_PROVIDER = new Map(RECIPES.map((r) => [r.provider.toLowerCase(), r]));

export function getRecipe(id: string): CancelRecipe | undefined {
	return BY_ID.get(id);
}

/** Find an automated recipe for a subscription by its (case-insensitive) name. */
export function findRecipeForName(name: string): CancelRecipe | undefined {
	return BY_PROVIDER.get(name.trim().toLowerCase());
}
