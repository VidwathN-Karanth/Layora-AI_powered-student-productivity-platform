import { ImageResponse } from 'next/og';

/**
 * The browser tab icon.
 *
 * Solid purple with a white L, matching src/components/LayoraMark.tsx and the
 * generated PNGs. It used to be a purple-to-blue gradient, which made the tab
 * the one place the mark looked like neither the app nor the landing page.
 *
 * The colour is repeated rather than imported because this renders in the edge
 * runtime through Satori, which takes plain style objects and no CSS variables.
 * If MARK_PURPLE changes, change it here and in scripts/generate-logos.py too.
 */

export const runtime = 'edge';

export const size = {
  width: 32,
  height: 32,
};
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 24,
          background: '#C56BF5',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FFFFFF',
          fontWeight: 900,
          fontFamily: 'monospace',
          borderRadius: '8px',
        }}
      >
        L
      </div>
    ),
    {
      ...size,
    }
  );
}
