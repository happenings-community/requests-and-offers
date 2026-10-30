/**
 * Contrast of the colour pairings chosen for issue #210, computed from the RGB
 * triples in `happening_theme.ts`, so a change to the theme that breaks one of
 * them fails here rather than on someone's screen.
 *
 * Backgrounds come from the theme and from Skeleton's own styles:
 * - body: surface-50 (light), surface-900 (dark); dark mode is only switched on
 *   in the admin section, whose main panel is surface-800;
 * - `.card` and `.table`: surface-100 (light), surface-800 (dark);
 * - `.variant-soft`: surface-400 at 20% over its parent (light), surface-500 at
 *   20% over surface-800 (dark);
 * - `.table-hover` rows: surface-500 at 20% on hover;
 * - `.hcron-modal`: surface-500 (light), surface-800 (dark).
 *
 * Thresholds are WCAG 2.2 AA: 4.5 for normal text, 3 for non-text graphics.
 */
import { describe, expect, it } from 'vitest';
import happeningTheme from '../../../src/happening_theme';

type RGB = readonly [number, number, number];

const props = happeningTheme.properties as Record<string, string>;

function token(name: string): RGB {
  const key = name.startsWith('on-') ? `--${name}` : `--color-${name}`;
  const value = props[key];
  if (!value) throw new Error(`No theme token ${key}`);
  const [r, g, b] = value.split(' ').map(Number);
  return [r, g, b];
}

const WHITE: RGB = [255, 255, 255];

/** `top` at `alpha` composited over `under`, as the browser paints it. */
function over(top: RGB, alpha: number, under: RGB): RGB {
  return [0, 1, 2].map((i) =>
    Math.round(alpha * top[i] + (1 - alpha) * under[i])
  ) as unknown as RGB;
}

function luminance([r, g, b]: RGB): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const s = (step: number) => token(`surface-${step}`);

// Backgrounds, named as they are painted.
const bg = {
  body: s(50),
  card: s(100),
  softLight: over(s(400), 0.2, s(50)),
  softOnCard: over(s(400), 0.2, s(100)),
  tableHoverLight: over(s(500), 0.2, s(100)),
  adminMain: s(800),
  bodyDark: s(900),
  softDark: over(s(500), 0.2, s(800)),
  modal: s(500),
  modalDark: s(800),
  modalCard: s(600),
  modalTint: over(token('primary-500'), 0.2, s(500)),
  pickerCard: s(700)
};

type Pairing = { site: string; fg: RGB; bg: RGB; min: number };

const TEXT = 4.5;
const GRAPHIC = 3;

const pairings: Pairing[] = [
  // Avatar initials: variant-filled-secondary (secondary-500 with --on-secondary).
  { site: 'avatar initials', fg: token('on-secondary'), bg: token('secondary-500'), min: TEXT },

  // .hcron-modal, surface-300 and surface-400 moved to surface-200.
  { site: 'modal text, light', fg: s(200), bg: bg.modal, min: TEXT },
  { site: 'modal text, dark', fg: s(200), bg: bg.modalDark, min: TEXT },
  { site: 'ContactModal card, light', fg: s(200), bg: bg.modalCard, min: TEXT },
  { site: 'ContactModal card, dark', fg: s(200), bg: bg.softDark, min: TEXT },
  { site: 'ContactModal tinted note', fg: s(200), bg: bg.modalTint, min: TEXT },
  { site: 'picker email', fg: s(200), bg: bg.pickerCard, min: TEXT },
  { site: 'picker email, hover', fg: s(200), bg: s(600), min: TEXT },

  // Light-context muted text: surface-500, with surface-300 in dark mode.
  { site: 'muted text on body', fg: s(500), bg: bg.body, min: TEXT },
  { site: 'muted text on white', fg: s(500), bg: WHITE, min: TEXT },
  { site: 'muted text on card', fg: s(500), bg: bg.card, min: TEXT },
  { site: 'MarkdownField preview, light', fg: s(600), bg: bg.softLight, min: TEXT },
  { site: 'MarkdownField preview in a card', fg: s(600), bg: bg.softOnCard, min: TEXT },
  { site: 'muted text, dark admin', fg: s(300), bg: bg.adminMain, min: TEXT },
  { site: 'muted text, dark body', fg: s(300), bg: bg.bodyDark, min: TEXT },
  { site: 'MarkdownField preview, dark', fg: s(300), bg: bg.softDark, min: TEXT },

  // OrganizationsTable rows: surface-700, with surface-300 in dark mode.
  { site: 'OrganizationsTable row', fg: s(700), bg: bg.card, min: TEXT },
  { site: 'OrganizationsTable row, hover', fg: s(700), bg: bg.tableHoverLight, min: TEXT },
  { site: 'OrganizationsTable row, dark', fg: s(300), bg: bg.adminMain, min: TEXT },
  { site: 'OrganizationsTable row, dark hover', fg: s(300), bg: bg.softDark, min: TEXT },

  // MyListings "Technical details" summary on hover.
  { site: 'MyListings summary hover', fg: s(700), bg: bg.card, min: TEXT },

  // ProfileStatusIndicator loading state.
  { site: 'ProfileStatusIndicator loading', fg: s(600), bg: bg.card, min: TEXT },

  // Admin layout status lines on the admin panel.
  { site: 'admin layout status', fg: s(300), bg: bg.adminMain, min: TEXT },

  // hREA test page external-link icons (non-text graphic).
  { site: 'hREA link icon, light', fg: s(500), bg: bg.card, min: GRAPHIC },
  { site: 'hREA link icon, dark', fg: s(400), bg: bg.adminMain, min: GRAPHIC }
];

describe('theme contrast (#210)', () => {
  it('reproduces the ratios measured in the issue', () => {
    expect(contrast(WHITE, token('secondary-500'))).toBeCloseTo(1.66, 2);
    expect(contrast(s(400), bg.modal)).toBeCloseTo(2.01, 2);
    expect(contrast(s(300), bg.modal)).toBeCloseTo(3.56, 2);
    expect(contrast(s(400), bg.body)).toBeCloseTo(2.67, 2);
    expect(contrast(s(400), WHITE)).toBeCloseTo(3.33, 2);
  });

  it.each(pairings)('$site meets $min:1', ({ fg, bg, min }) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(min);
  });
});
