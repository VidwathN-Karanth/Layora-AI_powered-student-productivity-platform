'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Award, Eye, RefreshCw, X } from 'lucide-react';

import { apiFetch, errorMessage, readJson } from '@/lib/apiClient';
import { formatDateTime } from '@/lib/dateFormat';
import {
  CATEGORY_ADMIN_ACCENT, CERTIFICATE_CATEGORIES, type CertificateCategory,
} from '@/lib/certificateCategories';
import CertificateGroups, { type InspectedCertificate } from '@/components/CertificateGroups';
import { useAdmin } from '../AdminContext';
import CertificatePreview from '../_components/CertificatePreview';
import { PanelEmpty, PanelError, PanelLoading, SectionHeader } from '../_components/PanelState';
import { useSectionData } from '../_components/useSectionData';

/* ────────────────────────────────────────────────────────────────
   Who in this year has uploaded certificates, and how many of each kind.

   One column per category, so a year can be scanned down a single bucket —
   "who has no NPTEL certificate" is the question this is actually asked — and
   opening a row shows that student's uploads grouped the same way.
   ──────────────────────────────────────────────────────────────── */

interface Uploader {
  userId: string;
  name: string;
  email: string;
  count: number;
  /** Always carries all three keys — a category with none reads 0, not blank. */
  byCategory?: Record<CertificateCategory, number>;
  latestAt: string | null;
}

export default function AdminCertificatesPage() {
  const { selectedCohort } = useAdmin();

  const [uploaders, setUploaders] = useState<Uploader[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selected, setSelected] = useState<Uploader | null>(null);
  const [certificates, setCertificates] = useState<InspectedCertificate[]>([]);
  const [loadingCerts, setLoadingCerts] = useState(false);
  const [preview, setPreview] = useState<InspectedCertificate | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    // A drawer open over the previous year's list would outlive its row.
    setSelected(null);
    try {
      const data = await readJson<{ uploaders?: Uploader[] }>(
        await apiFetch(`/api/admin/certificates/overview?cohort=${encodeURIComponent(selectedCohort)}`)
      );
      setUploaders(data.uploaders || []);
    } catch (err) {
      setError(errorMessage(err, 'Could not load certificate uploads.'));
    } finally {
      setLoading(false);
    }
  }, [selectedCohort]);

  useSectionData(load);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;

    (async () => {
      setLoadingCerts(true);
      try {
        const data = await readJson<InspectedCertificate[]>(
          await apiFetch(`/api/admin/certificates?userId=${encodeURIComponent(selected.userId)}`)
        );
        if (!cancelled) setCertificates(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setCertificates([]);
      } finally {
        if (!cancelled) setLoadingCerts(false);
      }
    })();

    return () => { cancelled = true; };
  }, [selected]);

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Award}
        title="Certificates"
        subtitle={`Every ${selectedCohort} student who has uploaded a certificate, by category.`}
      >
        <span className="px-3 py-2 rounded-xl border border-outline-variant bg-white/3 text-[10px] font-mono uppercase tracking-wider text-outline">
          {uploaders.length} student{uploaders.length === 1 ? '' : 's'}
        </span>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-amber-400 text-white/70 hover:text-white transition cursor-pointer text-[10px] uppercase font-bold tracking-wider"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Reload
        </button>
      </SectionHeader>

      <section className="glass-panel border border-white/10 rounded-2xl overflow-hidden">
        {loading ? (
          <PanelLoading message="Loading certificate uploads…" accent="text-amber-400" />
        ) : error ? (
          <PanelError message={error} onRetry={load} />
        ) : uploaders.length === 0 ? (
          <PanelEmpty>No {selectedCohort} student has uploaded a certificate yet.</PanelEmpty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-white/2 text-white/40 font-bold uppercase tracking-wider">
                  <th className="p-4 font-normal">Student</th>
                  <th className="p-4 font-normal">Email</th>
                  {CERTIFICATE_CATEGORIES.map((c) => (
                    <th key={c} className="p-4 font-normal text-center">{c}</th>
                  ))}
                  <th className="p-4 font-normal text-right">Total</th>
                  <th className="p-4 font-normal">Latest upload</th>
                  <th className="p-4 font-normal text-center w-20">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {uploaders.map((uploader) => (
                  <tr
                    key={uploader.userId}
                    onClick={() => setSelected(uploader)}
                    className="hover:bg-white/3 transition group cursor-pointer"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-bold text-sm text-amber-400 shrink-0">
                          {uploader.name?.charAt(0).toUpperCase() || 'S'}
                        </span>
                        <span className="font-bold text-white group-hover:text-amber-400 transition truncate">
                          {uploader.name}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-white/50 font-mono text-[10px] truncate max-w-[220px]">
                      {uploader.email}
                    </td>
                    {CERTIFICATE_CATEGORIES.map((c) => {
                      const n = uploader.byCategory?.[c] ?? 0;
                      return (
                        <td key={c} className="p-4 text-center">
                          <span className={`inline-block min-w-[2rem] px-2 py-1 rounded-lg font-bold text-xs tabular-nums border ${
                            n > 0 ? CATEGORY_ADMIN_ACCENT[c] : 'border-white/5 text-white/20'
                          }`}>
                            {n}
                          </span>
                        </td>
                      );
                    })}
                    <td className="p-4 text-right">
                      <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg font-black text-sm tabular-nums">
                        {uploader.count}
                      </span>
                    </td>
                    <td className="p-4 text-white/50 font-mono text-[10px]">
                      {formatDateTime(uploader.latestAt)}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelected(uploader); }}
                          className="p-1.5 rounded-lg border border-white/10 hover:border-amber-400 text-white/60 hover:text-amber-400 transition cursor-pointer"
                          title={`View ${uploader.name}'s certificates`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelected(null)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
            />
            <motion.aside
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 240 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-2xl bg-[#1E2126] border-l border-white/10 z-50 flex flex-col"
            >
              <header className="p-5 border-b border-white/10 flex items-start justify-between gap-4 shrink-0">
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-white truncate">{selected.name}</h2>
                  <p className="text-[10px] font-mono text-white/40 truncate mt-0.5">
                    {selected.email} &middot; {selectedCohort}
                  </p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  aria-label="Close"
                  className="p-2 rounded-lg border border-white/10 hover:border-white/25 text-white/50 hover:text-white transition cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </header>

              <div className="flex-1 overflow-y-auto p-5">
                {loadingCerts ? (
                  <PanelLoading message="Fetching certificates…" accent="text-amber-400" />
                ) : certificates.length === 0 ? (
                  <PanelEmpty>No certificates found for this student.</PanelEmpty>
                ) : (
                  <CertificateGroups certificates={certificates} onPreview={setPreview} accent="amber" />
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <CertificatePreview certificate={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
