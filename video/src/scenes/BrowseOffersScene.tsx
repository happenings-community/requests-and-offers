import React from 'react'
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { FeatureScene } from './FeatureScene'
import { PAI_THEME } from '../theme'

const BULLETS = [
  'Filter by service type',
  'Search by keywords',
  'Find skilled community members',
]

const OFFER_CARDS = [
  { name: 'Maya R.', skill: 'UI/UX Design', tags: ['Figma', 'Prototyping'], delay: 15 },
  { name: 'Kai L.', skill: 'Rust Development', tags: ['WebAssembly', 'Holochain'], delay: 35 },
  { name: 'Sam T.', skill: 'Community Music', tags: ['Guitar', 'Jazz'], delay: 55 },
]

const OfferCard: React.FC<{
  name: string
  skill: string
  tags: string[]
  delay: number
}> = ({ name, skill, tags, delay }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const opacity = interpolate(frame, [delay, delay + 15], [0, 1], { extrapolateRight: 'clamp' })
  const translateX = spring({
    frame: frame - delay,
    fps,
    from: 40,
    to: 0,
    config: PAI_THEME.animation.springDefault,
  })

  return (
    <div
      style={{
        opacity,
        transform: `translateX(${translateX}px)`,
        backgroundColor: PAI_THEME.colors.background,
        borderRadius: PAI_THEME.borderRadius.medium,
        border: `1px solid ${PAI_THEME.colors.accent}30`,
        padding: '14px 18px',
        marginBottom: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        fontFamily: PAI_THEME.typography.fontFamily,
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: PAI_THEME.borderRadius.full,
          backgroundColor: `${PAI_THEME.colors.accent}30`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: PAI_THEME.colors.accentLight,
          fontSize: 18,
          fontWeight: 'bold',
          flexShrink: 0,
        }}
      >
        {name[0]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            color: PAI_THEME.colors.text,
            fontSize: PAI_THEME.typography.caption.fontSize,
            fontWeight: 'bold',
          }}
        >
          {name}
        </div>
        <div style={{ color: PAI_THEME.colors.textMuted, fontSize: PAI_THEME.typography.small.fontSize }}>
          {skill}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
          {tags.map((tag) => (
            <span
              key={tag}
              style={{
                backgroundColor: `${PAI_THEME.colors.accent}20`,
                color: PAI_THEME.colors.accentLight,
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: PAI_THEME.borderRadius.full,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

const BrowseMock: React.FC = () => {
  const frame = useCurrentFrame()
  const searchOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: 'clamp' })

  return (
    <div style={{ fontFamily: PAI_THEME.typography.fontFamily }}>
      {/* Search bar */}
      <div
        style={{
          opacity: searchOpacity,
          backgroundColor: PAI_THEME.colors.background,
          borderRadius: PAI_THEME.borderRadius.small,
          border: `1px solid ${PAI_THEME.colors.accent}50`,
          padding: '10px 14px',
          color: PAI_THEME.colors.textDark,
          fontSize: PAI_THEME.typography.small.fontSize,
          marginBottom: PAI_THEME.spacing.element,
        }}
      >
        🔍 Search offers...
      </div>

      {/* Offer cards */}
      {OFFER_CARDS.map((card) => (
        <OfferCard key={card.name} {...card} />
      ))}
    </div>
  )
}

export const BrowseOffersScene: React.FC = () => (
  <FeatureScene
    title="Browse Offers"
    bullets={BULLETS}
    mockContent={<BrowseMock />}
  />
)
