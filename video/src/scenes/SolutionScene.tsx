import React from 'react'
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { PAI_THEME } from '../theme'

const LINES = [
  { text: 'Post what you need.', delay: 0 },
  { text: 'Offer what you have.', delay: 30 },
  { text: 'Connect directly.', delay: 60 },
]

const SolutionLine: React.FC<{ text: string; delay: number; index: number }> = ({
  text,
  delay,
  index,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const opacity = interpolate(frame, [delay, delay + 20], [0, 1], { extrapolateRight: 'clamp' })

  const translateY = spring({
    frame: frame - delay,
    fps,
    from: 40,
    to: 0,
    config: PAI_THEME.animation.springDefault,
  })

  const isLast = index === LINES.length - 1

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        marginBottom: isLast ? 0 : PAI_THEME.spacing.section,
      }}
    >
      <span
        style={{
          color: index === 0 ? PAI_THEME.colors.accent : PAI_THEME.colors.text,
          fontSize: index === 0 ? 64 : PAI_THEME.typography.subtitle.fontSize,
          fontWeight: 'bold',
          lineHeight: 1.2,
          display: 'block',
        }}
      >
        {text}
      </span>
    </div>
  )
}

export const SolutionScene: React.FC = () => {
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
      {LINES.map((line, i) => (
        <SolutionLine key={i} text={line.text} delay={line.delay} index={i} />
      ))}
    </AbsoluteFill>
  )
}
