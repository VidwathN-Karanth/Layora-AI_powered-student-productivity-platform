'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ExternalLink, FileText, Globe, Link2, Loader2, Plus, RefreshCw, Search, Trash,
  UploadCloud, Users,
} from 'lucide-react';

import { apiFetch, errorMessage, readJson } from '@/lib/apiClient';
import { formatDate } from '@/lib/dateFormat';
import {
  SHARED_RESOURCE_TAG, normalizeResourceName, resolveResourceTag, shortCohortLabel,
} from '@/lib/cohorts';
import DriveThumb from '@/components/CertificateThumb';
import { useAdmin } from '../AdminContext';
import { PanelEmpty, PanelError, PanelLoading, SectionHeader } from '../_components/PanelState';
import { useSectionData } from '../_components/useSectionData';

/* ────────────────────────────────────────────────────────────────
   The shared library, from the staff side.

   Staff can now do here exactly what a student does on their own Global
   Resources page — pick a PDF and upload it — rather than only being able to
   paste a link. The one thing that differs is the audience: a student's upload
   is always tagged with their own year, while staff choose between one year
   and the shared shelf every year can see.

   The file goes to the uploader's own Google Drive, shared as "anyone with the
   link", and Layora keeps the link. That is what keeps the department off the
   hook for hundreds of megabytes of scanned notes.
   ──────────────────────────────────────────────────────────────── */

interface GlobalResource {
  id: string;
  name: string;
  url: string;
  type?: string;
  year?: string;
  uploadedBy: string;
  uploaderName?: string;
  createdAt?: string;
}

/** Vercel refuses a request body past this, so it is checked before sending. */
const MAX_UPLOAD_BYTES = 4.5 * 1024 * 1024;

const DOCUMENT_TYPES = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt'];

const NAME_TAKEN_MESSAGE =
  'Name not available — a document with this name is already in this library. Please pick another.';

const sortByNewest = (list: GlobalResource[]): GlobalResource[] =>
  list.slice().sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

/** The extension a link or file name implies, or 'link' when it implies none. */
function detectType(source: string): string {
  const guess = source.split('?')[0].split('/').pop()?.split('.').pop()?.toLowerCase() || '';
  return DOCUMENT_TYPES.includes(guess) ? guess : 'link';
}

function typeBadge(type: string) {
  const ext = (type || 'link').toLowerCase();
  const styles: Record<string, [string, string]> = {
    pdf: ['bg-rose-950/80 border-rose-500/30 text-rose-400', 'PDF'],
    doc: ['bg-blue-950/80 border-blue-500/30 text-blue-400', 'WORD'],
    docx: ['bg-blue-950/80 border-blue-500/30 text-blue-400', 'WORD'],
    ppt: ['bg-amber-950/80 border-amber-500/30 text-amber-400', 'PPT'],
    pptx: ['bg-amber-950/80 border-amber-500/30 text-amber-400', 'PPT'],
    xls: ['bg-emerald-950/80 border-emerald-500/30 text-emerald-400', 'EXCEL'],
    xlsx: ['bg-emerald-950/80 border-emerald-500/30 text-emerald-400', 'EXCEL'],
    txt: ['bg-zinc-800/80 border-zinc-500/30 text-zinc-300', 'TXT'],
    link: ['bg-cyan-950/80 border-cyan-500/30 text-cyan-400', 'LINK'],
  };
  const [tone, label] = styles[ext] || ['bg-slate-800/80 border-slate-700 text-slate-300', ext.toUpperCase()];
  return (
    <span className={`px-2 py-0.5 rounded text-[8px] font-bold border tracking-wider uppercase ${tone}`}>
      {label}
    </span>
  );
}

