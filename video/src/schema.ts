import { z } from 'zod';
import { zColor } from '@remotion/zod-types';

export const promoSchema = z.object({
  appName: z.string(),
  tagline: z.string(),
  ctaText: z.string(),
  brand: z.object({
    primary: zColor(),
    bg: zColor(),
    card: zColor(),
    text: zColor(),
    textMuted: zColor(),
  }),
  features: z
    .array(
      z.object({
        icon: z.string(), // emoji or short glyph, rendered large
        title: z.string(),
        description: z.string(),
      })
    )
    .min(1),
  timing: z.object({
    introDurationInFrames: z.number().int().min(30),
    featureDurationInFrames: z.number().int().min(45),
    ctaDurationInFrames: z.number().int().min(30),
  }),
});

export type PromoProps = z.infer<typeof promoSchema>;

// Seeded from the FitLens mobile theme (mobile/src/constants/theme.ts).
export const defaultPromoProps: PromoProps = {
  appName: 'FitLens',
  tagline: 'Point. Shoot. Tracked.',
  ctaText: 'Download FitLens today',
  brand: {
    primary: '#1ed760',
    bg: '#121212',
    card: '#181818',
    text: '#ffffff',
    textMuted: '#b3b3b3',
  },
  features: [
    { icon: '📸', title: 'AI Food Scan', description: 'Snap a photo — calories and macros logged in seconds.' },
    { icon: '🎯', title: 'Smart Goals', description: 'Daily targets calculated from your body and activity.' },
    { icon: '📊', title: 'Macro Rings', description: 'Protein, carbs and fat at a glance, every day.' },
    { icon: '💧', title: 'Water Tracking', description: 'One tap to stay on top of hydration.' },
  ],
  timing: {
    introDurationInFrames: 90,
    featureDurationInFrames: 75,
    ctaDurationInFrames: 90,
  },
};

export const promoDurationInFrames = (props: PromoProps) =>
  props.timing.introDurationInFrames +
  props.features.length * props.timing.featureDurationInFrames +
  props.timing.ctaDurationInFrames;
