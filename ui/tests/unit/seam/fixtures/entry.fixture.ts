/**
 * The three import forms the walk used to miss, in one file.
 *
 * Fixtures rather than assertions about real code, so each form is shown to be caught
 * on its own and a regression names which one broke. Relative paths, so they resolve
 * wherever this folder sits.
 */

// 1. A side-effect import, with no names at all.
import './side-effect.fixture';

// 2. A dynamic import, loaded on demand.
export async function later() {
  return import('./dynamic.fixture');
}

// 3. A dynamic import in a type position, which never runs.
export type Borrowed = import('./type-only.fixture').Shape;

// And the form that always worked, for contrast.
export { named } from './named.fixture';
