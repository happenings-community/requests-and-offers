/**
 * PAI Theme for Remotion — Requests & Offers Video
 * Derived from ~/.claude/skills/Media/Remotion/Tools/Theme.ts
 */

export const PAI_THEME = {
  colors: {
    background: '#0f172a',
    backgroundAlt: '#1e293b',
    backgroundDark: '#020617',
    accent: '#8b5cf6',
    accentLight: '#a78bfa',
    accentDark: '#7c3aed',
    accentMuted: '#6366f1',
    text: '#f1f5f9',
    textMuted: '#94a3b8',
    textDark: '#64748b',
    paperGround: '#F5F5F0',
    coolWash: 'rgba(139, 92, 246, 0.1)',
    warmWash: 'rgba(251, 191, 36, 0.1)',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  },
  typography: {
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontFamilyMono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
    title: { fontSize: 72, fontWeight: 'bold' as const, lineHeight: 1.1 },
    subtitle: { fontSize: 48, fontWeight: '600' as const, lineHeight: 1.2 },
    heading: { fontSize: 36, fontWeight: '600' as const, lineHeight: 1.3 },
    body: { fontSize: 24, fontWeight: 'normal' as const, lineHeight: 1.5 },
    caption: { fontSize: 18, fontWeight: 'normal' as const, lineHeight: 1.4 },
    small: { fontSize: 14, fontWeight: 'normal' as const, lineHeight: 1.4 },
  },
  animation: {
    springFast: { damping: 15, stiffness: 150 },
    springDefault: { damping: 12, stiffness: 100 },
    springSlow: { damping: 10, stiffness: 80 },
    springBouncy: { damping: 8, stiffness: 120 },
    fadeFrames: 30,
    quickFade: 15,
    slowFade: 45,
    staggerDelay: 10,
    staggerFast: 5,
    staggerSlow: 15,
  },
  spacing: {
    page: 100,
    section: 60,
    element: 30,
    tight: 15,
    paragraphGap: 24,
    listItemGap: 16,
  },
  effects: {
    textShadow: '0 2px 4px rgba(0,0,0,0.5)',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
    boxShadowLarge: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
    glow: '0 0 20px rgba(139, 92, 246, 0.5)',
  },
  borderRadius: {
    small: 8,
    medium: 16,
    large: 24,
    full: 9999,
  },
} as const

export type PAITheme = typeof PAI_THEME
