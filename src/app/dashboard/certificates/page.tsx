'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { apiFetch, readJson, errorMessage } from '@/lib/apiClient';
import { drivePreviewUrl } from '@/lib/driveLinks';
import CertificateThumb from '@/components/CertificateThumb';
import InfoPopover from '@/components/InfoPopover';
import { formatDate } from '@/lib/dateFormat';
import {
  CERTIFICATE_CATEGORIES, CATEGORY_HINTS, CATEGORY_ACCENT, countByCategory, resolveCategory,
  type CertificateCategory,
} from '@/lib/certificateCategories';
import {
  Award, UploadCloud, Trash2, Eye, X, Link2, FileText,
  ExternalLink, Calendar, Plus, Loader2, AlertTriangle, Check, Lock
} from 'lucide-react';

interface Certificate {
  id: string;
  name: string;
  category: string;
  file_url: string;
  created_at: string;
}

/** Vercel caps a serverless request body at ~4.5 MB, so anything larger has to
 *  go to Drive by hand and come back as a link. */
const MAX_DIRECT_UPLOAD = 4.5 * 1024 * 1024;

const isPdf = (file: File) =>
  file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

type PickResult = { ok: true; file: File } | { ok: false; error: string };

/** Pure: decides whether a dropped/pasted/browsed file is an acceptable certificate. */
function validateCertificateFile(f: File): PickResult {
  if (!isPdf(f)) {
    return {
      ok: false,
      error: 'Only PDF files are accepted. Save or print your certificate as a PDF and try again.',
    };
  }
  if (f.size > MAX_DIRECT_UPLOAD) {
    return {
      ok: false,
      error:
        `That file is ${(f.size / (1024 * 1024)).toFixed(1)} MB. Direct upload is limited to 4.5 MB — ` +
        'upload it to your Google Drive yourself and paste the link instead.',
    };
  }
  return { ok: true, file: f };
}

