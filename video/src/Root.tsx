import React from 'react';
import { Composition } from 'remotion';
import { FitLensPromo } from './FitLensPromo';
import { defaultPromoProps, promoDurationInFrames, promoSchema } from './schema';

export const Root: React.FC = () => {
  return (
    <>
      {/* Vertical — TikTok / Reels / Shorts */}
      <Composition
        id="FitLensPromo"
        component={FitLensPromo}
        schema={promoSchema}
        defaultProps={defaultPromoProps}
        durationInFrames={promoDurationInFrames(defaultPromoProps)}
        fps={30}
        width={1080}
        height={1920}
        calculateMetadata={({ props }) => ({
          durationInFrames: promoDurationInFrames(props),
        })}
      />
      {/* Landscape — YouTube / web */}
      <Composition
        id="FitLensPromoLandscape"
        component={FitLensPromo}
        schema={promoSchema}
        defaultProps={defaultPromoProps}
        durationInFrames={promoDurationInFrames(defaultPromoProps)}
        fps={30}
        width={1920}
        height={1080}
        calculateMetadata={({ props }) => ({
          durationInFrames: promoDurationInFrames(props),
        })}
      />
    </>
  );
};
