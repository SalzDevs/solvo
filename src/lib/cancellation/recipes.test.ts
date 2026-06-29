import { describe, expect, it } from 'bun:test';
import { findRecipeForName, getRecipe, RECIPES } from './recipes';

describe('recipe registry', () => {
	it('finds the demo recipe by id', () => {
		expect(getRecipe('demo-provider')?.provider).toBe('Demo Provider');
	});

	it('matches a subscription name case-insensitively', () => {
		expect(findRecipeForName('demo provider')?.id).toBe('demo-provider');
		expect(findRecipeForName('  DEMO PROVIDER ')?.id).toBe('demo-provider');
	});

	it('returns undefined for unknown providers', () => {
		expect(findRecipeForName('Totally Unknown Service')).toBeUndefined();
		expect(getRecipe('nope')).toBeUndefined();
	});

	it('every recipe starts by navigating and ends by verifying', () => {
		for (const recipe of RECIPES) {
			expect(recipe.steps[0].action).toBe('goto');
			expect(recipe.steps.some((s) => s.action === 'assertText')).toBe(true);
		}
	});
});
