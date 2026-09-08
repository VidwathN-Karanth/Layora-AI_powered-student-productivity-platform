'use client';

import { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Download, ExternalLink, Eye, FileArchive, FileText, RefreshCw, X,
} from 'lucide-react';

import { apiFetch, apiUrl, errorMessage, readJson } from '@/lib/apiClient';
import { formatDate, formatDateTime } from '@/lib/dateFormat';
import { drivePreviewUrl } from '@/lib/driveLinks';
import { useAdmin } from '../AdminContext';
import { PanelEmpty, PanelError, PanelLoading, SectionHeader } from '../_components/PanelState';
import { useSectionData } from '../_components/useSectionData';

/* ────────────────────────────────────────────────────────────────
   The year's CVs: who has one, and a way to take the lot.

   The files live in each student's own Google Drive, so "download everyone's"
   is a server job — /api/admin/resumes/download fetches each one and streams a
   ZIP back. The row-by-row links stay, because half the time what is wanted is
   one specific person's CV, not forty.
   ──────────────────────────────────────────────────────────────── */

interface ResumeEntry {
  userId: string;
  name: string;
  email: string;
  url: string;
  fileName: string | null;
  uploadedAt: string | null;
}

export default function AdminResumesPage() {
  const { selectedCohort } = useAdmin();

  const [resumes, setResumes] = useState<ResumeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [active, setActive] = useState<ResumeEntry | null>(null);
  const [zipping, setZipping] = useState(false);
  const [zipNote, setZipNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    // Neither the open CV nor the last download's note belongs to a new year.
    setActive(null);
    setZipNote('');
    try {
      const data = await readJson<{ resumes?: ResumeEntry[] }>(
        await apiFetch(`/api/admin/resumes?cohort=${encodeURIComponent(selectedCohort)}`)
      );
      setResumes(data.resumes || []);
    } catch (err) {
      setError(errorMessage(err, 'Could not load resumes.'));
    } finally {
      setLoading(false);
    }
  }, [selectedCohort]);

  useSectionData(load);

  /**
   * Downloads the whole year as one archive.
   *
   * Fetched rather than linked so a failure arrives as a message on this page:
   * a plain `<a download>` pointed at a route that answers JSON would navigate
   * the console away to a page of raw error text.
   */
  const downloadAll = async () => {
    setZipping(true);
    setZipNote('');
    setError('');
    try {
      const res = await fetch(
        apiUrl(`/api/admin/resumes/download?cohort=${encodeURIComponent(selectedCohort)}`),
        { credentials: 'include' }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `The archive could not be built (HTTP ${res.status}).`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download =
        `layora_${selectedCohort.toLowerCase().replace(/\s+/g, '_')}_resumes_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setZipNote(
        `Downloaded ${resumes.length} CV${resumes.length === 1 ? '' : 's'}. ` +
        'Anything that could not be fetched is listed in _missing.txt inside the archive.'
      );
    } catch (err) {
      setError(errorMessage(err, 'Could not download the CVs.'));
    } finally {
      setZipping(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={FileText}
        title="Resumes"
        subtitle={`Every ${selectedCohort} student who has uploaded a CV, newest first.`}
      >
        <button
          onClick={downloadAll}
          disabled={zipping || resumes.length === 0}
          title={
            resumes.length === 0
              ? 'Nobody in this year has uploaded a CV yet'
              : `Download all ${resumes.length} CVs as a single ZIP`
          }
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 border border-emerald-500/30 hover:border-emerald-400 text-white/90 hover:text-emerald-400 transition cursor-pointer text-[10px] uppercase font-bold tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <FileArchive className={`w-3.5 h-3.5 ${zipping ? 'animate-pulse' : ''}`} />
          {zipping ? 'Building ZIP…' : 'Download all (ZIP)'}
        </button>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-sky-400 text-white/70 hover:text-white transition cursor-pointer text-[10px] uppercase font-bold tracking-wider"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Reload
        </button>
      </SectionHeader>

      {zipping && (
        <p className="font-mono text-[11px] text-white/50">
          Fetching each CV from Drive and packing the archive — this takes a moment for a full year.
        </p>
      )}
      {zipNote && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-mono leading-relaxed">
          {zipNote}
        </div>
      )}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-950/20 border border-red-500/25 text-red-300 text-xs font-mono">
          {error}
        </div>
      )}

      <section className="glass-panel border border-white/10 rounded-2xl overflow-hidden">
        {loading ? (
          <PanelLoading message="Loading resumes…" accent="text-sky-400" />
        ) : error && resumes.length === 0 ? (
          <PanelError message={error} onRetry={load} />
        ) : resumes.length === 0 ? (
          <PanelEmpty>No {selectedCohort} student has uploaded a CV yet.</PanelEmpty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-white/2 text-white/40 font-bold uppercase tracking-wider">
                  <th className="p-4 font-normal">Student</th>
                  <th className="p-4 font-normal">Email</th>
                  <th className="p-4 font-normal">File</th>
                  <th className="p-4 font-normal">Uploaded</th>
                  <th className="p-4 font-normal text-center w-36">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {resumes.map((r) => (
                  <tr
                    key={r.userId}
                    onClick={() => setActive(r)}
                    className="hover:bg-white/3 transition group cursor-pointer"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-sky-400 shrink-0">
                          <FileText className="w-3.5 h-3.5" />
                        </span>
                        <span className="font-bold text-white group-hover:text-sky-400 transition truncate">
                          {r.name}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-white/50 font-mono text-[10px] truncate max-w-[220px]">{r.email}</td>
                    <td className="p-4 text-white/60 truncate max-w-[200px]">{r.fileName || 'Resume'}</td>
                    <td className="p-4 text-white/50 font-mono text-[10px]">{formatDateTime(r.uploadedAt)}</td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setActive(r); }}
                          className="p-1.5 rounded-lg border border-white/10 hover:border-sky-400 text-white/60 hover:text-sky-400 transition cursor-pointer"
                          title={`View ${r.name}'s CV`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 hover:border-emerald-400 text-white/60 hover:text-emerald-400 transition cursor-pointer text-[10px] font-bold uppercase tracking-wider"
                          title="Open or download"
                        >
                          <Download className="w-3 h-3" /> Open
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Resume viewer: the CV inline, with a download beside it */}
      <AnimatePresence>
        {active && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setActive(null)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
            />
            <motion.aside
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 240 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-3xl bg-[#16181C] border-l border-white/10 z-50 flex flex-col"
            >
              <header className="p-5 border-b border-white/10 flex items-start justify-between gap-4 shrink-0">
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-white truncate">{active.name}</h2>
                  <p className="text-[10px] font-mono text-white/40 truncate mt-0.5">
                    {active.email} &middot; {selectedCohort}
                    {active.uploadedAt ? ` · uploaded ${formatDate(active.uploadedAt)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={active.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 hover:border-emerald-400 text-emerald-400 transition cursor-pointer text-[10px] font-bold uppercase tracking-wider"
                  >
                    <Download className="w-3.5 h-3.5" /> Download
                  </a>
                  <button
                    onClick={() => setActive(null)}
                    aria-label="Close"
                    className="p-2 rounded-lg border border-white/10 hover:border-white/25 text-white/50 hover:text-white transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </header>

              <div className="flex-1 min-h-0 bg-black/30">
                {/* Drive share links render in an iframe via /preview; anything
                    else is embedded as-is and falls back to the link below. */}
                <iframe
                  src={drivePreviewUrl(active.url) || active.url}
                  title={`${active.name} CV`}
                  className="w-full h-full border-0"
                />
              </div>

              <footer className="p-3 border-t border-white/10 text-center shrink-0">
                <a
                  href={active.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-mono text-white/40 hover:text-sky-400 transition inline-flex items-center gap-1.5"
                >
                  Preview not loading? Open it directly <ExternalLink className="w-3 h-3" />
                </a>
              </footer>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
