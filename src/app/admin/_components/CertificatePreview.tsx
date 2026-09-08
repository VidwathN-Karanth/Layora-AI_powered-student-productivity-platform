'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ExternalLink, FileText, X } from 'lucide-react';

import { drivePreviewUrl } from '@/lib/driveLinks';
import { resolveCategory } from '@/lib/certificateCategories';
import type { InspectedCertificate } from '@/components/CertificateGroups';

/**
 * One certificate, full size.
 *
 * Opened from two places — the student inspector and the certificates roll
 * call — so it lives on its own rather than being written out twice.
 */
export default function CertificatePreview({
  certificate,
  onClose,
}: {
  certificate: InspectedCertificate | null;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {certificate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            role="dialog"
            aria-modal="true"
            className="glass-panel border border-white/10 p-4 rounded-2xl max-w-3xl w-full relative z-10 bg-[#1E2126] flex flex-col"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-white truncate">{certificate.name}</h3>
                <p className="text-[9px] text-white/40 uppercase font-mono mt-0.5">
                  {resolveCategory(certificate.category)} certificate
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="p-1.5 rounded-lg border border-white/10 hover:border-white/30 text-white/50 hover:text-white transition cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drive files embed inline; any other link can only be opened in a tab. */}
            <div className="bg-black/50 p-2 rounded-lg flex items-center justify-center overflow-auto max-h-[60vh]">
              {drivePreviewUrl(certificate.file_url) ? (
                <iframe
                  src={drivePreviewUrl(certificate.file_url) as string}
                  title={certificate.name}
                  className="w-full h-[55vh] rounded-lg border border-white/5 bg-white"
                />
              ) : (
                <div className="text-center text-[11px] text-white/40 py-10 space-y-2">
                  <FileText className="w-8 h-8 mx-auto text-white/20" />
                  <p>This link cannot be previewed here.</p>
                  <a
                    href={certificate.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyber-blue hover:underline inline-flex items-center gap-1"
                  >
                    Open original <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
