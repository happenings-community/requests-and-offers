import React from 'react'
import { interpolate, useCurrentFrame } from 'remotion'
import { FeatureScene } from './FeatureScene'
import { PAI_THEME } from '../theme'

const BULLETS = [
  'Describe what you need',
  'Add service type tags',
  'Share contact info',
]

const FormField: React.FC<{ label: string; delay: number; placeholder: string }> = ({
  label,
  delay,
  placeholder,
}) => {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [delay, delay + 15], [0, 1], { extrapolateRight: 'clamp' })
  const width = interpolate(frame, [delay + 5, delay + 40], [0, 100], { extrapolateRight: 'clamp' })

  return (
    <div style={{ opacity, marginBottom: PAI_THEME.spacing.element }}>
      <div
        style={{
          color: PAI_THEME.colors.textMuted,
          fontSize: PAI_THEME.typography.caption.fontSize,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          backgroundColor: PAI_THEME.colors.background,
          borderRadius: PAI_THEME.borderRadius.small,
          border: `1px solid ${PAI_THEME.colors.accentMuted}60`,
          padding: '10px 14px',
          position: 'relative',
          overflow: 'hidden',
          height: 40,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            color: PAI_THEME.colors.textDark,
            fontSize: PAI_THEME.typography.small.fontSize,
            width: `${width}%`,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          }}
        >
          {placeholder}
        </div>
      </div>
    </div>
  )
}

const RequestMock: React.FC = () => {
  const frame = useCurrentFrame()
  const submitOpacity = interpolate(frame, [90, 110], [0, 1], { extrapolateRight: 'clamp' })

  return (
    <div>
      <div
        style={{
          color: PAI_THEME.colors.accent,
          fontSize: PAI_THEME.typography.heading.fontSize,
          fontWeight: 'bold',
          marginBottom: PAI_THEME.spacing.element,
          fontFamily: PAI_THEME.typography.fontFamily,
        }}
      >
        Post a Request
      </div>
      <FormField label="What do you need?" placeholder="e.g. Rust developer for 2 weeks..." delay={20} />
      <FormField label="Service type" placeholder="Software Development, Design..." delay={45} />
      <FormField label="Contact info" placeholder="your@email.com" delay={70} />
      <div
        style={{
          opacity: submitOpacity,
          backgroundColor: PAI_THEME.colors.accent,
          color: 'white',
          padding: '12px 24px',
          borderRadius: PAI_THEME.borderRadius.medium,
          textAlign: 'center',
          fontSize: PAI_THEME.typography.body.fontSize,
          fontWeight: 'bold',
          fontFamily: PAI_THEME.typography.fontFamily,
          marginTop: PAI_THEME.spacing.tight,
        }}
      >
        Post Request
      </div>
    </div>
  )
}

export const RequestScene: React.FC = () => (
  <FeatureScene
    title="Post a Request"
    bullets={BULLETS}
    mockContent={<RequestMock />}
  />
)
