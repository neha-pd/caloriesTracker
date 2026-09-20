import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { PromoProps } from '../schema';

export const Intro: React.FC<{ props: PromoProps }> = ({ props }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const { brand, appName, tagline } = props;

  const logoIn = spring({ frame, fps, config: { damping: 200, stiffness: 120 } });
  const nameIn = spring({ frame: frame - 8, fps, config: { damping: 200, stiffness: 100 } });
  const taglineOpacity = interpolate(frame, [25, 45], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const taglineY = interpolate(frame, [25, 45], [30, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const base = height / 1920; // scale factor so landscape keeps proportions

  return (
    <AbsoluteFill
      style={{ backgroundColor: brand.bg, alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        style={{
          width: 180 * base,
          height: 180 * base,
          borderRadius: 90 * base,
          backgroundColor: brand.primary,
          transform: `scale(${logoIn})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 90 * base,
        }}
      >
        🥗
      </div>
      <h1
        style={{
          color: brand.text,
          fontFamily: 'Helvetica, Arial, sans-serif',
          fontWeight: 800,
          fontSize: 130 * base,
          margin: `${40 * base}px 0 0`,
          opacity: nameIn,
          transform: `translateY(${(1 - nameIn) * 40}px)`,
          letterSpacing: -2 * base,
        }}
      >
        {appName}
      </h1>
      <p
        style={{
          color: brand.textMuted,
          fontFamily: 'Helvetica, Arial, sans-serif',
          fontWeight: 500,
          fontSize: 48 * base,
          marginTop: 20 * base,
          opacity: taglineOpacity,
          transform: `translateY(${taglineY}px)`,
        }}
      >
        {tagline}
      </p>
    </AbsoluteFill>
  );
};
