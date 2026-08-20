'use client';

import { useState } from 'react';
import { FileText } from 'lucide-react';
import { driveThumbnailUrl } from '@/lib/driveLinks';

interface Props {
  /** The stored link — a Google Drive share URL for anything uploaded here. */
  url: string;
  name: string;
  /** Tailwind classes for the fallback icon, so each surface keeps its accent. */
  iconClass?: string;
  labelClass?: string;
  /** Wording under the fallback icon. */
  label?: string;
}

/**
 * The thumbnail on a certificate card.
 *
 * Drive renders the first page of a PDF as an image, which is what a
 * certificate actually is, so the card can show the credential rather than a
 * generic file icon. That endpoint is undocumented, rate-limited, and stops
 * answering if the student narrows the sharing on their own Drive file — so
 * anything other than a clean load falls back to the plain tile instead of
 * leaving a broken image behind.
 *
 * Deliberately a plain <img> and not next/image: these are third-party URLs,
 * and routing hundreds of them through Vercel's image optimizer would bill for
 * work that buys us nothing here.
 */
export default function CertificateThumb({
  url,
  name,
  iconClass = 'text-primary/60 group-hover:text-primary',
  labelClass = 'text-outline',
  label = 'PDF in Drive',
}: Props) {
  const thumbnail = driveThumbnailUrl(url);
  const [failed, setFailed] = useState(false);

  if (thumbnail && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={thumbnail}
        alt={name}
        loading="lazy"
        onError={() => setFailed(true)}
        className="w-full h-full object-cover group-hover:scale-[1.02] transition"
      />
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <FileText className={`w-9 h-9 transition ${iconClass}`} />
      <span className={`text-[8px] font-mono uppercase tracking-widest ${labelClass}`}>{label}</span>
    </div>
  );
}
