import React from 'react'
import { interpolate, useCurrentFrame } from 'remotion'
import { FeatureScene } from './FeatureScene'
import { PAI_THEME } from '../theme'

const BULLETS = [
  'No intermediary fees',
  'Direct communication',
  'Your data stays yours',
]

const ContactRow: React.FC<{ icon: string; label: string; value: string; delay: number }> = ({
  icon,
  label,
  value,
  delay,
}) => {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [delay, delay + 20], [0, 1], { extrapolateRight: 'clamp' })
  const valueWidth = interpolate(frame, [delay + 10, delay + 50], [0, 100], {
    extrapolateRight: 'clamp',
  })

  return (
    <div
      style={{
        opacity,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        marginBottom: PAI_THEME.spacing.element,
        fontFamily: PAI_THEME.typography.fontFamily,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: PAI_THEME.borderRadius.full,
          backgroundColor: `${PAI_THEME.colors.accent}20`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            color: PAI_THEME.colors.textMuted,
            fontSize: PAI_THEME.typography.small.fontSize,
            marginBottom: 3,
          }}
        >
          {label}
        </div>
        <div
          style={{
            overflow: 'hidden',
            width: `${valueWidth}%`,
            color: PAI_THEME.colors.text,
            fontSize: PAI_THEME.typography.caption.fontSize,
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
          }}
        >
          {value}
        </div>
      </div>
    </div>
  )
}

const ContactMock: React.FC = () => {
  const frame = useCurrentFrame()
  const headerOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: 'clamp' })

  return (
    <div style={{ fontFamily: PAI_THEME.typography.fontFamily }}>
      <div
        style={{
          opacity: headerOpacity,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          marginBottom: PAI_THEME.spacing.section,
          paddingBottom: PAI_THEME.spacing.element,
          borderBottom: `1px solid ${PAI_THEME.colors.accent}30`,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: PAI_THEME.borderRadius.full,
            backgroundColor: `${PAI_THEME.colors.accent}30`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: PAI_THEME.colors.accentLight,
            fontSize: 24,
            fontWeight: 'bold',
          }}
        >
          M
        </div>
        <div>
          <div
            style={{ color: PAI_THEME.colors.text, fontSize: PAI_THEME.typography.body.fontSize, fontWeight: 'bold' }}
          >
            Maya R.
          </div>
          <div style={{ color: PAI_THEME.colors.textMuted, fontSize: PAI_THEME.typography.caption.fontSize }}>
            UI/UX Designer
          </div>
        </div>
      </div>

      <ContactRow icon="✉️" label="Email" value="maya@community.net" delay={30} />
      <ContactRow icon="💬" label="Matrix" value="@maya:matrix.org" delay={55} />
      <ContactRow icon="🌐" label="Website" value="mayadesigns.coop" delay={80} />
    </div>
  )
}

export const DirectContactScene: React.FC = () => (
  <FeatureScene
    title="Direct Contact"
    bullets={BULLETS}
    mockContent={<ContactMock />}
  />
)
