import type { CustomThemeConfig } from '@skeletonlabs/tw-plugin';

const happeningTheme: CustomThemeConfig = {
  name: 'happening-theme',
  properties: {
    // =~= Theme Properties =~=
    '--theme-font-family-base': `system-ui`,
    '--theme-font-family-heading': `system-ui`,
    '--theme-font-color-base': '0 0 0',
    '--theme-font-color-dark': '255 255 255',
    '--theme-rounded-base': '9999px',
    '--theme-rounded-container': '8px',
    '--theme-border-base': '1px',
    // =~= Theme On-X Colors =~=
    '--on-primary': '255 255 255',
    '--on-secondary': '0 0 0',
    '--on-tertiary': '0 0 0',
    '--on-success': '0 0 0',
    '--on-warning': '0 0 0',
    '--on-error': '255 255 255',
    '--on-surface': '255 255 255',
    // =~= Theme Colors  =~=
    // primary | #4720b7
    '--color-primary-50': '227 222 244', // #e3def4
    '--color-primary-100': '218 210 241', // #dad2f1
    '--color-primary-200': '209 199 237', // #d1c7ed
    '--color-primary-300': '181 166 226', // #b5a6e2
    '--color-primary-400': '126 99 205', // #7e63cd
    '--color-primary-500': '71 32 183', // #4720b7
    '--color-primary-600': '64 29 165', // #401da5
    '--color-primary-700': '53 24 137', // #351889
    '--color-primary-800': '43 19 110', // #2b136e
    '--color-primary-900': '35 16 90', // #23105a
    // secondary | #ebc634
    '--color-secondary-50': '252 246 225', // #fcf6e1
    '--color-secondary-100': '251 244 214', // #fbf4d6
    '--color-secondary-200': '250 241 204', // #faf1cc
    '--color-secondary-300': '247 232 174', // #f7e8ae
    '--color-secondary-400': '241 215 113', // #f1d771
    '--color-secondary-500': '235 198 52', // #ebc634
    '--color-secondary-600': '212 178 47', // #d4b22f
    '--color-secondary-700': '176 149 39', // #b09527
    '--color-secondary-800': '141 119 31', // #8d771f
    '--color-secondary-900': '115 97 25', // #736119
    // tertiary | #0EA5E9
    '--color-tertiary-50': '219 242 252', // #dbf2fc
    '--color-tertiary-100': '207 237 251', // #cfedfb
    '--color-tertiary-200': '195 233 250', // #c3e9fa
    '--color-tertiary-300': '159 219 246', // #9fdbf6
    '--color-tertiary-400': '86 192 240', // #56c0f0
    '--color-tertiary-500': '14 165 233', // #0EA5E9
    '--color-tertiary-600': '13 149 210', // #0d95d2
    '--color-tertiary-700': '11 124 175', // #0b7caf
    '--color-tertiary-800': '8 99 140', // #08638c
    '--color-tertiary-900': '7 81 114', // #075172
    // success | #84cc16
    '--color-success-50': '237 247 220', // #edf7dc
    '--color-success-100': '230 245 208', // #e6f5d0
    '--color-success-200': '224 242 197', // #e0f2c5
    '--color-success-300': '206 235 162', // #ceeba2
    '--color-success-400': '169 219 92', // #a9db5c
    '--color-success-500': '132 204 22', // #84cc16
    '--color-success-600': '119 184 20', // #77b814
    '--color-success-700': '99 153 17', // #639911
    '--color-success-800': '79 122 13', // #4f7a0d
    '--color-success-900': '65 100 11', // #41640b
    // warning | #ff8800
    '--color-warning-50': '255 237 217', // #ffedd9
    '--color-warning-100': '255 231 204', // #ffe7cc
    '--color-warning-200': '255 225 191', // #ffe1bf
    '--color-warning-300': '255 207 153', // #ffcf99
    '--color-warning-400': '255 172 77', // #ffac4d
    '--color-warning-500': '255 136 0', // #ff8800
    '--color-warning-600': '230 122 0', // #e67a00
    '--color-warning-700': '191 102 0', // #bf6600
    '--color-warning-800': '153 82 0', // #995200
    '--color-warning-900': '125 67 0', // #7d4300
    // error | #d21919
    '--color-error-50': '248 221 221', // #f8dddd
    '--color-error-100': '246 209 209', // #f6d1d1
    '--color-error-200': '244 198 198', // #f4c6c6
    '--color-error-300': '237 163 163', // #eda3a3
    '--color-error-400': '224 94 94', // #e05e5e
    '--color-error-500': '210 25 25', // #d21919
    '--color-error-600': '189 23 23', // #bd1717
    '--color-error-700': '158 19 19', // #9e1313
    '--color-error-800': '126 15 15', // #7e0f0f
    '--color-error-900': '103 12 12', // #670c0c
    // surface | #495a8f
    '--color-surface-50': '228 230 238', // #e4e6ee
    '--color-surface-100': '219 222 233', // #dbdee9
    '--color-surface-200': '210 214 227', // #d2d6e3
    '--color-surface-300': '182 189 210', // #b6bdd2
    '--color-surface-400': '128 140 177', // #808cb1
    '--color-surface-500': '73 90 143', // #495a8f
    '--color-surface-600': '66 81 129', // #425181
    '--color-surface-700': '55 68 107', // #37446b
    '--color-surface-800': '44 54 86', // #2c3656
    '--color-surface-900': '36 44 70' // #242c46
  }
};

export default happeningTheme;
