/**
 * Fill `{token}` placeholders in a member-facing string.
 *
 * **Neutral on purpose, like `utils/error-shape.ts` in H1a.** It began in
 * `messaging.strings.ts` because messaging was the only feature with a strings module.
 * Now the exchange strings need it too, and an exchange module may not reach a messaging
 * one (R121, brief H's rule 1), so the shared piece moves to a module that belongs to
 * neither. `messaging.strings.ts` re-exports it, so nothing that imports it from there
 * has to change.
 *
 * Placeholders are filled here rather than by concatenation at the call site, so a
 * translator — or Anita — can move `{name}` within its sentence.
 */

/** Replace every `{token}` with the matching value. Unknown tokens are left alone. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole
  );
}