export default function AdminGlobalResourcesPage() {
  const { selectedCohort } = useAdmin();

  const [resources, setResources] = useState<GlobalResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [shelf, setShelf] = useState<'all' | 'year' | 'shared'>('all');
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Upload console
  const [showForm, setShowForm] = useState(false);
  const [method, setMethod] = useState<'file' | 'link'>('file');
  const [docName, setDocName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState('pdf');
  const [audience, setAudience] = useState<'cohort' | 'everyone'>('cohort');
  const [uploading, setUploading] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string | undefined>>({});
  const [notice, setNotice] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    // Only the outcome banner: the search box and the shelf filter are the
    // reader's, and a reload is not a reason to throw either away.
    setNotice('');
    try {
      const data = await readJson<{ resources?: GlobalResource[] }>(
        await apiFetch(`/api/resources/global?cohort=${encodeURIComponent(selectedCohort)}`)
      );
      setResources(sortByNewest(data.resources || []));
    } catch (err) {
      setError(errorMessage(err, 'Could not load the shared library.'));
    } finally {
      setLoading(false);
    }
  }, [selectedCohort]);

  useSectionData(load);

  /**
   * The document already holding the name being typed, if any.
   *
   * `resources` is what this year's students would see, which is the set a
   * duplicate name would be confusing within. The server repeats this check
   * and has the final say — publishing to the shared shelf collides with every
   * year at once, and only the server can see all of them.
   */
  const nameTakenBy = useMemo(() => {
    const wanted = normalizeResourceName(docName);
    if (!wanted) return undefined;
    return resources.find((r) => normalizeResourceName(r.name) === wanted);
  }, [docName, resources]);

  const resetForm = () => {
    setDocName('');
    setLinkUrl('');
    setFile(null);
    setFileType('pdf');
    setAudience('cohort');
    setFormErrors({});
    setShowForm(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const acceptFile = (chosen: File) => {
    if (chosen.type.startsWith('image/') || chosen.type.startsWith('video/')) {
      setFormErrors((prev) => ({ ...prev, file: 'Photos and videos are not documents — upload a PDF or an Office file.' }));
      return;
    }
    setDocName(chosen.name.substring(0, chosen.name.lastIndexOf('.')) || chosen.name);
    setFileType(detectType(chosen.name) === 'link' ? 'pdf' : detectType(chosen.name));
    setFile(chosen);
    setFormErrors((prev) => ({ ...prev, file: undefined, name: undefined }));
  };

  /** Saves the library entry once a URL exists, whichever route produced it. */
  const registerResource = async (name: string, url: string, type: string): Promise<boolean> => {
    const res = await apiFetch(`/api/resources/global?cohort=${encodeURIComponent(selectedCohort)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        url,
        type,
        year: audience === 'everyone' ? SHARED_RESOURCE_TAG : selectedCohort,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      // A taken name belongs against the field, not in a banner.
      if (res.status === 409) {
        setFormErrors({ name: body.error || NAME_TAKEN_MESSAGE });
        return false;
      }
      throw new Error(body.error || 'Failed to add the document to the library.');
    }

    const data = await res.json();
    setResources(sortByNewest(data.resources || []));
    return true;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');

    // Checked on both routes before any work is done, so a duplicate name can
    // never cost a Drive upload that is then rejected.
    if (nameTakenBy) {
      setFormErrors({ name: NAME_TAKEN_MESSAGE });
      return;
    }
    if (!docName.trim()) {
      setFormErrors({ name: 'Give the document a name.' });
      return;
    }

    if (method === 'link') {
      if (!linkUrl.trim()) {
        setFormErrors({ link: 'A link is required.' });
        return;
      }
      setUploading(true);
      try {
        if (await registerResource(docName.trim(), linkUrl.trim(), detectType(linkUrl))) {
          setNotice('Link shared with the library.');
          resetForm();
        }
      } catch (err) {
        setError(errorMessage(err, 'Failed to share that link.'));
      } finally {
        setUploading(false);
      }
      return;
    }

    if (!file) {
      setFormErrors({ file: 'Choose a document to upload.' });
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setFormErrors({
        file:
          `That file is ${(file.size / (1024 * 1024)).toFixed(1)}MB. Direct uploads are capped at 4.5MB by the ` +
          'hosting platform — put it in Google Drive yourself and share the link instead.',
      });
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('name', docName.trim());
      form.append('makePublic', 'true');

      const uploaded = await readJson<{ file: { url: string } }>(
        await apiFetch('/api/resources/upload-drive', { method: 'POST', body: form })
      );

      if (await registerResource(docName.trim(), uploaded.file.url, fileType)) {
        setNotice(
          `${fileType.toUpperCase()} uploaded to your Google Drive and shared with ` +
          `${audience === 'everyone' ? 'every year' : selectedCohort}.`
        );
        resetForm();
      }
    } catch (err) {
      setError(
        `${errorMessage(err, 'The upload failed.')} You can still upload the file to Google Drive ` +
        'yourself and add it here as a link.'
      );
    } finally {
      setUploading(false);
    }
  };

  const remove = async (resource: GlobalResource) => {
    if (!confirm(`Remove "${resource.name}" from the shared library? Students will no longer see it.`)) return;

    setRemovingId(resource.id);
    setError('');
    try {
      const data = await readJson<{ resources?: GlobalResource[] }>(
        await apiFetch(
          `/api/resources/global?id=${encodeURIComponent(resource.id)}&cohort=${encodeURIComponent(selectedCohort)}`,
          { method: 'DELETE' }
        )
      );
      setResources(sortByNewest(data.resources || []));
    } catch (err) {
      setError(errorMessage(err, 'Could not remove that document.'));
    } finally {
      setRemovingId(null);
    }
  };

  const filtered = resources.filter((r) => {
    const needle = query.toLowerCase();
    const matchesSearch =
      (r.name || '').toLowerCase().includes(needle) ||
      (r.uploaderName || '').toLowerCase().includes(needle);

    const tag = resolveResourceTag(r.year);
    const matchesShelf =
      shelf === 'all' ||
      (shelf === 'shared' ? tag === SHARED_RESOURCE_TAG : tag !== SHARED_RESOURCE_TAG);

    return matchesSearch && matchesShelf;
  });

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Globe}
        title="Global Resources"
        subtitle={`Notes and papers ${selectedCohort} students can see, plus anything shared with every year.`}
      >
        <button
          onClick={() => { setShowForm(!showForm); setFormErrors({}); setNotice(''); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-mono font-bold transition hover:bg-primary/90 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {showForm ? 'CLOSE CONSOLE' : 'SHARE A DOCUMENT'}
        </button>
        <button
          onClick={load}
          disabled={loading}
          aria-label="Reload"
          className="p-2 border border-outline-variant bg-white/3 rounded-xl hover:border-primary text-outline hover:text-white transition cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </SectionHeader>

      {notice && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-mono">
          {notice}
        </div>
      )}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-950/20 border border-red-500/25 text-red-300 text-xs font-mono leading-relaxed">
          {error}
        </div>
      )}

      {/* ---- Upload console ---- */}
      {showForm && (
        <form onSubmit={submit} className="glass-card rounded-2xl border border-outline-variant p-5 space-y-5">
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-outline-variant">
            {([
              { key: 'file' as const, label: 'Upload a file', Icon: UploadCloud },
              { key: 'link' as const, label: 'Paste a link', Icon: Link2 },
            ]).map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => { setMethod(key); setFormErrors({}); }}
                aria-pressed={method === key}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition cursor-pointer ${
                  method === key ? 'bg-primary text-white' : 'text-outline hover:text-on-surface'
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>

          {method === 'file' ? (
            <div className="space-y-1.5">
              <span className="block text-[10px] font-mono uppercase tracking-wider text-outline">Document</span>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  const dropped = e.dataTransfer.files?.[0];
                  if (dropped) acceptFile(dropped);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`rounded-xl border border-dashed p-6 text-center cursor-pointer transition ${
                  dragging ? 'border-primary bg-primary/5' : 'border-outline-variant hover:border-primary/60'
                }`}
              >
                <UploadCloud className="w-6 h-6 mx-auto text-outline" />
                <p className="mt-2 text-xs font-mono text-on-surface-variant">
                  {file ? file.name : 'Drop a PDF here, or click to choose one'}
                </p>
                <p className="mt-1 text-[10px] font-mono text-outline">
                  PDF, Word, PowerPoint, Excel or text · up to 4.5MB · goes to your Google Drive
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const chosen = e.target.files?.[0];
                    if (chosen) acceptFile(chosen);
                  }}
                />
              </div>
              {formErrors.file && <p className="text-[10px] font-mono text-red-400 leading-relaxed">{formErrors.file}</p>}
            </div>
          ) : (
            <div className="space-y-1.5">
              <label htmlFor="res-link" className="block text-[10px] font-mono uppercase tracking-wider text-outline">
                Link
              </label>
              <input
                id="res-link"
                value={linkUrl}
                onChange={(e) => { setLinkUrl(e.target.value); setFormErrors((p) => ({ ...p, link: undefined })); }}
                placeholder="https://drive.google.com/…"
                className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface placeholder-outline focus:outline-none focus:border-primary"
              />
              {formErrors.link && <p className="text-[10px] font-mono text-red-400">{formErrors.link}</p>}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="res-name" className="block text-[10px] font-mono uppercase tracking-wider text-outline">
              Document name
            </label>
            <input
              id="res-name"
              value={docName}
              onChange={(e) => { setDocName(e.target.value); setFormErrors((p) => ({ ...p, name: undefined })); }}
              placeholder="e.g. Semester 5 exam calendar"
              className="w-full bg-surface-container border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface placeholder-outline focus:outline-none focus:border-primary"
            />
            {(formErrors.name || nameTakenBy) && (
              <p className="text-[10px] font-mono text-red-400 leading-relaxed">
                {formErrors.name || NAME_TAKEN_MESSAGE}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <span className="block text-[10px] font-mono uppercase tracking-wider text-outline">Who can see it</span>
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-outline-variant">
              {([
                { key: 'cohort' as const, label: `${selectedCohort} only` },
                { key: 'everyone' as const, label: 'Every year' },
              ]).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setAudience(opt.key)}
                  aria-pressed={audience === opt.key}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition cursor-pointer ${
                    audience === opt.key ? 'bg-emerald-500 text-black' : 'text-outline hover:text-on-surface'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] font-mono text-outline leading-relaxed">
              &ldquo;Every year&rdquo; puts it on the shared shelf — 2nd, 3rd and 4th year all see it.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={uploading || Boolean(nameTakenBy)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-bold uppercase tracking-wider transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              {uploading ? 'Sharing…' : 'Share'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 rounded-lg border border-outline-variant hover:border-outline text-outline hover:text-on-surface text-xs font-bold uppercase tracking-wider transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ---- Filters ---- */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-outline" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or who shared it…"
            aria-label="Search the library"
            className="w-full bg-surface-container border border-outline-variant rounded-xl pl-9 pr-4 py-2 text-xs text-on-surface placeholder-outline focus:outline-none focus:border-primary"
          />
        </div>
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-outline-variant w-max">
          {([
            { key: 'all' as const, label: 'All' },
            { key: 'year' as const, label: shortCohortLabel(selectedCohort) },
            { key: 'shared' as const, label: 'Every year' },
          ]).map((opt) => (
            <button
              key={opt.key}
              onClick={() => setShelf(opt.key)}
              aria-pressed={shelf === opt.key}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition cursor-pointer ${
                shelf === opt.key ? 'bg-cyber-blue text-white' : 'text-outline hover:text-on-surface'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ---- The library ---- */}
      {loading ? (
        <PanelLoading message="Loading the shared library…" accent="text-emerald-400" />
      ) : error && resources.length === 0 ? (
        <PanelError message={error} onRetry={load} />
      ) : filtered.length === 0 ? (
        <PanelEmpty>
          {resources.length === 0
            ? `Nothing has been shared with ${selectedCohort} yet.`
            : 'No document matches that search.'}
        </PanelEmpty>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((res) => {
            const tag = resolveResourceTag(res.year);
            return (
              <article
                key={res.id}
                className="glass-card rounded-2xl border border-outline-variant overflow-hidden flex flex-col group"
              >
                <a
                  href={res.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-32 items-center justify-center bg-black/30 border-b border-outline-variant overflow-hidden"
                  title={`Open ${res.name}`}
                >
                  <DriveThumb url={res.url} name={res.name} />
                </a>

                <div className="p-4 space-y-3 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-xs font-mono font-bold text-on-surface leading-snug break-words min-w-0">
                      {res.name}
                    </h3>
                    {typeBadge(res.type || 'link')}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap text-[9px] font-mono text-outline">
                    <span className={`px-2 py-0.5 rounded border uppercase tracking-wider font-bold ${
                      tag === SHARED_RESOURCE_TAG
                        ? 'border-violet-500/30 bg-violet-500/10 text-violet-300'
                        : 'border-white/10 bg-white/5 text-white/60'
                    }`}>
                      {tag === SHARED_RESOURCE_TAG ? 'Every year' : tag}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="w-2.5 h-2.5" /> {res.uploaderName || res.uploadedBy}
                    </span>
                    <span>{formatDate(res.createdAt, 'Unknown date')}</span>
                  </div>

                  <div className="flex items-center gap-2 mt-auto pt-1">
                    <a
                      href={res.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-outline-variant hover:border-primary text-outline hover:text-primary py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider transition"
                    >
                      <ExternalLink className="w-3 h-3" /> Open
                    </a>
                    <button
                      onClick={() => remove(res)}
                      disabled={removingId === res.id}
                      aria-label={`Remove ${res.name}`}
                      className="p-2 rounded-lg border border-outline-variant hover:border-rose-400 text-outline hover:text-rose-400 transition cursor-pointer disabled:opacity-40"
                      title="Remove from the library"
                    >
                      <Trash className={`w-3.5 h-3.5 ${removingId === res.id ? 'animate-pulse' : ''}`} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="flex items-start gap-2 text-[10px] font-mono text-outline leading-relaxed">
        <FileText className="w-3 h-3 mt-0.5 shrink-0" />
        Uploads land in your own Google Drive, shared as &ldquo;anyone with the link&rdquo;. Removing a
        document here takes it out of the library; the file itself stays in your Drive.
      </p>
    </div>
  );
}
