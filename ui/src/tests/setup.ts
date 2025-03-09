// Mock Svelte 5 runes globally
// Create mock functions with the required properties
const $stateFunction = <T>(initialValue: T): T => initialValue;
$stateFunction.raw = <T>(value: T): T => value;
$stateFunction.snapshot = <T>(value: T): T => value;

const $derivedFunction = <T>(fn: () => T): T => fn();
$derivedFunction.by = <T>(fn: () => T): T => fn();

const $effectFunction = (fn: () => void | (() => void)): void => { fn(); };
$effectFunction.pre = (fn: () => void | (() => void)): void => { fn(); };
$effectFunction.tracking = (fn: () => void | (() => void)): void => { fn(); };
$effectFunction.root = (fn: () => void | (() => void)): void => { fn(); };

// Assign to globalThis with type assertions
globalThis.$state = $stateFunction as any;
globalThis.$derived = $derivedFunction as any;
globalThis.$effect = $effectFunction as any;
