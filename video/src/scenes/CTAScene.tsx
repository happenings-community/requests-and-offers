import React from 'react'
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { PAI_THEME } from '../theme'

export const CTAScene: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Entire scene fades in with 45-frame slowFade
  const sceneOpacity = interpolate(frame, [0, 45], [0, 1], { extrapolateRight: 'clamp' })

  // "Join the community" fades in
  const headingOpacity = interpolate(frame, [20, 50], [0, 1], { extrapolateRight: 'clamp' })

  // URL springs in
  const urlScale = spring({
    frame: frame - 40,
    fps,
    from: 0.7,
    to: 1,
    config: PAI_THEME.animation.springDefault,
  })
  const urlOpacity = interpolate(frame, [40, 65], [0, 1], { extrapolateRight: 'clamp' })

  // Purple glow circle pulses
  const glowSize = interpolate(frame % 90, [0, 45, 90], [200, 260, 200], {
    extrapolateRight: 'clamp',
  })
  const glowOpacity = interpolate(frame, [0, 30], [0, 0.25], { extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill
      style={{
        backgroundColor: PAI_THEME.colors.background,
        fontFamily: PAI_THEME.typography.fontFamily,
        opacity: sceneOpacity,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background glow circle */}
      <div
        style={{
          position: 'absolute',
          width: glowSize,
          height: glowSize,
          borderRadius: PAI_THEME.borderRadius.full,
          backgroundColor: PAI_THEME.colors.accent,
          opacity: glowOpacity,
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />

      {/* Holochain logo placeholder */}
      <div
        style={{
          width: 100,
          height: 100,
          borderRadius: PAI_THEME.borderRadius.full,
          border: `3px solid ${PAI_THEME.colors.accent}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: PAI_THEME.spacing.section,
          color: PAI_THEME.colors.accent,
          fontSize: 48,
          fontWeight: 'bold',
          boxShadow: PAI_THEME.effects.glow,
          opacity: headingOpacity,
        }}
      >
        ⬡
      </div>

      {/* Join the community */}
      <h2
        style={{
          opacity: headingOpacity,
          color: PAI_THEME.colors.text,
          fontSize: PAI_THEME.typography.title.fontSize,
          fontWeight: PAI_THEME.typography.title.fontWeight,
          lineHeight: PAI_THEME.typography.title.lineHeight,
          margin: 0,
          marginBottom: PAI_THEME.spacing.element,
          textAlign: 'center',
          textShadow: PAI_THEME.effects.textShadow,
        }}
      >
        Join the community
      </h2>

      {/* URL */}
      <div
        style={{
          opacity: urlOpacity,
          transform: `scale(${urlScale})`,
          color: PAI_THEME.colors.accent,
          fontSize: PAI_THEME.typography.subtitle.fontSize,
          fontWeight: '600',
          letterSpacing: '0.05em',
          textShadow: PAI_THEME.effects.glow,
        }}
      >
        happenings.community
      </div>
    </AbsoluteFill>
  )
}