export default function CertificatesPage() {
  const { user: clerkUser } = useUser();

  // Core states
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dbMissing, setDbMissing] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [category, setCategory] = useState<CertificateCategory>(CERTIFICATE_CATEGORIES[0]);
  const [mode, setMode] = useState<'upload' | 'link'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string | undefined>>({});

  // Preview state
  const [activeCert, setActiveCert] = useState<Certificate | null>(null);

  // Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // `loading` already starts true, so nothing is set synchronously here — every
  // update happens after the await, and is dropped if the page unmounted first.
  useEffect(() => {
    if (!clerkUser?.id) return;
    let cancelled = false;

    (async () => {
      try {
        const data = await readJson<Certificate[]>(await apiFetch('/api/user/certificates'));
        if (!cancelled) setCertificates(data);
      } catch (err: unknown) {
        if (cancelled) return;
        console.error(err);
        const body = err && typeof err === 'object' && 'body' in err ? (err as { body?: { code?: string } }).body : null;
        if (body?.code === 'MISSING_TABLE') setDbMissing(true);
        setError(errorMessage(err, 'Could not load your credentials.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [clerkUser?.id]);

  const applyPick = (f: File | null | undefined) => {
    if (!f) return;
    const result = validateCertificateFile(f);
    if (result.ok) {
      setFile(result.file);
      setFormErrors(prev => ({ ...prev, file: undefined }));
      setError('');
    } else {
      setFile(null);
      setFormErrors(prev => ({ ...prev, file: result.error }));
    }
  };

  // Drag and drop event handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    applyPick(e.dataTransfer.files?.[0]);
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!name.trim()) {
      errors.name = 'This field is required';
    }
    if (mode === 'upload' && !file) {
      errors.file = 'This field is required';
    }
    if (mode === 'link' && !linkUrl.trim()) {
      errors.link = 'This field is required';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setUploading(true);
    setFormErrors({});
    setUploadSuccess(false);
    setError('');

    try {
      let url: string;

      if (mode === 'upload') {
        if (!file) throw new Error('Choose a PDF first.');

        // Goes into the student's own Drive, shared by link so staff can open
        // it. Nothing about the file touches Supabase storage.
        const form = new FormData();
        form.append('file', file);
        form.append('name', file.name);
        form.append('makePublic', 'true');

        const uploaded = await readJson<{ file: { url: string } }>(
          await apiFetch('/api/resources/upload-drive', { method: 'POST', body: form })
        );
        url = uploaded.file.url;
      } else {
        url = linkUrl.trim();
      }

      const data = await readJson<{ certificate: Certificate }>(
        await apiFetch('/api/user/certificates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), category, url }),
        })
      );

      setCertificates(prev => [data.certificate, ...prev]);

      // Reset form fields
      setName('');
      setCategory(CERTIFICATE_CATEGORIES[0]);
      setFile(null);
      setLinkUrl('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setFormErrors({});
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    } catch (err: unknown) {
      console.error(err);
      setError(errorMessage(err, 'Upload failed.'));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this certificate from Layora? The PDF stays in your Google Drive.')) {
      return;
    }

    try {
      await readJson(await apiFetch(`/api/user/certificates?id=${id}`, { method: 'DELETE' }));
      setCertificates(prev => prev.filter(c => c.id !== id));
      if (activeCert?.id === id) {
        setActiveCert(null);
      }
    } catch (err: unknown) {
      console.error(err);
      alert('Delete failed: ' + errorMessage(err, 'Unknown error'));
    }
  };

  const activePreviewUrl = activeCert ? drivePreviewUrl(activeCert.file_url) : null;
  const counts = countByCategory(certificates);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="border-b border-outline-variant pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-mono font-bold tracking-wide">📜 Academic Credentials & Certificates</h2>
          <p className="text-xs text-outline font-mono mt-0.5">Catalog your course certifications, skill badges, and exam achievements as PDFs.</p>
        </div>
      </div>

      {dbMissing && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-950/15 text-rose-300 text-xs font-mono space-y-2">
          <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-rose-400">
            <AlertTriangle className="w-4 h-4 animate-pulse" /> Missing Database Tables
          </div>
          <p>The certificates table has not been initialized in your database schema. Run supabase/schema.sql in the Supabase SQL Editor.</p>
        </div>
      )}

      {error && !dbMissing && (
        <div className="bg-rose-950/40 border border-rose-500/30 text-rose-300 p-4 rounded-2xl text-xs font-mono">
          ❌ {error}
        </div>
      )}

      {uploadSuccess && (
        <div className="bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 p-4 rounded-2xl text-xs font-mono flex items-center gap-2">
          <Check className="w-4 h-4 animate-bounce" />
          Certificate saved to your Google Drive and cataloged here.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* --- LEFT SIDE: UPLOAD FORM PANEL --- */}
        <div className="lg:col-span-1 glass-card rounded-2xl p-5 border border-outline-variant space-y-4 h-fit">
          <div className="flex items-center justify-between border-b border-outline-variant/30 pb-2 relative">
            <div className="flex items-center gap-2.5">
              <Plus className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-mono font-bold tracking-wider text-primary">Upload New Certificate</h3>
            </div>
            <InfoPopover label="Where is my certificate stored?" widthClass="w-64">
              <p className="flex items-start gap-2 text-[10px] font-mono text-on-surface-variant leading-relaxed">
                <Lock className="w-3 h-3 mt-0.5 shrink-0 text-primary" />
                <span>The PDF is stored in your own Google Drive, not on Layora. Only you and the department staff see it here.</span>
              </p>
            </InfoPopover>
          </div>

          <form onSubmit={handleUpload} noValidate className="space-y-4">
            <div>
              <label className="block text-[10px] font-mono text-outline mb-1">Certificate Title / Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setFormErrors(prev => ({ ...prev, name: undefined }));
                }}
                placeholder="e.g. Java Programming Basics"
                className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
              />
              {formErrors.name && <p className="text-red-500 text-[10px] font-mono mt-1">{formErrors.name}</p>}
            </div>

            <div>
              <label className="block text-[10px] font-mono text-outline mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as CertificateCategory)}
                className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
              >
                {CERTIFICATE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {/* Staff read these three buckets separately, so say what belongs in each. */}
              <p className="text-[9px] font-mono text-outline mt-1">{CATEGORY_HINTS[category]}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {([
                { key: 'upload' as const, label: 'Upload PDF', Icon: UploadCloud },
                { key: 'link' as const, label: 'Paste link', Icon: Link2 },
              ]).map(({ key, label, Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setMode(key); setFormErrors(prev => ({ ...prev, file: undefined, link: undefined })); }}
                  className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-[10px] font-mono font-bold uppercase transition cursor-pointer ${
                    mode === key
                      ? 'border-primary bg-primary text-white'
                      : 'border-outline-variant bg-white/2 text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {mode === 'upload' ? (
              <div className="space-y-1">
                {/* Drop zone: drag a PDF in, paste one, or click to browse. */}
                <div
                  className={`relative border-2 border-dashed rounded-xl p-6 text-center transition cursor-pointer ${
                    dragActive
                      ? 'border-primary bg-primary/5'
                      : file
                      ? 'border-emerald-500/50 bg-emerald-500/5'
                      : formErrors.file
                      ? 'border-rose-500/50 bg-rose-500/5 hover:border-rose-400'
                      : 'border-outline-variant bg-black/20 hover:border-outline'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onPaste={(e) => applyPick(e.clipboardData?.files?.[0])}
                  onClick={triggerFileSelect}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      triggerFileSelect();
                    }
                  }}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => applyPick(e.target.files?.[0])}
                    accept="application/pdf,.pdf"
                    className="hidden"
                  />

                  <div className="flex flex-col items-center justify-center gap-2">
                    {file ? (
                      <>
                        <FileText className="w-8 h-8 text-emerald-400" />
                        <div className="space-y-1 min-w-0 w-full">
                          <p className="text-xs font-bold text-on-surface truncate px-2">{file.name}</p>
                          <p className="text-[9px] text-outline font-mono">
                            {(file.size / 1024 / 1024).toFixed(2)} MB &middot; ready to upload
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          className="text-[9px] font-mono uppercase tracking-wider text-outline hover:text-red-400 transition cursor-pointer flex items-center gap-1"
                        >
                          <X className="w-3 h-3" /> Choose a different file
                        </button>
                      </>
                    ) : (
                      <>
                        <UploadCloud className={`w-8 h-8 ${dragActive ? 'text-primary' : 'text-outline-variant'}`} />
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-on-surface">Drop your PDF here, paste it, or browse</p>
                          <p className="text-[9px] text-outline font-mono">PDF only &middot; up to 4.5 MB</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                {formErrors.file && <p className="text-red-500 text-[10px] font-mono mt-1">{formErrors.file}</p>}
                <p className="text-[9px] font-mono text-outline mt-1.5">Saved to your own Google Drive.</p>
              </div>
            ) : (
              <div>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => {
                    setLinkUrl(e.target.value);
                    setFormErrors(prev => ({ ...prev, link: undefined }));
                  }}
                  placeholder="https://drive.google.com/file/d/..."
                  className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                />
                {formErrors.link && <p className="text-red-500 text-[10px] font-mono mt-1">{formErrors.link}</p>}
                <p className="text-[9px] font-mono text-outline mt-1.5">
                  Make sure the link is viewable by anyone with it, or staff will not be able to open it.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={uploading || dbMissing}
              className="w-full bg-primary hover:bg-primary-container text-on-surface rounded-xl py-2.5 text-xs font-mono font-bold transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-[0.98]"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {mode === 'upload' ? 'Uploading to Drive...' : 'Saving...'}
                </>
              ) : (
                'Save Certificate'
              )}
            </button>
          </form>
        </div>

        {/* --- RIGHT SIDE: CERTIFICATES GRID LIST PANEL --- */}
        <div className="lg:col-span-2 glass-card rounded-2xl p-5 border border-outline-variant flex flex-col min-h-[300px]">
          <div className="flex items-center justify-between border-b border-outline-variant/30 pb-2 mb-4">
            <div className="flex items-center gap-2.5">
              <Award className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-mono font-bold tracking-wider text-primary">My Certificates</h3>
            </div>
            <span className="text-[10px] text-outline bg-white/2 border border-outline-variant px-2 py-0.5 rounded font-mono font-semibold">
              {certificates.length} total
            </span>
          </div>

          {/* Per-category tally — the same three buckets the department reads. */}
          {!loading && (
            <div className="grid grid-cols-3 gap-2 mb-4">
              {CERTIFICATE_CATEGORIES.map((c) => (
                <div
                  key={c}
                  className={`rounded-xl border px-2.5 py-2 text-center ${
                    counts[c] > 0 ? CATEGORY_ACCENT[c] : 'border-outline-variant text-outline bg-white/2'
                  }`}
                >
                  <div className="text-lg font-bold font-mono leading-none tabular-nums">{counts[c]}</div>
                  <div className="text-[9px] font-mono uppercase tracking-wider mt-1 opacity-80">{c}</div>
                </div>
              ))}
            </div>
          )}

          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2.5 text-outline text-xs font-mono p-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              Loading certificate files...
            </div>
          ) : certificates.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-outline text-xs font-mono p-12 text-center">
              <Award className="w-8 h-8 text-outline-variant mb-2" />
              <p className="font-bold text-on-surface">No Credentials Cataloged</p>
              <p className="text-[10px] max-w-[280px] mt-0.5">Link your skills certificates to verify your development course work for diagnostic inspection.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {certificates.map((cert) => (
                <div
                  key={cert.id}
                  className="bg-black/25 border border-outline-variant/40 rounded-xl overflow-hidden flex flex-col justify-between hover:border-primary/40 hover:bg-black/40 transition duration-200 group"
                >
                  {/* The file itself lives in the student's Drive; Drive renders
                      the first page for us, with a plain tile as the fallback. */}
                  <div className="relative aspect-[4/3] bg-black/40 flex flex-col items-center justify-center gap-2 overflow-hidden border-b border-outline-variant/30">
                    <CertificateThumb url={cert.file_url} name={cert.name} />

                    {/* Hover controls overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-3 transition duration-200">
                      <button
                        onClick={() => setActiveCert(cert)}
                        className="p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white transition cursor-pointer"
                        title="Preview"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(cert.id)}
                        className="p-2 rounded-xl bg-red-950/40 hover:bg-red-900 border border-red-500/30 text-red-300 transition cursor-pointer"
                        title="Remove from Layora"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="p-4 space-y-2">
                    <div>
                      <h4 className="text-xs font-bold text-on-surface group-hover:text-primary transition line-clamp-1">{cert.name}</h4>
                      <span className={`inline-block text-[8px] font-mono font-bold tracking-wider px-2 py-0.5 mt-1 rounded border uppercase ${CATEGORY_ACCENT[resolveCategory(cert.category)]}`}>
                        {resolveCategory(cert.category)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[9px] text-outline font-mono pt-1.5 border-t border-outline-variant/20">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-outline-variant" />
                        {formatDate(cert.created_at, 'N/A')}
                      </span>
                      <a
                        href={cert.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-0.5"
                      >
                        File <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* --- PDF PREVIEW LIGHTBOX --- */}
      {activeCert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Frosted Backing */}
          <div
            onClick={() => setActiveCert(null)}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

          <div className="relative max-w-4xl w-full max-h-[85vh] bg-[#16181C]/95 border border-outline-variant/50 rounded-2xl overflow-hidden z-10 flex flex-col shadow-2xl">
            {/* Header controls */}
            <div className="p-4 border-b border-outline-variant/40 bg-white/2 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-on-surface">{activeCert.name}</h3>
                <p className="text-[9px] text-outline uppercase font-mono mt-0.5">{resolveCategory(activeCert.category)} certificate</p>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={activeCert.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/20 hover:border-primary text-primary text-[10px] font-mono font-bold transition duration-200 cursor-pointer"
                >
                  Open in Drive <ExternalLink className="w-3 h-3" />
                </a>
                <button
                  onClick={() => setActiveCert(null)}
                  className="p-1.5 rounded-lg border border-outline-variant hover:bg-white/5 text-outline hover:text-on-surface transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Large Preview — Drive embeds inline; anything else opens in a tab. */}
            <div className="flex-1 bg-black/40 overflow-auto p-4 flex items-center justify-center min-h-0">
              {activePreviewUrl ? (
                <iframe
                  src={activePreviewUrl}
                  title={activeCert.name}
                  className="w-full h-[60vh] rounded-lg border border-outline-variant/20 bg-white"
                  allow="autoplay"
                />
              ) : (
                <div className="text-center text-xs font-mono text-outline space-y-2 py-12">
                  <FileText className="w-8 h-8 mx-auto text-outline-variant" />
                  <p>This link cannot be previewed here.</p>
                  <p className="text-[10px]">Use &ldquo;Open in Drive&rdquo; above to view the file.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
