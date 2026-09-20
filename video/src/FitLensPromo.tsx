import React from 'react';
import { AbsoluteFill, Series } from 'remotion';
import type { PromoProps } from './schema';
import { Intro } from './scenes/Intro';
import { Feature } from './scenes/Feature';
import { Cta } from './scenes/Cta';

export const FitLensPromo: React.FC<PromoProps> = (props) => {
  const { timing, features, brand } = props;

  return (
    <AbsoluteFill style={{ backgroundColor: brand.bg }}>
      <Series>
        <Series.Sequence durationInFrames={timing.introDurationInFrames}>
          <Intro props={props} />
        </Series.Sequence>
        {features.map((feature, i) => (
          <Series.Sequence key={feature.title} durationInFrames={timing.featureDurationInFrames}>
            <Feature props={props} feature={feature} index={i} />
          </Series.Sequence>
        ))}
        <Series.Sequence durationInFrames={timing.ctaDurationInFrames}>
          <Cta props={props} />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
