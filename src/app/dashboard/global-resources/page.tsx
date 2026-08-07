'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '@/store/useStore';
import { useUser } from '@clerk/nextjs';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { isAdminEmail } from '@/lib/admin';
import { 
  Globe, UploadCloud, File, Plus, Trash, FileText, 
  ExternalLink, RefreshCw, Loader2, Search, User, Clock, AlertCircle
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
  const isAdmin = isAdminEmail(currentUserEmail) || isAdminEmail(store.user?.email);

  // Component States
  const [resources, setResources] = useState<GlobalResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Upload Form Panel States
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadMethod, setUploadMethod] = useState<'drive' | 'link'>('drive');
  const [fileName, setFileName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [fileData, setFileData] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<Record<string, string | undefined>>({});
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch all global resources
  const fetchGlobalResources = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      if (!isSupabaseConfigured) {
        // Fallback for local demo mode
        setResources(store.globalResources || []);
        setLoading(false);
        return;
      }

      const res = await fetch('/api/resources/global');
      if (!res.ok) {
        throw new Error(`Failed to load shared resources: HTTP ${res.status}`);
      }
      const data = await res.json();
      const list = data.resources || [];
      // Sort by creation date descending
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

  // Handle Drag & Drop events
  const processSelectedFile = (file: File) => {
    if (file.type !== 'application/pdf') {
      setUploadErrors(prev => ({ ...prev, file: "Only PDF files are allowed for direct uploads" }));
      return;
    }
    const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    setFileName(nameWithoutExt);
    setFileData(file);
    setUploadErrors(prev => ({ ...prev, file: undefined, fileName: undefined }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processSelectedFile(file);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (uploadMethod === 'link') {
      if (!linkUrl.trim()) errors.link = "Web Link is required";
      if (!fileName.trim()) errors.fileName = "Document Name is required";

      if (Object.keys(errors).length > 0) {
        setUploadErrors(errors);
        return;
      }

      setIsUploading(true);
      try {
        if (isSupabaseConfigured) {
          const res = await fetch('/api/resources/global', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: fileName, url: linkUrl, type: 'link' })
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || 'Failed to submit document link');
          }
          const data = await res.json();
          setResources(data.resources);
          store.setGlobalResources(data.resources);
        } else {
          // Local mode
          const localItem = {
            id: `file-${Date.now()}`,
            name: fileName,
            url: linkUrl,
            type: 'link',
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
    if (!fileData) errors.file = "Please select a PDF file";
    if (!fileName.trim()) errors.fileName = "Document Name is required";

    if (Object.keys(errors).length > 0 || !fileData) {
      setUploadErrors(errors);
      return;
    }

    // Direct upload limit (4.5MB Vercel serverless platform body limit)
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

      // 1. Post to user's Google Drive proxy, flag to makePublic
      const formData = new FormData();
      formData.append('file', fileData);
      formData.append('name', fileName);
      formData.append('makePublic', 'true');

      const uploadRes = await fetch('/api/resources/upload-drive', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const errData = await uploadRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to upload to Google Drive');
      }

      const uploadData = await uploadRes.json();
      const driveUrl = uploadData.file.url;

      // 2. Post metadata to Global List
      const saveRes = await fetch('/api/resources/global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: fileName, url: driveUrl, type: 'pdf' })
      });

      if (!saveRes.ok) {
        const errData = await saveRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to register document in global library');
      }

      const saveData = await saveRes.json();
      setResources(saveData.resources);
      store.setGlobalResources(saveData.resources);

      alert("PDF uploaded successfully to your Google Drive and shared with everyone!");
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
    setUploadErrors({});
    setShowUploadForm(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Delete Resource Handler
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this document from the global library?")) return;

    try {
      if (isSupabaseConfigured) {
        const res = await fetch(`/api/resources/global?id=${id}`, {
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
        // Local mode
        store.removeGlobalResource(id);
        setResources(prev => prev.filter(r => r.id !== id));
      }
      alert("Document removed successfully!");
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  // Filtered resource list
  const filteredResources = resources.filter(res => {
    const name = (res.name || '').toLowerCase();
    const uploader = (res.uploaderName || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    return name.includes(query) || uploader.includes(query);
  });

  const formatUploadedDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch (e) {
      return 'Unknown';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="border-b border-outline-variant pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-mono font-bold tracking-wide flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            Global Shared Resources
          </h2>
          <p className="text-xs text-outline font-mono mt-0.5">
            Access, view, and share academic PDFs with the entire student body.
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
                Direct PDF Upload
              </button>
              <button
                type="button"
                onClick={() => { setUploadMethod('link'); setUploadErrors({}); }}
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
                    accept=".pdf"
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
                      <div className="text-xs font-mono font-semibold text-white">Drag & drop your study PDF here</div>
                      <div className="text-[9px] font-mono text-outline leading-normal max-w-xs">
                        Accepts only <strong>PDF</strong> files. Max size is <strong>4.5MB</strong> due to serverless limitations.
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
                className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary font-mono"
              />
              {uploadErrors.fileName && (
                <p className="text-red-500 text-[10px] font-mono mt-1">❌ {uploadErrors.fileName}</p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isUploading}
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

      {/* --- SEARCH FILTER BAR --- */}
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

      {/* --- SHARED DOCUMENTS LIBRARY PANEL --- */}
      <div className="glass-card rounded-2xl border border-outline-variant overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-outline text-xs flex flex-col items-center gap-3 font-mono">
            <RefreshCw className="w-5 h-5 animate-spin text-primary" />
            Loading shared library files...
          </div>
        ) : errorMsg ? (
          <div className="p-12 text-center text-rose-300 text-xs flex flex-col items-center gap-2 font-mono">
            <AlertCircle className="w-5 h-5 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        ) : filteredResources.length === 0 ? (
          <div className="p-12 text-center text-outline text-xs font-mono leading-relaxed">
            No global resources found. Be the first to share a study PDF notes document!
          </div>
        ) : (
          <div className="overflow-x-auto font-mono text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-outline-variant bg-white/2 text-outline font-bold uppercase tracking-wider">
                  <th className="p-3.5">Document Title</th>
                  <th className="p-3.5 w-48">Uploader</th>
                  <th className="p-3.5 w-36">Shared Date</th>
                  <th className="p-3.5 w-32 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {filteredResources.map((res) => {
                  const isOwner = res.uploadedBy.toLowerCase() === currentUserEmail.toLowerCase();
                  
                  return (
                    <tr key={res.id} className="hover:bg-white/2 transition">
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          <FileText className="w-4 h-4 text-primary shrink-0" />
                          <span className="font-bold text-on-surface truncate max-w-sm md:max-w-md lg:max-w-lg" title={res.name}>
                            {res.name}
                          </span>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5 text-outline">
                          <User className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="truncate max-w-[150px] font-semibold text-white/80">{res.uploaderName}</span>
                          {isOwner && (
                            <span className="text-[8px] bg-primary/10 text-primary border border-primary/20 px-1 py-px rounded uppercase scale-90">YOU</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5 text-outline">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-outline/50 shrink-0" />
                          <span>{formatUploadedDate(res.createdAt)}</span>
                        </div>
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-2.5">
                          <a
                            href={res.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg border border-outline-variant bg-white/2 hover:border-primary text-outline hover:text-white transition flex items-center gap-1 text-[10px]"
                            title="Open Link"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          {(isOwner || isAdmin) && (
                            <button
                              onClick={() => handleDelete(res.id)}
                              className="p-1.5 rounded-lg border border-red-500/20 bg-red-950/5 hover:border-red-500 text-outline hover:text-red-400 transition cursor-pointer"
                              title="Delete Shared File"
                            >
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
