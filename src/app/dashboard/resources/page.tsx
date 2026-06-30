'use client';

import React, { useState } from 'react';
import { useStore } from '@/store/useStore';
import { useUser } from '@clerk/nextjs';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { 
  FolderLock, UploadCloud, File, BookOpen, Plus, 
  Trash, Download, FileText, ExternalLink 
} from 'lucide-react';

export default function ResourcesPage() {
  const store = useStore();
  const { user } = useUser();

  const subjects = store.subjects;
  const resources = store.resources;

  // UI state
  const [activeTab, setActiveTab] = useState<'upload' | 'subject'>('upload');

  // Form states - Upload Resource
  const [uploadMethod, setUploadMethod] = useState<'drive' | 'link'>('drive');
  const [linkUrl, setLinkUrl] = useState('');
  const [activeSubjectId, setActiveSubjectId] = useState(subjects[0]?.id || '');
  const [fileName, setFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [fileType, setFileType] = useState('pdf');
  const [fileData, setFileData] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Form states - Add Subject
  const [subName, setSubName] = useState('');
  const [uploadErrors, setUploadErrors] = useState<Record<string, string | undefined>>({});
  const [subjectErrors, setSubjectErrors] = useState<Record<string, string | undefined>>({});
  const [subCode, setSubCode] = useState('');
  const [subCredits, setSubCredits] = useState(3);
  const [subDifficulty, setSubDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [subPriority, setSubPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');

  const processSelectedFile = (file: File) => {
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  React.useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (activeTab !== 'upload' || uploadMethod === 'link') return;
      
      const file = e.clipboardData?.files?.[0];
      if (file) {
        processSelectedFile(file);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [activeTab, uploadMethod]);

  React.useEffect(() => {
    if (subjects.length === 0) {
      setTimeout(() => {
        setActiveTab('subject');
        setActiveSubjectId('');
      }, 0);
    } else if (!activeSubjectId && subjects.length > 0) {
      setTimeout(() => {
        setActiveSubjectId(subjects[0].id);
      }, 0);
    }
  }, [subjects, activeSubjectId]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetSubjectId = activeSubjectId || subjects[0]?.id;
    
    const errors: Record<string, string> = {};
    if (!targetSubjectId) {
      errors.subject = "This field is required";
    }

    if (uploadMethod === 'link') {
      if (!linkUrl.trim()) {
        errors.link = "This field is required";
      }
      if (!fileName.trim()) {
        errors.fileName = "This field is required";
      }
      
      if (Object.keys(errors).length > 0) {
        setUploadErrors(errors);
        return;
      }

      store.uploadResource(targetSubjectId, {
        name: fileName || linkUrl,
        url: linkUrl,
        type: fileType === 'link' ? 'link' : fileType
      });

      setFileName('');
      setLinkUrl('');
      setUploadErrors({});
      alert("Web Link resource added successfully!");
      return;
    }

    if (!fileData) {
      errors.file = "This field is required";
    }
    if (!fileName.trim()) {
      errors.fileName = "This field is required";
    }

    if (Object.keys(errors).length > 0 || !fileData) {
      setUploadErrors(errors);
      return;
    }

    // Direct Google Drive upload via Next API router proxy is limited to 4.5MB by Vercel serverless platform
    const MAX_FILE_SIZE = 4.5 * 1024 * 1024; // 4.5MB
    if (fileData.size > MAX_FILE_SIZE) {
      alert(`File is too large (${(fileData.size / (1024 * 1024)).toFixed(2)}MB).\n\nDirect uploads are limited to 4.5MB due to serverless platform body-size limits. Please upload this file directly to your Google Drive and add it here as a "Web Link".`);
      return;
    }

    setIsUploading(true);
    setUploadErrors({});

    try {
      const formData = new FormData();
      formData.append('file', fileData);
      formData.append('name', fileName || fileData.name);

      const res = await fetch('/api/resources/upload-drive', {
        method: 'POST',
        body: formData,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any = {};
      if (!res.ok) {
        const errorText = await res.text().catch(() => 'Unknown error');
        let parsedError = errorText;
        try {
          const parsed = JSON.parse(errorText);
          parsedError = parsed.error || errorText;
        } catch (e) {}
        throw new Error(parsedError);
      } else {
        data = await res.json();
      }

      store.uploadResource(targetSubjectId, {
        name: fileName || fileData.name,
        url: data.file.url,
        type: fileType
      });

      alert("File uploaded successfully to your Google Drive!");
      
      setFileName('');
      setFileData(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      alert(`Google Drive Upload Failed: ${err.message}\n\nFalling back: You can use the "Web Link" tab to link your files if your Google integration isn't authorized.`);
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddSubject = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!subName.trim()) {
      errors.subName = "This field cannot be empty";
    }
    if (!subCode.trim()) {
      errors.subCode = "This field cannot be empty";
    }

    if (Object.keys(errors).length > 0) {
      setSubjectErrors(errors);
      return;
    }

    store.addSubject({
      name: subName,
      code: subCode || 'SUB101',
      credits: subCredits,
      difficulty: subDifficulty,
      priority: subPriority
    });

    // Reset form
    setSubName('');
    setSubCode('');
    setSubCredits(3);
    setSubDifficulty('Medium');
    setSubPriority('Medium');
    setSubjectErrors({});

    // Switch back to upload tab
    setActiveTab('upload');
  };

  const handleViewFile = (file: { name: string; url: string; type: string }) => {
    if (!file.url || file.url === '#') {
      alert("This is a mock resource. Please upload a real file to view/download.");
      return;
    }

    if (file.url.startsWith('data:')) {
      try {
        const newWindow = window.open();
        if (newWindow) {
          newWindow.document.title = file.name;
          newWindow.document.body.style.margin = '0';
          const iframe = newWindow.document.createElement('iframe');
          iframe.src = file.url;
          iframe.style.width = '100vw';
          iframe.style.height = '100vh';
          iframe.style.border = 'none';
          newWindow.document.body.appendChild(iframe);
        } else {
          // Fallback to download
          const link = document.createElement('a');
          link.href = file.url;
          link.download = file.name;
          link.click();
        }
      } catch (err) {
        const link = document.createElement('a');
        link.href = file.url;
        link.download = file.name;
        link.click();
      }
    } else {
      window.open(file.url, '_blank');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-white/10 pb-4">
        <h2 className="text-xl font-mono font-bold tracking-wide text-white">Resource Vault</h2>
        <p className="text-xs text-white/50 font-mono mt-0.5">Upload, download, and index lecture notes, syllabi, and reference sheets.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* --- LEFT COLUMN: UPLOAD / SUBJECT CONTROLLER --- */}
        <div className="space-y-4">
          <div className="glass-card rounded-2xl p-5 space-y-4 border border-white/10">
            
            {/* Tabs */}
            <div className="grid grid-cols-2 gap-2 p-1.5 bg-white/5 border border-white/10 rounded-xl w-full">
              <button
                type="button"
                disabled={subjects.length === 0}
                onClick={() => setActiveTab('upload')}
                className={`py-2 px-2.5 text-xs font-mono font-bold rounded-lg flex items-center justify-center gap-1.5 transition ${
                  subjects.length === 0
                    ? 'opacity-40 cursor-not-allowed text-white/30'
                    : activeTab === 'upload'
                    ? 'bg-cyber-blue/20 text-cyber-blue border border-cyber-blue/30 cursor-pointer'
                    : 'text-white/50 hover:text-white hover:bg-white/10 border border-transparent cursor-pointer'
                }`}
                title={subjects.length === 0 ? "Create a subject first to upload materials" : undefined}
              >
                <UploadCloud className="w-4 h-4 shrink-0" />
                <span>Upload</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('subject')}
                className={`py-2 px-2.5 text-xs font-mono font-bold rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  activeTab === 'subject'
                    ? 'bg-cyber-blue/20 text-cyber-blue border border-cyber-blue/30'
                    : 'text-white/50 hover:text-white hover:bg-white/10 border border-transparent'
                }`}
              >
                <Plus className="w-4 h-4 shrink-0" />
                <div className="flex flex-col text-left leading-none font-bold">
                  <span className="text-[10px]">Add</span>
                  <span className="text-[10px] mt-0.5">Subject</span>
                </div>
              </button>
            </div>

            {activeTab === 'upload' ? (
              <>
                <h3 className="text-xs font-mono font-bold text-cyber-blue border-b border-white/10 pb-2">Upload Resource</h3>
                
                {subjects.length === 0 ? (
                  <p className="text-xs text-red-400 font-mono">No subjects available. Add a subject using the tab above to get started.</p>
                ) : (
                  <form onSubmit={handleUpload} noValidate className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-mono text-white/50 mb-1">Target Subject</label>
                      <select
                        value={activeSubjectId || subjects[0]?.id || ''}
                        onChange={(e) => {
                          setActiveSubjectId(e.target.value);
                          setUploadErrors(prev => ({ ...prev, subject: undefined }));
                        }}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyber-blue"
                      >
                        {subjects.map((sub) => (
                          <option key={sub.id} value={sub.id}>
                            {sub.name} ({sub.code})
                          </option>
                        ))}
                      </select>
                      {uploadErrors.subject && <p className="text-red-500 text-[10px] font-mono mt-1">{uploadErrors.subject}</p>}
                    </div>

                    {/* Storage / Upload Location Selector */}
                    <div>
                      <label className="block text-[10px] font-mono text-white/50 mb-1">Storage Destination</label>
                      <div className="grid grid-cols-2 gap-1.5 p-1 bg-white/5 border border-white/10 rounded-xl">
                        <button
                          type="button"
                          onClick={() => {
                            setUploadMethod('drive');
                            setFileType('pdf');
                          }}
                          className={`py-1.5 text-[9px] font-mono font-bold rounded-lg flex items-center justify-center gap-1 transition cursor-pointer ${
                            uploadMethod === 'drive'
                              ? 'bg-cyber-blue/20 text-cyber-blue border border-cyber-blue/30'
                              : 'text-white/50 hover:text-white hover:bg-white/5 border border-transparent'
                          }`}
                        >
                          Google Drive
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setUploadMethod('link');
                            setFileType('link');
                          }}
                          className={`py-1.5 text-[9px] font-mono font-bold rounded-lg flex items-center justify-center gap-1 transition cursor-pointer ${
                            uploadMethod === 'link'
                              ? 'bg-cyber-purple/20 text-cyber-purple border border-cyber-purple/30'
                              : 'text-white/50 hover:text-white hover:bg-white/5 border border-transparent'
                          }`}
                        >
                          Web Link
                        </button>
                      </div>
                    </div>

                    {uploadMethod === 'link' ? (
                      <div>
                        <label className="block text-[10px] font-mono text-white/50 mb-1">Resource Web URL / Link</label>
                        <input
                          type="url"
                          value={linkUrl}
                          onChange={(e) => {
                            setLinkUrl(e.target.value);
                            setUploadErrors(prev => ({ ...prev, link: undefined }));
                          }}
                          placeholder="Paste Google Drive, OneDrive, or web link"
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyber-purple"
                        />
                        {uploadErrors.link && <p className="text-red-500 text-[10px] font-mono mt-1">{uploadErrors.link}</p>}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <label className="block text-[10px] font-mono text-white/50 mb-1">Select File</label>
                        
                        {/* Drag and Drop Zone Card */}
                        <div
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          onClick={() => fileInputRef.current?.click()}
                          className={`relative border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 group ${
                            isDragging 
                              ? 'border-cyber-blue bg-cyber-blue/10' 
                              : fileData 
                                ? fileData.size > 4.5 * 1024 * 1024
                                  ? 'border-red-500/50 bg-red-500/5 hover:border-red-400'
                                  : 'border-emerald-500/50 bg-emerald-500/5 hover:border-emerald-400' 
                                : uploadErrors.file
                                  ? 'border-red-500/50 bg-red-500/5 hover:border-red-400'
                                  : 'border-white/15 bg-black/20 hover:border-cyber-blue/50 hover:bg-black/30'
                          }`}
                        >
                          <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="hidden"
                          />
                          
                          {fileData ? (
                            <>
                              <File className={`w-7 h-7 animate-bounce ${fileData.size > 4.5 * 1024 * 1024 ? 'text-red-400' : 'text-emerald-400'}`} />
                              <div className={`text-xs font-mono font-bold truncate max-w-[200px] ${fileData.size > 4.5 * 1024 * 1024 ? 'text-red-400' : 'text-emerald-400'}`}>
                                {fileData.name}
                              </div>
                              {fileData.size > 4.5 * 1024 * 1024 ? (
                                <div className="text-[9px] font-mono text-red-400 font-bold">
                                  File too large ({(fileData.size / (1024 * 1024)).toFixed(2)}MB). Max limit is 4.5MB.
                                </div>
                              ) : (
                                <div className="text-[9px] font-mono text-white/40">
                                  Click to replace • Drag new file • Paste from clipboard
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              <UploadCloud className="w-7 h-7 text-white/40 group-hover:text-cyber-blue transition" />
                              <div className="text-xs font-mono text-white/70 group-hover:text-white">
                                Drag & Drop file here
                              </div>
                              <div className="text-[9px] font-mono text-white/40">
                                or click to browse files (Max 4.5MB)
                              </div>
                              <div className="text-[8px] font-mono text-cyber-blue/70 bg-cyber-blue/10 px-2 py-0.5 rounded border border-cyber-blue/20 mt-1">
                                Clipboard Paste (Ctrl+V) Supported
                              </div>
                            </>
                          )}
                        </div>
                        {uploadErrors.file && <p className="text-red-500 text-[10px] font-mono mt-1">{uploadErrors.file}</p>}
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] font-mono text-white/50 mb-1">Document Title / Name</label>
                      <input
                        type="text"
                        value={fileName}
                        onChange={(e) => {
                          setFileName(e.target.value);
                          setUploadErrors(prev => ({ ...prev, fileName: undefined }));
                        }}
                        placeholder="E.g. Calculus Cheat Sheet"
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyber-blue"
                      />
                      {uploadErrors.fileName && <p className="text-red-500 text-[10px] font-mono mt-1">{uploadErrors.fileName}</p>}
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono text-white/50 mb-1">Format Type</label>
                      <select
                        value={fileType}
                        onChange={(e) => setFileType(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyber-blue"
                      >
                        <option value="pdf">Adobe PDF (.pdf)</option>
                        <option value="ppt">PowerPoint PPT (.pptx)</option>
                        <option value="doc">Word Doc (.docx)</option>
                        <option value="txt">Text File (.txt)</option>
                        <option value="link">Web Link / URL</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={isUploading || (uploadMethod === 'drive' && !!fileData && fileData.size > 4.5 * 1024 * 1024)}
                      className="w-full bg-gradient-to-r from-cyber-purple/50 to-cyber-blue/50 hover:from-cyber-purple hover:to-cyber-blue text-white rounded-lg py-2.5 text-xs font-mono font-bold flex items-center justify-center gap-1.5 cursor-pointer border border-cyber-blue/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <UploadCloud className="w-4 h-4" /> {isUploading ? 'Uploading...' : (uploadMethod === 'drive' && fileData && fileData.size > 4.5 * 1024 * 1024) ? 'File Too Large (Max 4.5MB)' : uploadMethod === 'drive' ? 'Upload to Google Drive' : 'Add Link Resource'}
                    </button>
                  </form>
                )}
              </>
            ) : (
              <>
                <h3 className="text-xs font-mono font-bold text-cyber-purple border-b border-white/10 pb-2">Add New Subject</h3>
                
                <form onSubmit={handleAddSubject} noValidate className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-mono text-white/50 mb-1">Subject Name</label>
                    <input
                      type="text"
                      value={subName}
                      onChange={(e) => {
                        setSubName(e.target.value);
                        setSubjectErrors(prev => ({ ...prev, subName: undefined }));
                      }}
                      placeholder="Subject Name"
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyber-purple"
                    />
                    {subjectErrors.subName && <p className="text-red-500 text-[10px] font-mono mt-1">{subjectErrors.subName}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-mono text-white/50 mb-1">Subject Code</label>
                      <input
                        type="text"
                        value={subCode}
                        onChange={(e) => {
                          setSubCode(e.target.value);
                          setSubjectErrors(prev => ({ ...prev, subCode: undefined }));
                        }}
                        placeholder="Course Code (e.g. SUB101)"
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyber-purple"
                      />
                      {subjectErrors.subCode && <p className="text-red-500 text-[10px] font-mono mt-1">{subjectErrors.subCode}</p>}
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-white/50 mb-1">Credits</label>
                      <select
                        value={subCredits}
                        onChange={(e) => setSubCredits(parseInt(e.target.value) || 3)}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyber-purple"
                      >
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-mono text-white/50 mb-1">Difficulty</label>
                      <select
                        value={subDifficulty}
                        onChange={(e) => setSubDifficulty(e.target.value as 'Easy' | 'Medium' | 'Hard')}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyber-purple"
                      >
                        <option value="Easy">Easy</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-white/50 mb-1">Priority</label>
                      <select
                        value={subPriority}
                        onChange={(e) => setSubPriority(e.target.value as 'Low' | 'Medium' | 'High')}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyber-purple"
                      >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-cyber-purple/50 to-cyber-blue/50 hover:from-cyber-purple hover:to-cyber-blue text-white rounded-lg py-2.5 text-xs font-mono font-bold flex items-center justify-center gap-1.5 cursor-pointer border border-cyber-purple/30"
                  >
                    <Plus className="w-4 h-4" /> Create Subject
                  </button>
                </form>
              </>
            )}
          </div>
        </div>

        {/* --- RIGHT COLUMN: DOCUMENT ARCHIVE LISTINGS --- */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white/5 p-3 rounded-xl border border-white/10">
            <span className="text-[10px] font-mono text-white/50">Vault Index by Subject</span>
          </div>

          <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
            {subjects.length === 0 ? (
              <div className="text-center py-20 text-white/30 font-mono text-xs">
                No subjects registered.
              </div>
            ) : (
              subjects.map((sub) => {
                const files = resources[sub.id] || [];
                return (
                  <div key={sub.id} className="glass-card rounded-2xl p-4 border border-white/10 space-y-3">
                    <div className="flex justify-between items-center border-b border-white/10 pb-2">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-cyber-blue" />
                        <span className="font-mono font-bold text-xs text-white">{sub.name}</span>
                        <span className="text-[9px] font-mono bg-cyber-blue/10 text-cyber-blue px-1.5 py-0.5 rounded border border-cyber-blue/30">{sub.code}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-mono text-white/50">{files.length} documents indexed</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete "${sub.name}"? All associated files will be deleted.`)) {
                              store.removeSubject(sub.id);
                            }
                          }}
                          className="p-1 hover:bg-red-500/20 border border-transparent hover:border-red-500/30 rounded-lg text-white/50 hover:text-red-400 transition cursor-pointer"
                          title="Delete subject"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {files.length === 0 ? (
                        <div className="col-span-2 py-4 text-center text-[10px] font-mono text-white/30">
                          Empty directory. Use the upload panel to insert materials.
                        </div>
                      ) : (
                        files.map((file) => (
                          <div 
                            key={file.id} 
                            onClick={() => handleViewFile(file)}
                            className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/10 hover:border-cyber-blue transition cursor-pointer group"
                          >
                            <div className="w-8 h-8 rounded-lg bg-cyber-purple/20 border border-cyber-purple/50 flex items-center justify-center text-cyber-purple shrink-0 group-hover:bg-cyber-blue/20 group-hover:border-cyber-blue/50 group-hover:text-cyber-blue transition">
                              {file.type === 'link' ? <ExternalLink className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[11px] font-mono font-bold text-white truncate">{file.name}</div>
                              <span className="text-[9px] font-mono text-white/50 uppercase">{file.type} format</span>
                            </div>

                            <div className="flex gap-1 shrink-0">
                              <a 
                                href={file.url === '#' ? undefined : file.url} 
                                download={file.name}
                                target="_blank"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!file.url || file.url === '#') {
                                    e.preventDefault();
                                    alert("This is a mock resource. Please upload a real file to view/download.");
                                  }
                                }}
                                className="p-1 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition"
                                title="Download resource"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (confirm(`Are you sure you want to delete the file "${file.name}"?`)) {
                                    try {
                                      if (file.url && file.url.includes('/storage/v1/object/public/resources/')) {
                                        const storagePath = file.url.split('/storage/v1/object/public/resources/')[1];
                                        if (storagePath) {
                                          const res = await fetch('/api/resources/delete-storage', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ storagePath })
                                          });
                                          if (!res.ok) {
                                            const errData = await res.json().catch(() => ({}));
                                            console.warn("Failed to delete object from Supabase Storage:", errData.error || res.statusText);
                                          }
                                        }
                                      }
                                    } catch (err) {
                                      console.error("Storage delete error:", err);
                                    }
                                    store.removeResource(sub.id, file.id);
                                  }
                                }}
                                className="p-1 hover:bg-red-500/20 rounded-lg text-white/50 hover:text-red-400 transition cursor-pointer"
                                title="Delete resource"
                              >
                                <Trash className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
