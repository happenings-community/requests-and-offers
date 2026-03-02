import React from 'react'
import { Composition } from 'remotion'
import { RequestsOffersVideo } from './RequestsOffersVideo'

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="RequestsOffersVideo"
      component={RequestsOffersVideo}
      durationInFrames={2700}
      fps={30}
      width={1920}
      height={1080}
    />
  )
}
