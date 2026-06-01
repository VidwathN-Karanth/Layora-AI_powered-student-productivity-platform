'use client';

import React, { useState } from 'react';
import { useStore } from '@/store/useStore';
import { useUser } from '@clerk/nextjs';
import { storage } from '@/lib/firebaseClient';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
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
  const [uploadMethod, setUploadMethod] = useState<'drive' | 'link' | 'local'>('drive');
  const [linkUrl, setLinkUrl] = useState('');
  const [activeSubjectId, setActiveSubjectId] = useState(subjects[0]?.id || '');
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState('pdf');
  const [fileData, setFileData] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Form states - Add Subject
  const [subName, setSubName] = useState('');
  const [subCode, setSubCode] = useState('');
  const [subCredits, setSubCredits] = useState(3);
  const [subDifficulty, setSubDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [subPriority, setSubPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
    
    setFileName(nameWithoutExt);
    setFileType(ext);
    setFileData(file);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetSubjectId = activeSubjectId || subjects[0]?.id;
    
    if (!targetSubjectId) return;

    if (uploadMethod === 'link') {
      if (!linkUrl) {
        alert("Please enter a web link.");
        return;
      }

      store.uploadResource(targetSubjectId, {
        name: fileName || linkUrl,
        url: linkUrl,
        type: fileType === 'link' ? 'link' : fileType
      });

      setFileName('');
      setLinkUrl('');
      alert("Web Link resource added successfully!");
      return;
    }

    if (!fileData) {
      alert("Please select a file to upload.");
      return;
    }

    setIsUploading(true);

    if (uploadMethod === 'drive') {
      try {
        const formData = new FormData();
        formData.append('file', fileData);
        formData.append('name', fileName || fileData.name);

        const res = await fetch('/api/resources/upload-drive', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to upload to Google Drive');
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
      } catch (err: any) {
        alert(`Google Drive Upload Failed: ${err.message}\n\nFalling back: You can use the "Local File" or "Web Link" tab if your Google integration isn't authorized.`);
        console.error(err);
      } finally {
        setIsUploading(false);
      }
      return;
    }

    if (uploadMethod === 'local') {
      try {
        let fileUrl = '#';
        const isSmallFile = fileData.size < 1.5 * 1024 * 1024; // 1.5 MB limit for localStorage persistence

        if (isSmallFile) {
          fileUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (e) => reject(new Error("Failed to read file: " + e.target?.error));
            reader.readAsDataURL(fileData);
          });
        } else {
          fileUrl = URL.createObjectURL(fileData);
          console.warn("Large file detected. Using session URL (will not persist after page reload).");
        }

        store.uploadResource(targetSubjectId, {
          name: fileName || fileData.name,
          url: fileUrl,
          type: fileType
        });

        alert(
          isSmallFile
            ? "File uploaded successfully to local storage (Demo Mode)."
            : "File loaded successfully for this session (Demo Mode: large files do not persist across page reloads)."
        );

        setFileName('');
        setFileData(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err: any) {
        alert(`Local upload failed: ${err.message}`);
        console.error(err);
      } finally {
        setIsUploading(false);
      }
      return;
    }

    // Default Firebase Storage flow
    try {
      const activeStorage = storage;
      if (!activeStorage) {
        throw new Error("Firebase Storage is not configured.");
      }
      const userId = user?.id || 'anonymous';
      const timestamp = Date.now();
      const safeName = (fileName || fileData.name).replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `users/${userId}/subjects/${targetSubjectId}/${timestamp}_${safeName}`;
      const fileRef = ref(activeStorage, storagePath);

      const snapshot = await uploadBytes(fileRef, fileData);
      const downloadURL = await getDownloadURL(snapshot.ref);

      store.uploadResource(targetSubjectId, {
        name: fileName || fileData.name,
        url: downloadURL,
        type: fileType
      });
      
      setFileName('');
      setFileData(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subName) return;

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
            <div className="flex gap-2 p-1 bg-white/5 border border-white/10 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('upload')}
                className={`flex-1 py-2 text-xs font-mono font-bold rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  activeTab === 'upload'
                    ? 'bg-cyber-blue/20 text-cyber-blue border border-cyber-blue/30'
                    : 'text-white/50 hover:text-white hover:bg-white/10 border border-transparent'
                }`}
              >
                <UploadCloud className="w-3.5 h-3.5" />
                Upload Material
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('subject')}
                className={`flex-1 py-2 text-xs font-mono font-bold rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  activeTab === 'subject'
                    ? 'bg-cyber-blue/20 text-cyber-blue border border-cyber-blue/30'
                    : 'text-white/50 hover:text-white hover:bg-white/10 border border-transparent'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                Add Subject
              </button>
            </div>

            {activeTab === 'upload' ? (
              <>
                <h3 className="text-xs font-mono font-bold text-cyber-blue border-b border-white/10 pb-2">Upload Resource</h3>
                
                {subjects.length === 0 ? (
                  <p className="text-xs text-red-400 font-mono">No subjects available. Add a subject using the tab above to get started.</p>
                ) : (
                  <form onSubmit={handleUpload} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-mono text-white/50 mb-1">Target Subject</label>
                      <select
                        value={activeSubjectId || subjects[0]?.id || ''}
                        onChange={(e) => setActiveSubjectId(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyber-blue"
                      >
                        {subjects.map((sub) => (
                          <option key={sub.id} value={sub.id}>
                            {sub.name} ({sub.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Storage / Upload Location Selector */}
                    <div>
                      <label className="block text-[10px] font-mono text-white/50 mb-1">Storage Destination</label>
                      <div className="grid grid-cols-3 gap-1.5 p-1 bg-white/5 border border-white/10 rounded-xl">
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
                        <button
                          type="button"
                          onClick={() => {
                            setUploadMethod('local');
                            setFileType('pdf');
                          }}
                          className={`py-1.5 text-[9px] font-mono font-bold rounded-lg flex items-center justify-center gap-1 transition cursor-pointer ${
                            uploadMethod === 'local'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'text-white/50 hover:text-white hover:bg-white/5 border border-transparent'
                          }`}
                        >
                          Local File
                        </button>
                      </div>
                    </div>

                    {uploadMethod === 'link' ? (
                      <div>
                        <label className="block text-[10px] font-mono text-white/50 mb-1">Resource Web URL / Link</label>
                        <input
                          type="url"
                          required
                          value={linkUrl}
                          onChange={(e) => setLinkUrl(e.target.value)}
                          placeholder="Paste Google Drive, OneDrive, or web link"
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyber-purple"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-[10px] font-mono text-white/50 mb-1">Select File</label>
                        <input
                          type="file"
                          required
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          disabled={isUploading}
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyber-blue file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-mono file:bg-cyber-blue/20 file:text-cyber-blue hover:file:bg-cyber-blue/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] font-mono text-white/50 mb-1">Document Title / Name</label>
                      <input
                        type="text"
                        required
                        value={fileName}
                        onChange={(e) => setFileName(e.target.value)}
                        placeholder="E.g. Calculus Cheat Sheet"
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyber-blue"
                      />
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
                      disabled={isUploading}
                      className="w-full bg-gradient-to-r from-cyber-purple/50 to-cyber-blue/50 hover:from-cyber-purple hover:to-cyber-blue text-white rounded-lg py-2.5 text-xs font-mono font-bold flex items-center justify-center gap-1.5 cursor-pointer border border-cyber-blue/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <UploadCloud className="w-4 h-4" /> {isUploading ? 'Uploading...' : uploadMethod === 'drive' ? 'Upload to Google Drive' : uploadMethod === 'link' ? 'Add Link Resource' : 'Load Local File'}
                    </button>
                  </form>
                )}
              </>
            ) : (
              <>
                <h3 className="text-xs font-mono font-bold text-cyber-purple border-b border-white/10 pb-2">Add New Subject</h3>
                
                <form onSubmit={handleAddSubject} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-mono text-white/50 mb-1">Subject Name</label>
                    <input
                      type="text"
                      required
                      value={subName}
                      onChange={(e) => setSubName(e.target.value)}
                      placeholder="Introduction to Physics"
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyber-purple"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-mono text-white/50 mb-1">Subject Code</label>
                      <input
                        type="text"
                        required
                        value={subCode}
                        onChange={(e) => setSubCode(e.target.value)}
                        placeholder="PHY101"
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyber-purple"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-white/50 mb-1">Credits</label>
                      <input
                        type="number"
                        required
                        min={1}
                        max={6}
                        value={subCredits}
                        onChange={(e) => setSubCredits(parseInt(e.target.value) || 3)}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyber-purple"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-mono text-white/50 mb-1">Difficulty</label>
                      <select
                        value={subDifficulty}
                        onChange={(e) => setSubDifficulty(e.target.value as any)}
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
                        onChange={(e) => setSubPriority(e.target.value as any)}
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
                                      const activeStorage = storage;
                                      if (activeStorage && file.url && file.url.startsWith('https://firebasestorage.googleapis.com')) {
                                        const fileRef = ref(activeStorage, file.url);
                                        await deleteObject(fileRef).catch(err => {
                                          console.warn("Failed to delete object from Storage:", err);
                                        });
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
