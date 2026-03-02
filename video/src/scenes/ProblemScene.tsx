import React from 'react'
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { PAI_THEME } from '../theme'

const BULLETS = [
  'Freelancers need work, but finding clients is hard',
  'Communities have skills to share, but coordination fails',
  'Platforms take control — and take a cut',
]

const BulletItem: React.FC<{ text: string; delay: number }> = ({ text, delay }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const opacity = interpolate(frame, [delay, delay + 20], [0, 1], { extrapolateRight: 'clamp' })

  const translateY = spring({
    frame: frame - delay,
    fps,
    from: 30,
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
          marginTop: 4,
          flexShrink: 0,
        }}
      >
        →
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

export const ProblemScene: React.FC = () => {
  const frame = useCurrentFrame()

  const headingOpacity = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: 'clamp' })

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
          color: PAI_THEME.colors.textMuted,
          fontSize: PAI_THEME.typography.heading.fontSize,
          fontWeight: PAI_THEME.typography.heading.fontWeight,
          lineHeight: PAI_THEME.typography.heading.lineHeight,
          marginBottom: PAI_THEME.spacing.section,
          marginTop: 0,
        }}
      >
        Communities need to coordinate skills and resources...
      </h2>

      {/* Bullet points staggered by 40 frames */}
      {BULLETS.map((bullet, i) => (
        <BulletItem key={i} text={bullet} delay={40 + i * 40} />
      ))}
    </AbsoluteFill>
  )
}
