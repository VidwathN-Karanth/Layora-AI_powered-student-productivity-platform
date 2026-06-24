'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { useStore } from '@/store/useStore';
import { 
  Award, UploadCloud, Trash2, Eye, X, 
  ExternalLink, Calendar, Plus, Loader2, Sparkles, AlertTriangle, Check
} from 'lucide-react';

interface Certificate {
  id: string;
  name: string;
  platform: string;
  file_url: string;
  created_at: string;
}

const PLATFORMS = [
  'HackerRank',
  'W3Schools',
  'NPTEL',
  'Coursera',
  'Udemy',
  'edX',
  'Google',
  'Microsoft',
  'Other'
];

export default function CertificatesPage() {
  const { user: clerkUser } = useUser();
  const store = useStore();

  // Core states
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dbMissing, setDbMissing] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState(PLATFORMS[0]);
  const [customPlatform, setCustomPlatform] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string | undefined>>({});

  // Preview state
  const [activeCert, setActiveCert] = useState<Certificate | null>(null);

  // Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCertificates = async () => {
    setLoading(true);
    setError('');
    setDbMissing(false);
    try {
      const res = await fetch('/api/user/certificates');
      if (!res.ok) {
        const errData = await res.json();
        if (errData.code === 'MISSING_TABLE') {
          setDbMissing(true);
        }
        throw new Error(errData.error || 'Failed to fetch certificates');
      }
      const data = await res.json();
      setCertificates(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Could not load your credentials.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clerkUser?.id) {
      fetchCertificates();
    }
  }, [clerkUser?.id]);

  // Client-side HTML5 canvas image compression
  const compressImageFile = (imageFile: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(imageFile);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 1200; // Resize large images to standard width/height
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(imageFile); // Fallback
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                resolve(imageFile); // Fallback
              }
            },
            'image/jpeg',
            0.75 // Compression quality factor
          );
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
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

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
      if (validTypes.includes(droppedFile.type)) {
        setFile(droppedFile);
        setFormErrors(prev => ({ ...prev, file: undefined }));
      } else {
        alert('Invalid file format. Please upload a PNG or JPG/JPEG image.');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setFormErrors(prev => ({ ...prev, file: undefined }));
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!name.trim()) {
      errors.name = "This field is required";
    }
    if (!file) {
      errors.file = "This field is required";
    }
    if (platform === 'Other' && !customPlatform.trim()) {
      errors.customPlatform = "This field is required";
    }

    if (Object.keys(errors).length > 0 || !file) {
      setFormErrors(errors);
      return;
    }

    setUploading(true);
    setFormErrors({});
    setUploadSuccess(false);
    setError('');

    const finalPlatform = platform === 'Other' ? (customPlatform.trim() || 'Other') : platform;

    try {
      // 1. Perform HTML5 canvas compression in the browser
      const compressedBlob = await compressImageFile(file);
      
      // 2. Wrap compressed image inside a File object
      const compressedFile = new File([compressedBlob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
        type: 'image/jpeg'
      });

      // 3. Compile multipart form payload
      const payload = new FormData();
      payload.append('file', compressedFile);
      payload.append('name', name.trim());
      payload.append('platform', finalPlatform);

      const res = await fetch('/api/user/certificates', {
        method: 'POST',
        body: payload
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to upload certificate');
      }

      const data = await res.json();
      setCertificates(prev => [data.certificate, ...prev]);
      
      // Reset form fields
      setName('');
      setPlatform(PLATFORMS[0]);
      setCustomPlatform('');
      setFile(null);
      setFormErrors({});
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Verification and upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this certificate? This action is permanent.')) {
      return;
    }

    try {
      const res = await fetch(`/api/user/certificates?id=${id}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to delete certificate');
      }

      setCertificates(prev => prev.filter(c => c.id !== id));
      if (activeCert?.id === id) {
        setActiveCert(null);
      }
    } catch (err: any) {
      console.error(err);
      alert('Delete failed: ' + err.message);
    }
  };

  const getPlatformColor = (pf: string) => {
    const norm = pf.toLowerCase();
    if (norm.includes('hackerrank')) return 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5';
    if (norm.includes('w3schools')) return 'border-green-500/30 text-green-400 bg-green-500/5';
    if (norm.includes('nptel')) return 'border-orange-500/30 text-orange-400 bg-orange-500/5';
    if (norm.includes('coursera')) return 'border-blue-500/30 text-blue-400 bg-blue-500/5';
    if (norm.includes('udemy')) return 'border-purple-500/30 text-purple-400 bg-purple-500/5';
    if (norm.includes('google')) return 'border-cyan-500/30 text-cyan-400 bg-cyan-500/5';
    if (norm.includes('microsoft')) return 'border-indigo-500/30 text-indigo-400 bg-indigo-500/5';
    return 'border-primary/30 text-primary bg-primary/5';
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="border-b border-outline-variant pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-mono font-bold tracking-wide">📜 Academic Credentials & Certificates</h2>
          <p className="text-xs text-outline font-mono mt-0.5">Upload and catalog your course certifications, skill badges, and exam achievements.</p>
        </div>
      </div>

      {dbMissing && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-950/15 text-rose-300 text-xs font-mono space-y-2">
          <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-rose-400">
            <AlertTriangle className="w-4 h-4 animate-pulse" /> Missing Database Tables
          </div>
          <p>The certificates table has not been initialized in your database schema. Please execute the SQL commands found in your implementation plan inside the Supabase SQL Editor.</p>
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
          Certificate uploaded and stored successfully!
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* --- LEFT SIDE: UPLOAD FORM PANEL --- */}
        <div className="lg:col-span-1 glass-card rounded-2xl p-5 border border-outline-variant space-y-4 h-fit">
          <div className="flex items-center gap-2.5 border-b border-outline-variant/30 pb-2">
            <Plus className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-mono font-bold tracking-wider text-primary">Upload New Certificate</h3>
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
              <label className="block text-[10px] font-mono text-outline mb-1">Certification Platform</label>
              <select
                value={platform}
                onChange={(e) => {
                  setPlatform(e.target.value);
                  setFormErrors(prev => ({ ...prev, customPlatform: undefined }));
                }}
                className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
              >
                {PLATFORMS.map((pf) => (
                  <option key={pf} value={pf}>{pf}</option>
                ))}
              </select>
            </div>

            {platform === 'Other' && (
              <div>
                <label className="block text-[10px] font-mono text-outline mb-1">Specify Custom Platform</label>
                <input
                  type="text"
                  value={customPlatform}
                  onChange={(e) => {
                    setCustomPlatform(e.target.value);
                    setFormErrors(prev => ({ ...prev, customPlatform: undefined }));
                  }}
                  placeholder="e.g. Coursera, Udemy"
                  className="w-full bg-surface-container border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary"
                />
                {formErrors.customPlatform && <p className="text-red-500 text-[10px] font-mono mt-1">{formErrors.customPlatform}</p>}
              </div>
            )}

            {/* Drag & Drop File Selector */}
            <div className="space-y-1">
              <label className="block text-[10px] font-mono text-outline mb-1">Certificate Image (PNG, JPG)</label>
              <div 
                className={`relative border-2 border-dashed rounded-xl p-6 text-center transition ${
                  dragActive 
                    ? 'border-primary bg-primary/5' 
                    : file 
                    ? 'border-primary/50 bg-primary/2' 
                    : formErrors.file
                    ? 'border-rose-500/50 bg-rose-500/5 hover:border-rose-400'
                    : 'border-outline-variant bg-black/20 hover:border-outline'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/png, image/jpeg, image/jpg"
                  className="hidden"
                />

                <div className="flex flex-col items-center justify-center gap-2 cursor-pointer" onClick={triggerFileSelect}>
                  <UploadCloud className={`w-8 h-8 ${file ? 'text-primary' : 'text-outline-variant'}`} />
                  {file ? (
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-on-surface truncate max-w-[200px]">{file.name}</p>
                      <p className="text-[9px] text-outline font-mono">{(file.size / 1024 / 1024).toFixed(2)} MB • Click to replace</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-on-surface">Drag & Drop Image Here</p>
                      <p className="text-[9px] text-outline">or click to browse local files</p>
                    </div>
                  )}
                </div>
              </div>
              {formErrors.file && <p className="text-red-500 text-[10px] font-mono mt-1">{formErrors.file}</p>}
            </div>

            <button
              type="submit"
              disabled={uploading || dbMissing}
              className="w-full bg-primary hover:bg-primary-container text-on-surface rounded-xl py-2.5 text-xs font-mono font-bold transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-[0.98]"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Compressing & Syncing...
                </>
              ) : (
                'Upload & Sync State'
              )}
            </button>
          </form>
        </div>

        {/* --- RIGHT SIDE: CERTIFICATES GRID LIST PANEL --- */}
        <div className="lg:col-span-2 glass-card rounded-2xl p-5 border border-outline-variant flex flex-col min-h-[300px]">
          <div className="flex items-center justify-between border-b border-outline-variant/30 pb-2 mb-4">
            <div className="flex items-center gap-2.5">
              <Award className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-mono font-bold tracking-wider text-primary">My Synced Certificates</h3>
            </div>
            <span className="text-[10px] text-outline bg-white/2 border border-outline-variant px-2 py-0.5 rounded font-mono font-semibold">
              {certificates.length} credentials
            </span>
          </div>

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
                  {/* Certificate Thumbnail Preview Container */}
                  <div className="relative aspect-[4/3] bg-black flex items-center justify-center overflow-hidden border-b border-outline-variant/30">
                    <img 
                      src={cert.file_url} 
                      alt={cert.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      loading="lazy"
                    />
                    
                    {/* Hover controls overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-3 transition duration-200">
                      <button 
                        onClick={() => setActiveCert(cert)}
                        className="p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white transition cursor-pointer"
                        title="View Full Resolution"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(cert.id)}
                        className="p-2 rounded-xl bg-red-950/40 hover:bg-red-900 border border-red-500/30 text-red-300 transition cursor-pointer"
                        title="Delete Certificate"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="p-4 space-y-2">
                    <div>
                      <h4 className="text-xs font-bold text-on-surface group-hover:text-primary transition line-clamp-1">{cert.name}</h4>
                      <span className={`inline-block text-[8px] font-mono font-bold tracking-wider px-2 py-0.5 mt-1 rounded border uppercase ${getPlatformColor(cert.platform)}`}>
                        {cert.platform}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[9px] text-outline font-mono pt-1.5 border-t border-outline-variant/20">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-outline-variant" />
                        {new Date(cert.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
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

      {/* --- HIGH RESOLUTION IMAGE PREVIEW LIGHTBOX --- */}
      {activeCert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Frosted Backing */}
          <div 
            onClick={() => setActiveCert(null)}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

          <div className="relative max-w-4xl w-full max-h-[85vh] bg-[#0c0d12]/95 border border-outline-variant/50 rounded-2xl overflow-hidden z-10 flex flex-col shadow-2xl">
            {/* Header controls */}
            <div className="p-4 border-b border-outline-variant/40 bg-white/2 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-on-surface">{activeCert.name}</h3>
                <p className="text-[9px] text-outline uppercase font-mono mt-0.5">{activeCert.platform} credential</p>
              </div>
              
              <div className="flex items-center gap-2">
                <a 
                  href={activeCert.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/20 hover:border-primary text-primary text-[10px] font-mono font-bold transition duration-200 cursor-pointer"
                >
                  Open Original <ExternalLink className="w-3 h-3" />
                </a>
                <button
                  onClick={() => setActiveCert(null)}
                  className="p-1.5 rounded-lg border border-outline-variant hover:bg-white/5 text-outline hover:text-on-surface transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Large Preview */}
            <div className="flex-1 bg-black/40 overflow-auto p-4 flex items-center justify-center min-h-0">
              <img 
                src={activeCert.file_url} 
                alt={activeCert.name} 
                className="max-w-full max-h-[60vh] object-contain rounded-lg border border-outline-variant/20 shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
