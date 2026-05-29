'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store/useStore';
import { 
  Search, Compass, Paintbrush, CheckSquare, 
  Trash2, Sparkles, Command, ArrowUpRight 
} from 'lucide-react';

export default function CommandPalette() {
  const router = useRouter();
  const store = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Toggle Command Palette with CMD+K / CTRL+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Reset indices and focus input when toggled open
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const items = [
    // Navigation items
    { 
      id: 'nav-dash', 
      title: 'Go to Dashboard', 
      subtitle: 'System statistics, streak fire & agenda',
      category: 'Navigation', 
      icon: Compass, 
      action: () => router.push('/dashboard') 
    },
    { 
      id: 'nav-plan', 
      title: 'Go to Weekly Planner', 
      subtitle: 'Rearrange and view AI study blocks',
      category: 'Navigation', 
      icon: Compass, 
      action: () => router.push('/dashboard/planner') 
    },
    { 
      id: 'nav-courses', 
      title: 'Go to Courses', 
      subtitle: 'Platform progress controllers',
      category: 'Navigation', 
      icon: Compass, 
      action: () => router.push('/dashboard/courses') 
    },
    { 
      id: 'nav-tasks', 
      title: 'Go to Task Manager', 
      subtitle: 'Ticking stopwatches and milestones list',
      category: 'Navigation', 
      icon: Compass, 
      action: () => router.push('/dashboard/tasks') 
    },
    { 
      id: 'nav-res', 
      title: 'Go to Resources Vault', 
      subtitle: 'Upload documents and notes indexer',
      category: 'Navigation', 
      icon: Compass, 
      action: () => router.push('/dashboard/resources') 
    },
    { 
      id: 'nav-analytics', 
      title: 'Go to Analytics & Charts', 
      subtitle: 'Analyze study durations and efficiency stats',
      category: 'Navigation', 
      icon: Compass, 
      action: () => router.push('/dashboard/analytics') 
    },
    { 
      id: 'nav-settings', 
      title: 'Go to Settings', 
      subtitle: 'Profile routines, API key inputs, and accents',
      category: 'Navigation', 
      icon: Compass, 
      action: () => router.push('/dashboard/settings') 
    },

    // Themes
    { 
      id: 'theme-purple', 
      title: 'Accent: Purple Neon', 
      subtitle: 'Switch theme highlights to Royal Purple',
      category: 'Accent Customizer', 
      icon: Paintbrush, 
      action: () => store.setThemeAccent('purple') 
    },
    { 
      id: 'theme-blue', 
      title: 'Accent: Electric Cyan', 
      subtitle: 'Switch theme highlights to Cyber Cyan',
      category: 'Accent Customizer', 
      icon: Paintbrush, 
      action: () => store.setThemeAccent('blue') 
    },
    { 
      id: 'theme-pink', 
      title: 'Accent: Hot Pink', 
      subtitle: 'Switch theme highlights to Synth Pink',
      category: 'Accent Customizer', 
      icon: Paintbrush, 
      action: () => store.setThemeAccent('pink') 
    },
    { 
      id: 'theme-emerald', 
      title: 'Accent: Emerald Glow', 
      subtitle: 'Switch theme highlights to Matrix Green',
      category: 'Accent Customizer', 
      icon: Paintbrush, 
      action: () => store.setThemeAccent('emerald') 
    },

    // Quick Actions
    { 
      id: 'action-task', 
      title: 'Quick Action: Create Study Task', 
      subtitle: 'Adds a default math review task to list',
      category: 'Actions', 
      icon: CheckSquare, 
      action: () => {
        const subId = store.subjects[0]?.id || 'sub-general';
        const subName = store.subjects[0]?.name || 'General Study';
        store.addTask({
          subjectId: subId,
          subjectName: subName,
          title: 'Quick Command Study Session',
          deadline: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
          estimatedMinutes: 60,
        });
      }
    },
    { 
      id: 'action-chat-clear', 
      title: 'Quick Action: Clear Copilot Chat', 
      subtitle: 'Wipes chat timeline logs',
      category: 'Actions', 
      icon: Trash2, 
      action: () => store.clearChat() 
    }
  ];

  // Filter items by search input
  const filteredItems = items.filter(
    (item) =>
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase()) ||
      item.subtitle.toLowerCase().includes(search.toLowerCase())
  );

  // Navigate using arrows
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
        setIsOpen(false);
      }
    }
  };

  return (
    <>
      {/* Help tooltip on top navigation */}
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-outline-variant hover:border-primary bg-surface-container hover:bg-primary-fixed text-xs font-mono text-outline hover:text-on-surface transition cursor-pointer"
        title="Open Command Center (Ctrl+K)"
      >
        <Command className="w-3.5 h-3.5" />
        <span className="hidden lg:inline text-[10px] uppercase font-bold tracking-widest text-primary">Ctrl+K</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] p-4">
            {/* Dark Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 backdrop-blur-md"
              onClick={() => setIsOpen(false)}
            />

            {/* Dialog Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -10 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="relative w-full max-w-lg bg-surface-container-lowest/90 border border-outline rounded-xl shadow-2xl overflow-hidden backdrop-blur-2xl flex flex-col max-h-[50vh] z-10"
            >
              {/* Glowing Top line */}
              <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-cyan-400 to-purple-500 opacity-60"></div>
 
              {/* Search Bar Input */}
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-outline-variant shrink-0">
                <Search className="w-4 h-4 text-secondary shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Type a command or search..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSelectedIndex(0);
                  }}
                  onKeyDown={handleKeyDown}
                  className="bg-transparent border-0 focus:outline-none w-full text-sm text-on-surface placeholder-white/35 font-mono"
                />
                <span className="text-[10px] font-mono text-outline-variant bg-surface-container border border-outline-variant px-1.5 py-0.5 rounded uppercase">ESC</span>
              </div>
 
              {/* Items Listing */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {filteredItems.length === 0 ? (
                  <div className="text-center font-mono text-xs text-outline-variant py-10">
                    No matching HUD command coordinates found.
                  </div>
                ) : (
                  filteredItems.map((item, idx) => {
                    const isSelected = idx === selectedIndex;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        onClick={() => {
                          item.action();
                          setIsOpen(false);
                        }}
                        className={`w-full flex items-center gap-3.5 p-3 rounded-lg text-left transition ${
                          isSelected 
                            ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/5 border border-secondary text-on-surface' 
                            : 'border border-transparent text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-md flex items-center justify-center transition shrink-0 ${
                          isSelected ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20' : 'bg-surface-container text-primary'
                        }`}>
                          <Icon className="w-4 h-4" strokeWidth={1.5} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono font-bold">{item.title}</span>
                            <span className="text-[9px] font-mono uppercase tracking-widest text-outline-variant">{item.category}</span>
                          </div>
                          <p className="text-[10px] font-sans text-outline truncate mt-0.5">{item.subtitle}</p>
                        </div>
                        {isSelected && (
                          <ArrowUpRight className="w-3.5 h-3.5 text-secondary shrink-0 animate-pulse" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
 
              {/* Keyboard Instruction Footer */}
              <div className="p-3 border-t border-outline-variant bg-surface-container-lowest flex justify-between items-center text-[9px] font-mono text-outline-variant shrink-0">
                <div className="flex gap-2">
                  <span>↑↓ Navigate</span>
                  <span>↵ Select</span>
                </div>
                <span>Autonomous Student OS v1.0</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
