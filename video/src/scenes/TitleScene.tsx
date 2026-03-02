import React from 'react'
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { PAI_THEME } from '../theme'

export const TitleScene: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Title fades in opacity 0→1 over frames 0–30
  const titleOpacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' })

  // Subtitle springs in at frame 20
  const subtitleScale = spring({
    frame: frame - 20,
    fps,
    from: 0.85,
    to: 1,
    config: PAI_THEME.animation.springDefault,
  })
  const subtitleOpacity = interpolate(frame, [20, 45], [0, 1], { extrapolateRight: 'clamp' })

  // Purple horizontal rule animates width 0→600px via interpolate
  const ruleWidth = interpolate(frame, [10, 60], [0, 600], { extrapolateRight: 'clamp' })
  const ruleOpacity = interpolate(frame, [10, 40], [0, 1], { extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill
      style={{
        backgroundColor: PAI_THEME.colors.background,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: PAI_THEME.typography.fontFamily,
      }}
    >
      {/* Title */}
      <h1
        style={{
          opacity: titleOpacity,
          color: PAI_THEME.colors.text,
          fontSize: PAI_THEME.typography.title.fontSize,
          fontWeight: PAI_THEME.typography.title.fontWeight,
          lineHeight: PAI_THEME.typography.title.lineHeight,
          margin: 0,
          textAlign: 'center',
          textShadow: PAI_THEME.effects.textShadow,
        }}
      >
        Requests &amp; Offers
      </h1>

      {/* Purple horizontal rule */}
      <div
        style={{
          width: ruleWidth,
          height: 3,
          backgroundColor: PAI_THEME.colors.accent,
          opacity: ruleOpacity,
          marginTop: PAI_THEME.spacing.element,
          marginBottom: PAI_THEME.spacing.element,
          borderRadius: PAI_THEME.borderRadius.full,
          boxShadow: PAI_THEME.effects.glow,
        }}
      />

      {/* Subtitle */}
      <p
        style={{
          opacity: subtitleOpacity,
          transform: `scale(${subtitleScale})`,
          color: PAI_THEME.colors.accentLight,
          fontSize: PAI_THEME.typography.subtitle.fontSize,
          fontWeight: PAI_THEME.typography.subtitle.fontWeight,
          lineHeight: PAI_THEME.typography.subtitle.lineHeight,
          margin: 0,
          textAlign: 'center',
          letterSpacing: '0.05em',
        }}
      >
        Connect. Exchange. Thrive.
      </p>
    </AbsoluteFill>
  )
}
