/**
 * A cancellation recipe describes a provider's cancel flow as a list of plain,
 * JSON-serializable steps. The runner (a separate Node process) consumes these
 * generically, so adding support for a new provider means adding data, not code.
 */

export type CancelStep =
	| { action: 'goto'; url: string; description?: string }
	| { action: 'click'; selector: string; description?: string; timeoutMs?: number }
	| { action: 'fill'; selector: string; value: string; description?: string; timeoutMs?: number }
	| {
			action: 'waitFor';
			selector: string;
			description?: string;
			timeoutMs?: number;
			/** A step the user must complete in the visible browser (login, 2FA, captcha). */
			manual?: boolean;
	  }
	| {
			action: 'assertText';
			selector: string;
			contains: string;
			description?: string;
			timeoutMs?: number;
	  }
	| { action: 'screenshot'; name: string; description?: string };

export interface CancelRecipe {
	id: string;
	/** Display name; matched case-insensitively against a subscription's name. */
	provider: string;
	/** Real-provider recipes are inherently fragile — flagged so the UI can warn. */
	experimental: boolean;
	/** Relative `goto` URLs (starting with `/`) are resolved against the run's baseUrl. */
	steps: CancelStep[];
}

export type RunStatus = 'running' | 'waiting_user' | 'succeeded' | 'failed';

export type StepStatus = 'pending' | 'running' | 'waiting' | 'ok' | 'fail';

export interface RunStepView {
	index: number;
	action: string;
	description: string;
	status: StepStatus;
	message?: string;
}

export interface RunView {
	id: string;
	subscriptionId: number;
	recipeId: string;
	status: RunStatus;
	steps: RunStepView[];
	error?: string;
	screenshot?: string;
}
