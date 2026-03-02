import React from 'react'
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { PAI_THEME } from '../theme'

export interface FeatureSceneProps {
  title: string
  bullets: string[]
  icon?: string
  accentColor?: string
  mockContent?: React.ReactNode
}

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
      }}
    >
      <span
        style={{
          color: PAI_THEME.colors.accent,
          fontSize: PAI_THEME.typography.body.fontSize,
          fontWeight: 'bold',
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        ✦
      </span>
      <span
        style={{
          color: PAI_THEME.colors.text,
          fontSize: PAI_THEME.typography.body.fontSize,
          lineHeight: PAI_THEME.typography.body.lineHeight,
        }}
      >
        {text}
      </span>
    </div>
  )
}

export const FeatureScene: React.FC<FeatureSceneProps> = ({
  title,
  bullets,
  accentColor = PAI_THEME.colors.accent,
  mockContent,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' })

  const cardScale = spring({
    frame: frame - 10,
    fps,
    from: 0.8,
    to: 1,
    config: PAI_THEME.animation.springDefault,
  })
  const cardOpacity = interpolate(frame, [10, 35], [0, 1], { extrapolateRight: 'clamp' })

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
      {/* Left: Title + bullet list */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <h2
          style={{
            opacity: titleOpacity,
            color: accentColor,
            fontSize: PAI_THEME.typography.heading.fontSize,
            fontWeight: PAI_THEME.typography.heading.fontWeight,
            lineHeight: PAI_THEME.typography.heading.lineHeight,
            marginBottom: PAI_THEME.spacing.section,
            marginTop: 0,
          }}
        >
          {title}
        </h2>
        {bullets.map((bullet, i) => (
          <BulletItem key={i} text={bullet} delay={20 + i * 25} />
        ))}
      </div>

      {/* Right: Mock UI card */}
      <div
        style={{
          flex: 1,
          opacity: cardOpacity,
          transform: `scale(${cardScale})`,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            backgroundColor: PAI_THEME.colors.backgroundAlt,
            borderRadius: PAI_THEME.borderRadius.large,
            border: `1px solid ${accentColor}40`,
            padding: PAI_THEME.spacing.section,
            width: '100%',
            maxWidth: 560,
            boxShadow: PAI_THEME.effects.boxShadowLarge,
          }}
        >
          {mockContent}
        </div>
      </div>
    </AbsoluteFill>
  )
}
