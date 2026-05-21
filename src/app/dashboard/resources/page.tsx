'use client';

import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { 
  FolderLock, UploadCloud, File, BookOpen, Plus, 
  Trash, Download, FileText, ExternalLink 
} from 'lucide-react';

export default function ResourcesPage() {
  const store = useStore();

  const subjects = store.subjects;
  const resources = store.resources;

  const [activeSubjectId, setActiveSubjectId] = useState(subjects[0]?.id || '');
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState('pdf');

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileName || !activeSubjectId) return;

    const formattedName = fileName.endsWith(`.${fileType}`) 
      ? fileName 
      : `${fileName}.${fileType}`;

    store.uploadResource(activeSubjectId, {
      name: formattedName,
      url: '#',
      type: fileType
    });

    setFileName('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-white/5 pb-4">
        <h2 className="text-xl font-mono font-bold tracking-wide">Resource Vault</h2>
        <p className="text-xs text-white/40 font-mono mt-0.5">Upload, download, and index lecture notes, syllabi, and reference sheets.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* --- LEFT COLUMN: UPLOAD CONTROLLER --- */}
        <div className="space-y-4">
          <div className="glass-card rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-mono font-bold text-purple-400 border-b border-white/5 pb-2">Upload Resource</h3>
            
            {subjects.length === 0 ? (
              <p className="text-xs text-red-400 font-mono">No subjects available. Add subjects in Settings to upload resources.</p>
            ) : (
              <form onSubmit={handleUpload} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono text-white/50 mb-1">Target Subject</label>
                  <select
                    value={activeSubjectId}
                    onChange={(e) => setActiveSubjectId(e.target.value)}
                    className="w-full bg-white/10 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-purple-200"
                  >
                    {subjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name} ({sub.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-white/50 mb-1">Document Name</label>
                  <input
                    type="text"
                    required
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    placeholder="Calculus Cheat Sheet"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-white/50 mb-1">File Format</label>
                  <select
                    value={fileType}
                    onChange={(e) => setFileType(e.target.value)}
                    className="w-full bg-white/10 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-purple-200"
                  >
                    <option value="pdf">Adobe PDF (.pdf)</option>
                    <option value="ppt">PowerPoint PPT (.pptx)</option>
                    <option value="doc">Word Doc (.docx)</option>
                    <option value="txt">Text File (.txt)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-500 hover:to-blue-400 text-white rounded-lg py-2.5 text-xs font-mono font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <UploadCloud className="w-4 h-4" /> Upload File
                </button>
              </form>
            )}
          </div>
        </div>

        {/* --- RIGHT COLUMN: DOCUMENT ARCHIVE LISTINGS --- */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white/2 p-3 rounded-xl border border-white/5">
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
                  <div key={sub.id} className="glass-card rounded-2xl p-4 border border-white/5 space-y-3">
                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-purple-400" />
                        <span className="font-mono font-bold text-xs text-purple-200">{sub.name}</span>
                        <span className="text-[9px] font-mono bg-purple-950/40 text-purple-300 px-1.5 py-0.5 rounded border border-purple-800/30">{sub.code}</span>
                      </div>
                      <span className="text-[10px] font-mono text-white/40">{files.length} documents indexed</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {files.length === 0 ? (
                        <div className="col-span-2 py-4 text-center text-[10px] font-mono text-white/30">
                          Empty directory. Use the upload panel to insert materials.
                        </div>
                      ) : (
                        files.map((file) => (
                          <div key={file.id} className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5 hover:border-purple-500/20 transition">
                            <div className="w-8 h-8 rounded-lg bg-cyan-950/30 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[11px] font-mono font-bold text-white/90 truncate">{file.name}</div>
                              <span className="text-[9px] font-mono text-white/30 uppercase">{file.type} format</span>
                            </div>

                            <a 
                              href="#" 
                              onClick={(e) => e.preventDefault()}
                              className="p-1 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition"
                              title="Download resource"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
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
