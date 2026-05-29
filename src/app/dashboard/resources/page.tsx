'use client';

import React, { useState } from 'react';
import { useStore } from '@/store/useStore';
import { 
  FolderLock, UploadCloud, File, BookOpen, Plus, 
  Trash, Download, FileText, ExternalLink 
} from 'lucide-react';

export default function ResourcesPage() {
  const store = useStore();

  const subjects = store.subjects;
  const resources = store.resources;

  // UI state
  const [activeTab, setActiveTab] = useState<'upload' | 'subject'>('upload');

  // Form states - Upload Resource
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

    if (file.size > 4.5 * 1024 * 1024) {
      alert("File is too large! Vercel's free tier restricts uploads to 4.5MB per file. Please choose a smaller file.");
      if (fileInputRef.current) fileInputRef.current.value = '';
      setFileData(null);
      return;
    }

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
    if (!fileData) {
      alert("Please select a file to upload.");
      return;
    }

    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', fileData);

      const response = await fetch('/api/drive/upload', {
        method: 'POST',
        body: formData,
      });

      let data;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        // Vercel edge errors or 502 bad gateways often return HTML or plain text
        const textError = await response.text();
        throw new Error(response.status === 413 ? "File is too large for Vercel." : `Server error: ${textError.substring(0, 60)}...`);
      }

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      store.uploadResource(targetSubjectId, {
        name: data.name || fileName,
        url: data.url,
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

                    <div>
                      <label className="block text-[10px] font-mono text-white/50 mb-1">Select File (Google Drive)</label>
                      <input
                        type="file"
                        required
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        disabled={isUploading}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyber-blue file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-mono file:bg-cyber-blue/20 file:text-cyber-blue hover:file:bg-cyber-blue/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono text-white/50 mb-1">Document Name</label>
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
                      <label className="block text-[10px] font-mono text-white/50 mb-1">File Format</label>
                      <select
                        value={fileType}
                        onChange={(e) => setFileType(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyber-blue"
                      >
                        <option value="pdf">Adobe PDF (.pdf)</option>
                        <option value="ppt">PowerPoint PPT (.pptx)</option>
                        <option value="doc">Word Doc (.docx)</option>
                        <option value="txt">Text File (.txt)</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={isUploading}
                      className="w-full bg-gradient-to-r from-cyber-purple/50 to-cyber-blue/50 hover:from-cyber-purple hover:to-cyber-blue text-white rounded-lg py-2.5 text-xs font-mono font-bold flex items-center justify-center gap-1.5 cursor-pointer border border-cyber-blue/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <UploadCloud className="w-4 h-4" /> {isUploading ? 'Uploading to Drive...' : 'Upload File'}
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
                            onClick={() => window.open(file.url, '_blank')}
                            className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/10 hover:border-cyber-blue transition cursor-pointer group"
                          >
                            <div className="w-8 h-8 rounded-lg bg-cyber-purple/20 border border-cyber-purple/50 flex items-center justify-center text-cyber-purple shrink-0 group-hover:bg-cyber-blue/20 group-hover:border-cyber-blue/50 group-hover:text-cyber-blue transition">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[11px] font-mono font-bold text-white truncate">{file.name}</div>
                              <span className="text-[9px] font-mono text-white/50 uppercase">{file.type} format</span>
                            </div>

                            <div className="flex gap-1 shrink-0">
                              <a 
                                href={file.url} 
                                target="_blank"
                                onClick={(e) => e.stopPropagation()}
                                className="p-1 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition"
                                title="Download resource"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm(`Are you sure you want to delete the file "${file.name}"?`)) {
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
