'use client';

import { Eye, ExternalLink } from 'lucide-react';
import CertificateThumb from './CertificateThumb';
import { groupByCategory } from '@/lib/certificateCategories';

export interface InspectedCertificate {
  id: string;
  name: string;
  category: string;
  file_url: string;
  created_at: string;
}

/** The admin console shows this in two places with two different accents. */
const ACCENTS = {
  amber: {
    heading: 'text-amber-300',
    icon: 'text-amber-400/60 group-hover:text-amber-400',
    link: 'text-amber-400',
    border: 'hover:border-amber-400/30',
  },
  blue: {
    heading: 'text-cyber-blue',
    icon: 'text-cyber-blue/60 group-hover:text-cyber-blue',
    link: 'text-cyber-blue',
    border: 'hover:border-cyber-blue/30',
  },
} as const;

interface Props {
  certificates: InspectedCertificate[];
  onPreview: (cert: InspectedCertificate) => void;
  accent: keyof typeof ACCENTS;
}

/**
 * One student's certificates, split into the three categories they filed them
 * under.
 *
 * Every category gets a heading and a count even when it is empty — for a
 * lecturer, "this student has no NPTEL certificates" is the useful reading, and
 * it only shows if the empty bucket is on screen. Cards carry no category badge
 * because the heading above them already says it.
 */
export default function CertificateGroups({ certificates, onPreview, accent }: Props) {
  const a = ACCENTS[accent];

  return (
    <div className="space-y-5">
      {groupByCategory(certificates).map(({ category, items }) => (
        <section key={category}>
          <header className="flex items-center justify-between border-b border-white/5 pb-1.5 mb-3">
            <h4 className={`text-[10px] font-bold uppercase tracking-widest ${a.heading}`}>{category}</h4>
            <span className="text-[9px] text-white/30 tabular-nums">
              {items.length} {items.length === 1 ? 'certificate' : 'certificates'}
            </span>
          </header>

          {items.length === 0 ? (
            <p className="text-[10px] text-white/25 italic">Nothing filed under {category}.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {items.map((cert) => (
                <div
                  key={cert.id}
                  className={`bg-black/45 border border-white/5 rounded-xl overflow-hidden flex flex-col justify-between transition group ${a.border}`}
                >
                  <div
                    className="relative aspect-[4/3] bg-black flex items-center justify-center overflow-hidden border-b border-white/5 cursor-pointer"
                    onClick={() => onPreview(cert)}
                  >
                    <CertificateThumb
                      url={cert.file_url}
                      name={cert.name}
                      iconClass={a.icon}
                      labelClass="text-white/30"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                      <Eye className="w-4 h-4 text-white" />
                    </div>
                  </div>

                  <div className="p-3 space-y-1.5">
                    <h4 className="text-xs font-bold text-white line-clamp-1">{cert.name}</h4>
                    <div className="flex items-center justify-between text-[9px] text-white/40 pt-1.5 border-t border-white/5">
                      <span>{new Date(cert.created_at).toLocaleDateString()}</span>
                      <a
                        href={cert.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${a.link} hover:underline flex items-center gap-0.5`}
                      >
                        Original <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
