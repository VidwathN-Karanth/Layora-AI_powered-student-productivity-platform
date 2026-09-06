'use client';
import { formatDate } from '@/lib/dateFormat';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useStore } from '@/store/useStore';
import { useUser } from '@clerk/nextjs';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { apiFetch } from '@/lib/apiClient';
import DriveThumb from '@/components/CertificateThumb';
import { SHARED_RESOURCE_TAG, normalizeResourceName, resolveResourceTag, shortCohortLabel, type Cohort } from '@/lib/cohorts';
import { 
  Globe, UploadCloud, File, Plus, Trash, FileText, 
  ExternalLink, RefreshCw, Loader2, Search, User, Clock, AlertCircle, Users
} from 'lucide-react';

interface GlobalResource {
  id: string;
  name: string;
  url: string;
  type: string;
  uploadedBy: string;
  uploaderName: string;
  createdAt: string;
}

export default function GlobalResourcesPage() {
  const store = useStore();
  const { user: clerkUser } = useUser();
  const currentUserEmail = clerkUser?.primaryEmailAddress?.emailAddress || '';
  // Decides which controls to draw, nothing more — every route behind these
  // buttons re-checks admin status server-side.
  const isAdmin = store.isAdmin;
  const cohort = store.cohort;

  // Component States
  const [resources, setResources] = useState<GlobalResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [shelfFilter, setShelfFilter] = useState<'All' | 'MyYear' | 'Shared'>('All');

  // Upload Form Panel States
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadMethod, setUploadMethod] = useState<'drive' | 'link'>('drive');
  const [fileName, setFileName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [fileData, setFileData] = useState<File | null>(null);
  const [fileType, setFileType] = useState('pdf');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<Record<string, string | undefined>>({});
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFileTypeBadge = (type: string) => {
    const ext = type.toLowerCase();
    let bgColor = 'bg-slate-800/80 border-slate-700 text-slate-300';
    let label = ext.toUpperCase();

    if (ext === 'pdf') {
      bgColor = 'bg-rose-950/80 border-rose-500/30 text-rose-400';
    } else if (['doc', 'docx'].includes(ext)) {
      bgColor = 'bg-blue-950/80 border-blue-500/30 text-blue-400';
      label = 'WORD';
    } else if (['ppt', 'pptx'].includes(ext)) {
      bgColor = 'bg-amber-950/80 border-amber-500/30 text-amber-400';
      label = 'PPT';
    } else if (['xls', 'xlsx'].includes(ext)) {
      bgColor = 'bg-emerald-950/80 border-emerald-500/30 text-emerald-400';
      label = 'EXCEL';
    } else if (ext === 'txt') {
      bgColor = 'bg-zinc-800/80 border-zinc-500/30 text-zinc-300';
      label = 'TXT';
    } else if (ext === 'link') {
      bgColor = 'bg-cyan-950/80 border-cyan-500/30 text-cyan-400';
      label = 'LINK';
    }

    return (
      <span className={`px-2 py-0.5 rounded text-[8px] font-bold border tracking-wider uppercase ${bgColor}`}>
        {label}
      </span>
    );
  };

  // Fetch all global resources
  const fetchGlobalResources = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      if (!isSupabaseConfigured) {
        setResources(store.globalResources || []);
        setLoading(false);
        return;
      }

      const res = await apiFetch('/api/resources/global');
      if (!res.ok) {
        throw new Error(`Failed to load shared resources: HTTP ${res.status}`);
      }
      const data = await res.json();
      const list = data.resources || [];
      list.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setResources(list);
      store.setGlobalResources(list);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Could not fetch global resources.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGlobalResources();
  }, []);

  // Clipboard Paste Support for Documents
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!showUploadForm || uploadMethod !== 'drive') return;
      
      const file = e.clipboardData?.files?.[0];
      if (file) {
        processSelectedFile(file);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [showUploadForm, uploadMethod]);

  const processSelectedFile = (file: File) => {
    if (file.type.startsWith('image/')) {
      setUploadErrors(prev => ({ ...prev, file: "Images/photos are not allowed. Please upload document files only." }));
      return;
    }
    if (file.type.startsWith('video/')) {
      setUploadErrors(prev => ({ ...prev, file: "Videos are not allowed. Please upload document files only." }));
      return;
    }
    const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
    setFileName(nameWithoutExt);
    setFileType(ext);
    setFileData(file);
    setUploadErrors(prev => ({ ...prev, file: undefined, fileName: undefined }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processSelectedFile(file);
  };

  /**
   * The document already holding the name being typed, if any.
   *
   * `resources` is the list this account can actually see — its own year plus
   * the shared shelf — which is exactly the set a duplicate name would be
   * confusing within. The server repeats this check and has the final say;
   * this copy exists so the student is told before a file is sent to Drive
   * rather than after.
   */
  const nameTakenBy = useMemo(() => {
    const wanted = normalizeResourceName(fileName);
    if (!wanted) return undefined;
    return resources.find((r) => normalizeResourceName(r.name) === wanted);
  }, [fileName, resources]);

  const NAME_TAKEN_MESSAGE = 'Name not available — a document with this name is already here. Please pick another.';

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    // Checked on both paths before any work is done, so a duplicate name can
    // never cost the student a Drive upload that is then rejected.
    if (nameTakenBy) {
      setUploadErrors({ fileName: NAME_TAKEN_MESSAGE });
      return;
    }

    if (uploadMethod === 'link') {
      if (!linkUrl.trim()) errors.link = "Web Link is required";
      if (!fileName.trim()) errors.fileName = "Document Name is required";

      if (Object.keys(errors).length > 0) {
        setUploadErrors(errors);
        return;
      }

      setIsUploading(true);
      try {
        const detectedType = linkUrl.split('?')[0].split('/').pop()?.split('.').pop()?.toLowerCase() || 'link';
        const finalType = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt'].includes(detectedType) ? detectedType : 'link';

        if (isSupabaseConfigured) {
          const res = await apiFetch('/api/resources/global', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // No `year` is sent: the server tags every student upload with the
            // uploader's own cohort, so nothing can land in another year's library.
            body: JSON.stringify({ name: fileName, url: linkUrl, type: finalType })
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            // A taken name belongs against the field, not in an alert.
            if (res.status === 409) {
              setUploadErrors({ fileName: errData.error || NAME_TAKEN_MESSAGE });
              setIsUploading(false);
              return;
            }
            throw new Error(errData.error || 'Failed to submit document link');
          }
          const data = await res.json();
          setResources(data.resources);
          store.setGlobalResources(data.resources);
        } else {
          const localItem = {
            id: `file-${Date.now()}`,
            name: fileName,
            url: linkUrl,
            type: finalType,
            year: cohort || SHARED_RESOURCE_TAG,
            uploadedBy: currentUserEmail || 'local_user',
            uploaderName: clerkUser?.fullName || 'Local Student',
            createdAt: new Date().toISOString()
          };
          store.addGlobalResource(localItem);
          setResources(prev => [localItem, ...prev]);
        }

        alert("Shared document link added successfully!");
        resetUploadForm();
      } catch (err: any) {
        alert(err.message || 'Failed to save link.');
      } finally {
        setIsUploading(false);
      }
      return;
    }

    // Direct Upload Path
    if (!fileData) errors.file = "Please select a document file";
    if (!fileName.trim()) errors.fileName = "Document Name is required";

    if (Object.keys(errors).length > 0 || !fileData) {
      setUploadErrors(errors);
      return;
    }

    const MAX_FILE_SIZE = 4.5 * 1024 * 1024;
    if (fileData.size > MAX_FILE_SIZE) {
      alert(`File is too large (${(fileData.size / (1024 * 1024)).toFixed(2)}MB).\n\nDirect uploads are limited to 4.5MB due to serverless platform body-size limits. Please upload this file directly to your Google Drive and add it here as a "Google Drive Link".`);
      return;
    }

    setIsUploading(true);
    setUploadErrors({});

    try {
      if (!isSupabaseConfigured) {
        throw new Error('Supabase / Google Drive integrations are not configured in local demo mode. Please use "Web / Google Drive Link" instead.');
      }

      const formData = new FormData();
      formData.append('file', fileData);
      formData.append('name', fileName);
      formData.append('makePublic', 'true');

      const uploadRes = await apiFetch('/api/resources/upload-drive', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const errData = await uploadRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to upload to Google Drive');
      }

      const uploadData = await uploadRes.json();
      const driveUrl = uploadData.file.url;

      const saveRes = await apiFetch('/api/resources/global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: fileName, url: driveUrl, type: fileType })
      });

      if (!saveRes.ok) {
        const errData = await saveRes.json().catch(() => ({}));
        // Someone claimed the name while this file was uploading. The file is
        // safely in the student's Drive; only the library entry was refused,
        // so say that plainly instead of the generic upload-failure advice.
        if (saveRes.status === 409) {
          setUploadErrors({ fileName: errData.error || NAME_TAKEN_MESSAGE });
          setIsUploading(false);
          return;
        }
        throw new Error(errData.error || 'Failed to register document in global library');
      }

      const saveData = await saveRes.json();
      setResources(saveData.resources);
      store.setGlobalResources(saveData.resources);

      alert(`${fileType.toUpperCase()} uploaded successfully to your Google Drive and shared with everyone!`);
      resetUploadForm();
    } catch (err: any) {
      console.error(err);
      alert(`Upload failed: ${err.message}\n\nFalling back: You can upload files manually to your Google Drive, copy the link, and paste it here under the "Web / Google Drive Link" tab.`);
    } finally {
      setIsUploading(false);
    }
  };

  const resetUploadForm = () => {
    setFileName('');
    setLinkUrl('');
    setFileData(null);
    setFileType('pdf');
    setUploadErrors({});
    setShowUploadForm(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this document from the global library?")) return;

    try {
      if (isSupabaseConfigured) {
        const res = await apiFetch(`/api/resources/global?id=${id}`, {
          method: 'DELETE'
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to delete resource');
        }
        const data = await res.json();
        setResources(data.resources);
        store.setGlobalResources(data.resources);
      } else {
        store.removeGlobalResource(id);
        setResources(prev => prev.filter(r => r.id !== id));
      }
      alert("Document removed successfully!");
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  const filteredResources = resources.filter(res => {
    const name = (res.name || '').toLowerCase();
    const uploader = (res.uploaderName || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    
    const matchesSearch = name.includes(query) || uploader.includes(query);

    // The server already scoped this list to the student's own year plus the
    // shared shelf, so the only useful split here is between those two.
    const tag = resolveResourceTag((res as any).year);
    const matchesShelf =
      shelfFilter === 'All' ||
      (shelfFilter === 'Shared' ? tag === SHARED_RESOURCE_TAG : tag !== SHARED_RESOURCE_TAG);

    return matchesSearch && matchesShelf;
  });

  const formatUploadedDate = (isoString: string) => formatDate(isoString, 'Unknown');

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="border-b border-outline-variant pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-mono font-bold tracking-wide flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            {cohort ? `${cohort} Shared Resources` : 'Shared Resources'}
          </h2>
          <p className="text-xs text-outline font-mono mt-0.5">
            {cohort
              ? `Notes and papers shared by your ${cohort} classmates, plus anything the department shares with everyone.`
              : 'Notes and papers shared by your classmates, plus anything the department shares with everyone.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowUploadForm(!showUploadForm)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-on-surface text-xs font-mono font-bold transition hover:bg-primary/95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {showUploadForm ? 'CLOSE CONSOLE' : 'SHARE DOCUMENT'}
          </button>
          <button
            onClick={fetchGlobalResources}
            disabled={loading}
            className="p-2 border border-outline-variant bg-white/3 rounded-xl hover:border-primary text-outline hover:text-white transition cursor-pointer"
            title="Reload Shared Files"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* --- FLOATING UPLOAD PANEL CONSOLE --- */}
      {showUploadForm && (
        <div className="glass-card rounded-2xl border border-primary/20 p-5 space-y-4 shadow-lg shadow-primary/5 animate-fade-in relative z-20">
          <div className="flex items-center gap-2 border-b border-outline-variant pb-2">
            <UploadCloud className="w-4 h-4 text-primary" />
            <span className="text-xs font-mono font-bold tracking-wider text-primary uppercase">Document Share Console</span>
          </div>

          <form onSubmit={handleUploadSubmit} className="space-y-4">
            {/* Tabs for Upload Method */}
            <div className="flex gap-2 p-1 bg-surface-container rounded-xl max-w-sm">
              <button
                type="button"
                onClick={() => { setUploadMethod('drive'); setUploadErrors({}); }}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase transition cursor-pointer ${
                  uploadMethod === 'drive'
                    ? 'bg-primary text-on-surface'
                    : 'text-outline hover:text-white'
                }`}
              >
                Direct File Upload
              </button>
              <button
                type="button"
                onClick={() => { 
                  setUploadMethod('link'); 
                  setUploadErrors({}); 
                  alert("Tips: Ensure the file is shared with \"Anyone with link\" on your Google Drive before adding.");
                }}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase transition cursor-pointer ${
                  uploadMethod === 'link'
                    ? 'bg-primary text-on-surface'
                    : 'text-outline hover:text-white'
                }`}
              >
                Web / Drive Link
              </button>
            </div>

            {uploadMethod === 'drive' ? (
              // Direct File Dropzone
              <div className="space-y-3">
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) processSelectedFile(file);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 relative overflow-hidden min-h-[140px] ${
                    isDragging
                      ? 'border-primary bg-primary/10'
                      : fileData
                        ? 'border-emerald-500/50 bg-emerald-950/5'
                        : 'border-outline-variant hover:border-primary hover:bg-white/2'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt"
                    className="hidden"
                  />
                  {fileData ? (
                    <>
                      <File className="w-8 h-8 text-emerald-400" />
                      <div className="text-xs font-mono font-bold text-emerald-400 truncate max-w-xs">{fileData.name}</div>
                      <div className="text-[9px] font-mono text-white/40">{(fileData.size / (1024 * 1024)).toFixed(2)} MB • Click to replace file</div>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-8 h-8 text-outline" />
                      <div className="text-xs font-mono font-semibold text-white">Drag & drop your study document here</div>
                      <div className="text-[9px] font-mono text-outline leading-normal max-w-xs">
                        Supports <strong>PDF, Word, PPT, Excel, TXT</strong>. Max size is <strong>4.5MB</strong>. Images/photos are not allowed.
                      </div>
                    </>
                  )}
                </div>
                {uploadErrors.file && (
                  <p className="text-red-500 text-[10px] font-mono">❌ {uploadErrors.file}</p>
                )}
              </div>
            ) : (
              // Web Link input
              <div className="space-y-1">
                <label className="block text-[10px] font-mono text-outline mb-1">Document Web URL / Google Drive Share Link</label>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => {
                    setLinkUrl(e.target.value);
                    setUploadErrors(prev => ({ ...prev, link: undefined }));
                  }}
                  placeholder="https://drive.google.com/file/d/... or http://..."
                  className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
                />
                {uploadErrors.link && (
                  <p className="text-red-500 text-[10px] font-mono mt-1">❌ {uploadErrors.link}</p>
                )}
                <span className="text-[8px] text-outline font-mono block mt-1">
                  💡 Tips: Ensure the file is shared with "Anyone with link" on your Google Drive before adding.
                </span>
              </div>
            )}

            {/* Document Alias Name */}
            <div>
              <label className="block text-[10px] font-mono text-outline mb-1">Document Display Name</label>
              <input
                type="text"
                value={fileName}
                onChange={(e) => {
                  setFileName(e.target.value);
                  setUploadErrors(prev => ({ ...prev, fileName: undefined }));
                }}
                placeholder="e.g. Physics Semester 2 Lecture Notes"
                className={`w-full bg-surface-container border rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none font-mono ${
                  nameTakenBy ? 'border-red-500/70 focus:border-red-500' : 'border-outline-variant focus:border-primary'
                }`}
              />
              {uploadErrors.fileName ? (
                <p className="text-red-500 text-[10px] font-mono mt-1">❌ {uploadErrors.fileName}</p>
              ) : nameTakenBy ? (
                /* Said while typing, so a duplicate is caught before a file is
                   ever sent to Drive. */
                <p className="text-red-500 text-[10px] font-mono mt-1">
                  ❌ Name not available — already used by a document from{' '}
                  {nameTakenBy.uploaderName || 'another student'}. Please pick another.
                </p>
              ) : null}
            </div>

            {/* Where this lands is decided by the roster, not by the uploader. */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-primary/5 border border-primary/20">
              <Users className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              <p className="text-[10px] font-mono text-outline leading-relaxed">
                {cohort
                  ? <>This will be shared with your <strong className="text-primary">{cohort}</strong> classmates. Other years will not see it.</>
                  : <>This will be shared with your own year group only.</>}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isUploading || Boolean(nameTakenBy)}
                className="bg-primary hover:bg-primary-container text-on-surface rounded-lg px-4 py-2 text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    SHARING...
                  </>
                ) : (
                  'CONFIRM SHARE'
                )}
              </button>
              <button
                type="button"
                onClick={resetUploadForm}
                className="border border-outline-variant bg-white/2 hover:bg-surface-container text-on-surface-variant rounded-lg px-4 py-2 text-xs font-mono transition cursor-pointer"
              >
                CANCEL
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- SEARCH & FILTER SECTION --- */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-white/30" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search shared files or uploaders..."
            className="w-full bg-black/40 border border-outline-variant rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-primary font-mono"
          />
        </div>
        
        {/* Shelf filter — a student can only ever reach their own year and the
            department-wide shelf, so those are the only two options offered. */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-surface-container rounded-xl border border-outline-variant/30 self-start md:self-auto">
          {([
            { key: 'All', label: 'All' },
            { key: 'MyYear', label: cohort ? shortCohortLabel(cohort) : 'My Year' },
            { key: 'Shared', label: 'Everyone' },
          ] as const).map((opt) => (
            <button
              key={opt.key}
              onClick={() => setShelfFilter(opt.key)}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-mono font-bold uppercase transition cursor-pointer ${
                shelfFilter === opt.key
                  ? 'bg-primary text-on-surface'
                  : 'text-outline hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* --- SHARED DOCUMENTS LIBRARY PANEL (RECTANGULAR CARDS) --- */}
      {loading ? (
        <div className="glass-card rounded-2xl border border-outline-variant p-12 text-center text-outline text-xs flex flex-col items-center gap-3 font-mono">
          <RefreshCw className="w-5 h-5 animate-spin text-primary" />
          Loading shared library files...
        </div>
      ) : errorMsg ? (
        <div className="glass-card rounded-2xl border border-outline-variant p-12 text-center text-rose-300 text-xs flex flex-col items-center gap-2 font-mono">
          <AlertCircle className="w-5 h-5 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      ) : filteredResources.length === 0 ? (
        <div className="glass-card rounded-2xl border border-outline-variant p-12 text-center text-outline text-xs font-mono leading-relaxed">
          No global resources found. Be the first to share a study notes document!
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 font-mono text-xs">
          {filteredResources.map((res) => {
            const isOwner = res.uploadedBy.toLowerCase() === currentUserEmail.toLowerCase();

            return (
              <div 
                key={res.id} 
                className={`glass-card rounded-2xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-lg flex flex-col overflow-hidden group ${
                  isOwner 
                    ? 'border-primary/45 hover:border-primary shadow-primary/5 hover:shadow-primary/10' 
                    : 'border-outline-variant hover:border-primary/50'
                }`}
              >
                {/* Document Preview Area */}
                <div className="aspect-[3/2] bg-black/40 relative overflow-hidden flex items-center justify-center border-b border-outline-variant/30">
                  {/* A Drive thumbnail when the file is shared link-visible, and a
                      labelled file tile when it is not. The old markup hid a failed
                      image and drew nothing in its place, leaving a black rectangle. */}
                  <DriveThumb
                    url={res.url}
                    name={res.name}
                    iconClass="text-primary/40 group-hover:text-primary/60"
                    labelClass="text-outline"
                    label="No preview"
                  />
                  
                  {/* File type, and which shelf this came from */}
                  <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
                    {getFileTypeBadge(res.type)}
                    {resolveResourceTag((res as any).year) === SHARED_RESOURCE_TAG ? (
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-bold border tracking-wider bg-black/60 border-primary/30 text-primary uppercase">
                        Everyone
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-bold border tracking-wider bg-black/60 border-white/10 text-white/90 uppercase">
                        {shortCohortLabel(resolveResourceTag((res as any).year) as Cohort)}
                      </span>
                    )}
                  </div>

                  {/* Actions Overlay */}
                  <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3">
                    <a
                      href={res.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-xl border border-outline-variant bg-[#1A1D22]/90 hover:border-primary text-outline hover:text-white transition-all scale-90 group-hover:scale-100 duration-300"
                      title="Open/View Document"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    {(isOwner || isAdmin) && (
                      <button
                        onClick={() => handleDelete(res.id)}
                        className="p-2.5 rounded-xl border border-red-500/20 bg-red-950/80 hover:border-red-500 text-outline hover:text-red-400 transition-all scale-90 group-hover:scale-100 duration-300 cursor-pointer"
                        title="Delete Shared Document"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Card Info Area */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3 bg-white/[0.02]">
                  <div className="space-y-2">
                    <h4 
                      className="font-bold text-on-surface text-xs leading-snug line-clamp-2 min-h-[32px] group-hover:text-primary transition-colors duration-300"
                      title={res.name}
                    >
                      {res.name}
                    </h4>
                    
                    <div className="flex items-center gap-1.5 text-[10px] text-outline">
                      <User className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="truncate max-w-[140px] font-semibold text-white/85">{res.uploaderName}</span>
                      {isOwner && (
                        <span className="text-[8px] bg-primary/10 text-primary border border-primary/20 px-1 py-px rounded uppercase scale-90 font-extrabold">YOU</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[9px] text-outline/65 border-t border-outline-variant/35 pt-2.5">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-primary/60" />
                      {formatUploadedDate(res.createdAt)}
                    </span>
                    <span className="uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-white/5 border border-outline-variant/25 text-white/60">
                      {res.type}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
