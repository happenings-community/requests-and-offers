import { join } from 'path';
import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';
import { skeleton } from '@skeletonlabs/tw-plugin';
import happeningTheme from './src/happening_theme';

export default {
  darkMode: 'class',
  content: [
    './src/**/*.{html,js,svelte,ts}',
    join(require.resolve('@skeletonlabs/skeleton'), '../**/*.{html,js,svelte,ts}')
  ],
  theme: {
    // Two content widths, one place (dogfooding, 21 November).
    // `container` is the page width. Tailwind's last step is 1536px, which is the whole
    // window on a 1920px screen at 125% scaling, so listings ran edge to edge. It now
    // stops at 1280px and `mx-auto` centres it, as the design system centres its pages.
    // Below 1280px the steps are Tailwind's own, so phones and tablets are unchanged.
    container: {
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px'
      }
    },
    extend: {
      // `max-w-reading` is the reading column (a conversation, an exchange, a form),
      // set on a `container` page.
      maxWidth: {
        reading: '48rem'
      }
    }
  },
  plugins: [
    forms,
    typography,
    skeleton({
      themes: {
        preset: [
          {
            name: 'crimson',
            enhancements: true
          }
        ],
        custom: [happeningTheme]
      }
    })
  ]
} satisfies Config;
