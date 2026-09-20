import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { PromoProps } from '../schema';

interface Props {
  props: PromoProps;
  feature: PromoProps['features'][number];
  index: number;
}

export const Feature: React.FC<Props> = ({ props, feature, index }) => {
  const frame = useCurrentFrame();
  const { fps, height, durationInFrames } = useVideoConfig();
  const { brand } = props;

  const iconIn = spring({ frame, fps, config: { damping: 200, stiffness: 140 } });
  const titleIn = spring({ frame: frame - 6, fps, config: { damping: 200, stiffness: 110 } });
  const descOpacity = interpolate(frame, [18, 34], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // Exit: fade the whole scene in its final 10 frames so cuts don't pop.
  const sceneOpacity = interpolate(
    frame,
    [durationInFrames - 10, durationInFrames - 1],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const underlineW = interpolate(frame, [10, 30], [0, 260], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const base = height / 1920;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: brand.bg,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: sceneOpacity,
        padding: 120 * base,
      }}
    >
      <div
        style={{
          fontSize: 44 * base,
          color: brand.primary,
          fontFamily: 'Helvetica, Arial, sans-serif',
          fontWeight: 700,
          marginBottom: 30 * base,
          opacity: descOpacity,
          letterSpacing: 4 * base,
        }}
      >
        {String(index + 1).padStart(2, '0')}
      </div>
      <div
        style={{
          width: 220 * base,
          height: 220 * base,
          borderRadius: 60 * base,
          backgroundColor: brand.card,
          border: `${3 * base}px solid ${brand.primary}33`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 110 * base,
          transform: `scale(${0.9 + iconIn * 0.1})`,
          opacity: iconIn,
        }}
      >
        {feature.icon}
      </div>
      <h2
        style={{
          color: brand.text,
          fontFamily: 'Helvetica, Arial, sans-serif',
          fontWeight: 800,
          fontSize: 92 * base,
          margin: `${50 * base}px 0 0`,
          textAlign: 'center',
          opacity: titleIn,
          transform: `translateY(${(1 - titleIn) * 50}px)`,
          letterSpacing: -1.5 * base,
        }}
      >
        {feature.title}
      </h2>
      <div
        style={{
          width: underlineW * base,
          height: 8 * base,
          borderRadius: 4 * base,
          backgroundColor: brand.primary,
          marginTop: 24 * base,
        }}
      />
      <p
        style={{
          color: brand.textMuted,
          fontFamily: 'Helvetica, Arial, sans-serif',
          fontWeight: 500,
          fontSize: 46 * base,
          lineHeight: 1.4,
          marginTop: 40 * base,
          textAlign: 'center',
          maxWidth: 760 * base,
          opacity: descOpacity,
        }}
      >
        {feature.description}
      </p>
    </AbsoluteFill>
  );
};
