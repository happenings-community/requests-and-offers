import React from 'react'
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { PAI_THEME } from '../theme'

const STATS = [
  {
    icon: '⬡',
    label: 'Peer-to-Peer',
    desc: 'Every node is equal. No master server.',
    delay: 40,
  },
  {
    icon: '⊗',
    label: 'No Central Server',
    desc: "Data lives on your device, not a company's.",
    delay: 70,
  },
  {
    icon: '◎',
    label: 'Community-Owned',
    desc: 'Governed by users, not shareholders.',
    delay: 100,
  },
]

const StatBox: React.FC<{
  icon: string
  label: string
  desc: string
  delay: number
}> = ({ icon, label, desc, delay }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const scale = spring({
    frame: frame - delay,
    fps,
    from: 0.7,
    to: 1,
    config: PAI_THEME.animation.springDefault,
  })
  const opacity = interpolate(frame, [delay, delay + 20], [0, 1], { extrapolateRight: 'clamp' })

  return (
    <div
      style={{
        opacity,
        transform: `scale(${scale})`,
        backgroundColor: PAI_THEME.colors.backgroundAlt,
        borderRadius: PAI_THEME.borderRadius.large,
        border: `1px solid ${PAI_THEME.colors.accent}50`,
        padding: `${PAI_THEME.spacing.section}px`,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        fontFamily: PAI_THEME.typography.fontFamily,
        boxShadow: PAI_THEME.effects.boxShadowLarge,
      }}
    >
      <div
        style={{
          fontSize: 48,
          marginBottom: PAI_THEME.spacing.element,
          color: PAI_THEME.colors.accent,
        }}
      >
        {icon}
      </div>
      <div
        style={{
          color: PAI_THEME.colors.text,
          fontSize: PAI_THEME.typography.heading.fontSize,
          fontWeight: PAI_THEME.typography.heading.fontWeight,
          marginBottom: PAI_THEME.spacing.tight,
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: PAI_THEME.colors.textMuted,
          fontSize: PAI_THEME.typography.body.fontSize,
          lineHeight: PAI_THEME.typography.body.lineHeight,
        }}
      >
        {desc}
      </div>
    </div>
  )
}

export const TechScene: React.FC = () => {
  const frame = useCurrentFrame()
  const headingOpacity = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: 'clamp' })
  const subOpacity = interpolate(frame, [15, 35], [0, 1], { extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill
      style={{
        backgroundColor: PAI_THEME.colors.background,
        fontFamily: PAI_THEME.typography.fontFamily,
        padding: PAI_THEME.spacing.page,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      {/* Heading */}
      <h2
        style={{
          opacity: headingOpacity,
          color: PAI_THEME.colors.text,
          fontSize: PAI_THEME.typography.title.fontSize,
          fontWeight: PAI_THEME.typography.title.fontWeight,
          lineHeight: PAI_THEME.typography.title.lineHeight,
          textAlign: 'center',
          margin: 0,
          marginBottom: PAI_THEME.spacing.tight,
        }}
      >
        Built on Holochain
      </h2>

      <p
        style={{
          opacity: subOpacity,
          color: PAI_THEME.colors.textMuted,
          fontSize: PAI_THEME.typography.body.fontSize,
          textAlign: 'center',
          margin: 0,
          marginBottom: PAI_THEME.spacing.section,
        }}
      >
        Agent-centric infrastructure for truly distributed apps
      </p>

      {/* Stat boxes */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: PAI_THEME.spacing.section,
          alignItems: 'stretch',
        }}
      >
        {STATS.map((stat) => (
          <StatBox key={stat.label} {...stat} />
        ))}
      </div>
    </AbsoluteFill>
  )
}
