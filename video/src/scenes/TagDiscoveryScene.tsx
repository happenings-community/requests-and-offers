import React from 'react'
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { PAI_THEME } from '../theme'

const BULLETS = [
  'Tag-based discovery',
  'Community-validated categories',
  'Admin-moderated quality',
]

const ALL_TAGS = [
  { label: 'Rust', highlight: false, col: 0, row: 0 },
  { label: 'Music', highlight: false, col: 1, row: 0 },
  { label: 'Design', highlight: true, col: 2, row: 0 },
  { label: 'Writing', highlight: false, col: 0, row: 1 },
  { label: 'Teaching', highlight: false, col: 1, row: 1 },
  { label: 'Holochain', highlight: false, col: 2, row: 1 },
  { label: 'Legal', highlight: false, col: 0, row: 2 },
  { label: 'Agriculture', highlight: false, col: 1, row: 2 },
  { label: 'Translation', highlight: false, col: 2, row: 2 },
]

const BulletItem: React.FC<{ text: string; delay: number }> = ({ text, delay }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const opacity = interpolate(frame, [delay, delay + 20], [0, 1], { extrapolateRight: 'clamp' })
  const translateY = spring({
    frame: frame - delay,
    fps,
    from: 25,
    to: 0,
    config: PAI_THEME.animation.springDefault,
  })

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        display: 'flex',
        alignItems: 'flex-start',
        gap: PAI_THEME.spacing.tight,
        marginBottom: PAI_THEME.spacing.element,
        fontFamily: PAI_THEME.typography.fontFamily,
      }}
    >
      <span style={{ color: PAI_THEME.colors.accent, fontSize: PAI_THEME.typography.body.fontSize, fontWeight: 'bold', flexShrink: 0 }}>
        ✦
      </span>
      <span style={{ color: PAI_THEME.colors.text, fontSize: PAI_THEME.typography.body.fontSize, lineHeight: PAI_THEME.typography.body.lineHeight }}>
        {text}
      </span>
    </div>
  )
}

const TagChip: React.FC<{
  label: string
  highlight: boolean
  delay: number
}> = ({ label, highlight, delay }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const scale = spring({
    frame: frame - delay,
    fps,
    from: 0,
    to: 1,
    config: PAI_THEME.animation.springBouncy,
  })
  const opacity = interpolate(frame, [delay, delay + 15], [0, 1], { extrapolateRight: 'clamp' })

  // Highlight pulses: subtle glow oscillation using interpolate with clamped loop
  const pulseProgress = interpolate(
    (frame - delay - 30) % 60,
    [0, 30, 60],
    [0, 1, 0],
    { extrapolateRight: 'clamp' }
  )
  const glowOpacity = highlight ? 0.4 + pulseProgress * 0.6 : 0

  return (
    <div
      style={{
        opacity,
        transform: `scale(${scale})`,
        backgroundColor: highlight ? `${PAI_THEME.colors.accent}25` : `${PAI_THEME.colors.backgroundAlt}`,
        color: highlight ? PAI_THEME.colors.accentLight : PAI_THEME.colors.textMuted,
        border: `1px solid ${highlight ? PAI_THEME.colors.accent : PAI_THEME.colors.textDark + '40'}`,
        borderRadius: PAI_THEME.borderRadius.full,
        padding: '10px 22px',
        fontSize: PAI_THEME.typography.body.fontSize,
        fontWeight: highlight ? 'bold' : 'normal',
        fontFamily: PAI_THEME.typography.fontFamily,
        boxShadow: highlight
          ? `0 0 ${16 + glowOpacity * 20}px rgba(139, 92, 246, ${glowOpacity})`
          : 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </div>
  )
}

export const TagDiscoveryScene: React.FC = () => {
  const frame = useCurrentFrame()
  const headingOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill
      style={{
        backgroundColor: PAI_THEME.colors.background,
        fontFamily: PAI_THEME.typography.fontFamily,
        padding: PAI_THEME.spacing.page,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: PAI_THEME.spacing.section,
      }}
    >
      {/* Left: heading + bullets */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <h2
          style={{
            opacity: headingOpacity,
            color: PAI_THEME.colors.accent,
            fontSize: PAI_THEME.typography.heading.fontSize,
            fontWeight: PAI_THEME.typography.heading.fontWeight,
            lineHeight: PAI_THEME.typography.heading.lineHeight,
            marginBottom: PAI_THEME.spacing.section,
            marginTop: 0,
          }}
        >
          Tag Discovery
        </h2>
        {BULLETS.map((b, i) => (
          <BulletItem key={i} text={b} delay={20 + i * 25} />
        ))}
      </div>

      {/* Right: tag cloud */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: PAI_THEME.spacing.element,
        }}
      >
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            style={{
              display: 'flex',
              gap: PAI_THEME.spacing.element,
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            {ALL_TAGS.filter((t) => t.row === row).map((tag, i) => (
              <TagChip
                key={tag.label}
                label={tag.label}
                highlight={tag.highlight}
                delay={15 + row * 20 + i * 8}
              />
            ))}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  )
}
