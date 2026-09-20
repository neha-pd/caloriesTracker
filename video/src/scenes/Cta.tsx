import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { PromoProps } from '../schema';

export const Cta: React.FC<{ props: PromoProps }> = ({ props }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const { brand, appName, ctaText } = props;

  const nameIn = spring({ frame, fps, config: { damping: 200, stiffness: 120 } });
  const pillIn = spring({ frame: frame - 10, fps, config: { damping: 14, stiffness: 120 } });
  const glowOpacity = interpolate(frame, [0, 30], [0, 0.25], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const base = height / 1920;

  return (
    <AbsoluteFill
      style={{ backgroundColor: brand.bg, alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        style={{
          position: 'absolute',
          width: 1000 * base,
          height: 1000 * base,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${brand.primary} 0%, transparent 65%)`,
          opacity: glowOpacity,
        }}
      />
      <h1
        style={{
          color: brand.text,
          fontFamily: 'Helvetica, Arial, sans-serif',
          fontWeight: 800,
          fontSize: 120 * base,
          margin: 0,
          opacity: nameIn,
          transform: `translateY(${(1 - nameIn) * 40}px)`,
          letterSpacing: -2 * base,
        }}
      >
        {appName}
      </h1>
      <div
        style={{
          marginTop: 60 * base,
          backgroundColor: brand.primary,
          color: brand.bg,
          fontFamily: 'Helvetica, Arial, sans-serif',
          fontWeight: 700,
          fontSize: 46 * base,
          padding: `${34 * base}px ${72 * base}px`,
          borderRadius: 999,
          transform: `scale(${Math.max(0, pillIn)})`,
        }}
      >
        {ctaText}
      </div>
    </AbsoluteFill>
  );
};
