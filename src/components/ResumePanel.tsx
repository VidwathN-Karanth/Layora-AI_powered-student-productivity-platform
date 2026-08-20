'use client';

import { useEffect, useRef, useState } from 'react';
import {
  FileText, UploadCloud, Link2, X, ExternalLink, Loader2, Check, Lock,
} from 'lucide-react';
import { apiFetch, readJson, errorMessage } from '@/lib/apiClient';

interface Resume {
  url: string;
  name: string | null;
  uploadedAt: string | null;
}

/** Vercel caps a serverless request body at ~4.5 MB, so anything larger has to
 *  go to Drive by hand and come back as a link. */
const MAX_DIRECT_UPLOAD = 4.5 * 1024 * 1024;

const isPdf = (file: File) =>
  file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

type PickResult = { ok: true; file: File } | { ok: false; error: string };

/** Pure: decides whether a dropped/pasted/browsed file is an acceptable CV. */
function validateResumeFile(f: File): PickResult {
  if (!isPdf(f)) {
    return { ok: false, error: 'Only PDF files are accepted. Export your CV as a PDF and try again.' };
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

export default function ResumePanel() {
  const [resume, setResume] = useState<Resume | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'upload' | 'link'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // `loading` already starts true, so nothing is set synchronously here — every
  // update happens after the await, and is dropped if the panel unmounted first.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await readJson<{ resume: Resume | null }>(await apiFetch('/api/user/resume'));
        if (!cancelled) setResume(data.resume);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err, 'Could not load your CV.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const applyPick = (f: File | null | undefined) => {
    if (!f) return;
    const result = validateResumeFile(f);
    if (result.ok) {
      setError('');
      setFile(result.file);
    } else {
      setFile(null);
      setError(result.error);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);

    try {
      let url: string;
      let name: string;

      if (mode === 'upload') {
        if (!file) throw new Error('Choose a PDF first.');

        // Goes into the student's own Drive, shared by link so staff can open it.
        const form = new FormData();
        form.append('file', file);
        form.append('name', file.name);
        form.append('makePublic', 'true');

        const uploaded = await readJson<{ file: { url: string } }>(
          await apiFetch('/api/resources/upload-drive', { method: 'POST', body: form })
        );
        url = uploaded.file.url;
        name = file.name;
      } else {
        if (!linkUrl.trim()) throw new Error('Paste a link to your CV.');
        url = linkUrl.trim();
        name = 'Resume';
      }

      const data = await readJson<{ resume: Resume }>(
        await apiFetch('/api/user/resume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, name }),
        })
      );

      setResume(data.resume);
      setFile(null);
      setLinkUrl('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(errorMessage(err, 'Could not save your CV.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm('Remove your CV? Staff will no longer be able to see it, and you can then upload a new one.')) return;
    setBusy(true);
    setError('');
    try {
      await readJson(await apiFetch('/api/user/resume', { method: 'DELETE' }));
      setResume(null);
    } catch (err) {
      setError(errorMessage(err, 'Could not remove your CV.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2.5 border-b border-outline-variant pb-2">
        <FileText className="w-4 h-4 text-primary" />
        <h3 className="text-xs font-mono font-bold tracking-wider text-primary">Resume / CV</h3>
      </div>

      <div className="flex items-start gap-2 text-[10px] font-mono text-outline leading-relaxed">
        <Lock className="w-3 h-3 mt-0.5 shrink-0" />
        <p>Only you and the department staff can see your CV. Other students cannot.</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-outline font-mono py-4">
          <Loader2 className="w-4 h-4 animate-spin text-primary" /> Loading your CV...
        </div>
      ) : resume ? (
        /* One CV at a time: while this exists there is no upload form. */
        <div className="space-y-2.5">
          <div className="bg-surface-container border border-outline-variant rounded-xl p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-on-surface truncate">{resume.name || 'Resume'}</div>
              <div className="text-[9px] font-mono text-outline">
                {resume.uploadedAt ? `Uploaded ${new Date(resume.uploadedAt).toLocaleDateString()}` : 'Uploaded'}
              </div>
            </div>
            <a
              href={resume.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg border border-outline-variant hover:border-primary text-outline hover:text-primary transition shrink-0"
              title="Open your CV"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={remove}
              disabled={busy}
              aria-label="Remove your CV"
              className="p-2 rounded-lg border border-outline-variant hover:border-red-400 hover:bg-red-500/10 text-outline hover:text-red-400 transition cursor-pointer shrink-0 disabled:opacity-40"
              title="Remove your CV"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="text-[9px] font-mono text-outline">
            Only one CV can be stored. To upload a different one, remove this with the &times; first.
          </p>
          {error && <p className="text-red-500 text-[10px] font-mono">{error}</p>}
        </div>
      ) : (
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {([
              { key: 'upload' as const, label: 'Upload PDF', Icon: UploadCloud },
              { key: 'link' as const, label: 'Paste link', Icon: Link2 },
            ]).map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => { setMode(key); setError(''); }}
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
            <div>
              {/* Drop zone: drag a PDF in, paste one, or click to browse. */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  applyPick(e.dataTransfer.files?.[0]);
                }}
                onPaste={(e) => applyPick(e.clipboardData?.files?.[0])}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                className={`rounded-xl border border-dashed p-6 flex flex-col items-center justify-center gap-2 text-center cursor-pointer transition ${
                  isDragging
                    ? 'border-primary bg-primary/10'
                    : file
                      ? 'border-emerald-500/40 bg-emerald-500/5'
                      : 'border-outline-variant bg-surface-container hover:border-primary/50'
                }`}
              >
                {file ? (
                  <>
                    <FileText className="w-6 h-6 text-emerald-400" />
                    <div className="min-w-0 w-full">
                      <p className="text-xs font-bold text-on-surface truncate px-2">{file.name}</p>
                      <p className="text-[9px] font-mono text-outline mt-0.5">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB &middot; ready to upload
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
                    <UploadCloud className={`w-6 h-6 ${isDragging ? 'text-primary' : 'text-outline'}`} />
                    <p className="text-xs text-on-surface-variant">
                      Drop your PDF here, paste it, or <span className="text-primary font-semibold">browse</span>
                    </p>
                    <p className="text-[9px] font-mono text-outline">PDF only &middot; up to 4.5 MB</p>
                  </>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => applyPick(e.target.files?.[0])}
                className="hidden"
              />
              <p className="text-[9px] font-mono text-outline mt-1.5">
                Saved to your own Google Drive.
              </p>
            </div>
          ) : (
            <div>
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://drive.google.com/file/d/..."
                className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
              />
              <p className="text-[9px] font-mono text-outline mt-1.5">
                Make sure the link is viewable by anyone with it, or staff will not be able to open it.
              </p>
            </div>
          )}

          {error && <p className="text-red-500 text-[10px] font-mono">{error}</p>}
          {saved && (
            <p className="text-emerald-400 text-[10px] font-mono flex items-center gap-1.5">
              <Check className="w-3 h-3" /> CV saved
            </p>
          )}

          <button
            type="submit"
            disabled={busy || (mode === 'upload' ? !file : !linkUrl.trim())}
            className="bg-primary hover:bg-primary/90 text-white rounded-lg px-4 py-2 text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? (<><Loader2 className="w-3.5 h-3.5 animate-spin" /> SAVING...</>) : 'SAVE CV'}
          </button>
        </form>
      )}
    </div>
  );
}
