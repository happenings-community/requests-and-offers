import React from 'react'
import { AbsoluteFill, Sequence } from 'remotion'
import { TitleScene } from './scenes/TitleScene'
import { ProblemScene } from './scenes/ProblemScene'
import { SolutionScene } from './scenes/SolutionScene'
import { RequestScene } from './scenes/RequestScene'
import { BrowseOffersScene } from './scenes/BrowseOffersScene'
import { TagDiscoveryScene } from './scenes/TagDiscoveryScene'
import { DirectContactScene } from './scenes/DirectContactScene'
import { TechScene } from './scenes/TechScene'
import { CTAScene } from './scenes/CTAScene'
import { PAI_THEME } from './theme'

/**
 * Requests & Offers hAppenings Presentation Video
 * Total: 2700 frames @ 30fps = 90 seconds
 *
 * Scene boundaries:
 *   TitleScene:       0 –  90  (3s)
 *   ProblemScene:    90 – 390  (10s)
 *   SolutionScene:  390 – 630  (8s)
 *   RequestScene:   630 – 930  (10s)
 *   BrowseOffers:   930 – 1230 (10s)
 *   TagDiscovery:  1230 – 1530 (10s)
 *   DirectContact: 1530 – 1830 (10s)
 *   TechScene:     1830 – 2430 (20s)
 *   CTAScene:      2430 – 2700 (9s)
 */
export const RequestsOffersVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: PAI_THEME.colors.background }}>
      <Sequence from={0} durationInFrames={90}>
        <TitleScene />
      </Sequence>

      <Sequence from={90} durationInFrames={300}>
        <ProblemScene />
      </Sequence>

      <Sequence from={390} durationInFrames={240}>
        <SolutionScene />
      </Sequence>

      <Sequence from={630} durationInFrames={300}>
        <RequestScene />
      </Sequence>

      <Sequence from={930} durationInFrames={300}>
        <BrowseOffersScene />
      </Sequence>

      <Sequence from={1230} durationInFrames={300}>
        <TagDiscoveryScene />
      </Sequence>

      <Sequence from={1530} durationInFrames={300}>
        <DirectContactScene />
      </Sequence>

      <Sequence from={1830} durationInFrames={600}>
        <TechScene />
      </Sequence>

      <Sequence from={2430} durationInFrames={270}>
        <CTAScene />
      </Sequence>
    </AbsoluteFill>
  )
}
