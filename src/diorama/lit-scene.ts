/*
 * lit-scene.ts — wybór przepisu sceny ze światłem według niszy.
 */
import type { PaintArgs } from './scenery.ts';
import type { Look } from './looks.ts';
import type { LitEnv, LitRecipe } from './light.ts';
import { landRecipe } from './lit-land.ts';
import { seaRecipe, coastRecipe } from './lit-water.ts';
import { airRecipe } from './lit-air.ts';

export function litRecipe(a: PaintArgs, l: Look, env: LitEnv): LitRecipe {
  switch (a.niche) {
    case 'lad': return landRecipe(a, l, env);
    case 'woda': return seaRecipe(a, l, env);
    case 'przybrzeze': return coastRecipe(a, l, env);
    default: return airRecipe(a, l, env);
  }
}
