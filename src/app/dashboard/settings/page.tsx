'use client';

import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { 
  Settings, Key, Eye, EyeOff, Check, Sparkles, 
  User, Bell, Calendar, ShieldCheck, RefreshCw 
} from 'lucide-react';

export default function SettingsPage() {
  const store = useStore();

  // API Key visibility state
  const [showKeys, setShowKeys] = useState<{ [key: string]: boolean }>({});
  
  // Local profile states
  const [name, setName] = useState(store.user?.name || '');
  const [wakeTime, setWakeTime] = useState(store.user?.wakeTime || '06:00');
  const [sleepTime, setSleepTime] = useState(store.user?.sleepTime || '22:00');
  const [collegeStart, setCollegeStart] = useState(store.user?.collegeStart || '09:00');
  const [collegeEnd, setCollegeEnd] = useState(store.user?.collegeEnd || '16:00');

  // Local key inputs
  const [openaiKey, setOpenaiKey] = useState(store.apiKeys.openai || '');
  const [geminiKey, setGeminiKey] = useState(store.apiKeys.gemini || '');
  const [claudeKey, setClaudeKey] = useState(store.apiKeys.claude || '');
  const [grokKey, setGrokKey] = useState(store.apiKeys.grok || '');

  const [savingKeys, setSavingKeys] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const toggleShowKey = (provider: string) => {
    setShowKeys({ ...showKeys, [provider]: !showKeys[provider] });
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    store.updateRoutine({
      name,
      wakeTime,
      sleepTime,
      collegeStart,
      collegeEnd
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleSaveKeys = (e: React.FormEvent) => {
    e.preventDefault();
    setSavingKeys(true);
    
    store.setApiKeys({
      openai: openaiKey,
      gemini: geminiKey,
      claude: claudeKey,
      grok: grokKey
    });

    setTimeout(() => {
      setSavingKeys(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }, 1000);
  };

  const themeAccents = [
    { name: 'purple', label: 'Neon Purple', color: 'bg-purple-600 border-purple-400' },
    { name: 'blue', label: 'Cyber Blue', color: 'bg-blue-600 border-blue-400' },
    { name: 'pink', label: 'Tokyo Pink', color: 'bg-pink-600 border-pink-400' },
    { name: 'emerald', label: 'Matrix Emerald', color: 'bg-emerald-600 border-emerald-400' }
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="border-b border-white/5 pb-4">
        <h2 className="text-xl font-mono font-bold tracking-wide">System Settings</h2>
        <p className="text-xs text-white/40 font-mono mt-0.5">Customize UI configurations, sync calendars, and manage AI API bindings.</p>
      </div>

      {saveSuccess && (
        <div className="bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 p-4 rounded-2xl text-xs font-mono flex items-center gap-2">
          <Check className="w-4 h-4 animate-bounce" />
          Configuration updated successfully
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* --- PANEL 1: ACCOUNT PROFILE & CYCLES --- */}
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-white/5 pb-2">
            <User className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-mono font-bold tracking-wider text-purple-400">Academic Rhythm Profile</h3>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-[10px] font-mono text-white/50 mb-1">Username / Alias</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-mono text-white/50 mb-1">Wake Cycle</label>
                <input
                  type="time"
                  value={wakeTime}
                  onChange={(e) => setWakeTime(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-white/50 mb-1">Sleep Cycle</label>
                <input
                  type="time"
                  value={sleepTime}
                  onChange={(e) => setSleepTime(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-mono text-white/50 mb-1">College Start</label>
                <input
                  type="time"
                  value={collegeStart}
                  onChange={(e) => setCollegeStart(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-white/50 mb-1">College End</label>
                <input
                  type="time"
                  value={collegeEnd}
                  onChange={(e) => setCollegeEnd(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                />
              </div>
            </div>

            <button
              type="submit"
              className="bg-purple-600 hover:bg-purple-500 text-white rounded-lg px-4 py-2 text-xs font-mono font-bold transition cursor-pointer"
            >
              Save Rhythm Cycles
            </button>
          </form>
        </div>

        {/* --- PANEL 2: MODULAR AI API KEYS --- */}
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-white/5 pb-2">
            <Key className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-mono font-bold tracking-wider text-purple-400 font-bold">Modular AI API Keys</h3>
          </div>

          <form onSubmit={handleSaveKeys} className="space-y-4">
            <p className="text-[10px] text-white/50 font-mono leading-relaxed">
              Input custom model credentials to bypass default engines. Keys are encrypted & stored in client localStorage.
            </p>

            <div className="space-y-3">
              {/* OpenAI Key */}
              <div>
                <label className="block text-[9px] font-mono text-white/50 mb-1">OpenAI API Key</label>
                <div className="relative">
                  <input
                    type={showKeys.openai ? 'text' : 'password'}
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder="sk-proj-..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-1.5 pl-3 pr-10 text-xs text-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey('openai')}
                    className="absolute right-2 top-2 text-white/40 hover:text-white"
                  >
                    {showKeys.openai ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Gemini Key */}
              <div>
                <label className="block text-[9px] font-mono text-white/50 mb-1">Gemini API Key</label>
                <div className="relative">
                  <input
                    type={showKeys.gemini ? 'text' : 'password'}
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-1.5 pl-3 pr-10 text-xs text-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey('gemini')}
                    className="absolute right-2 top-2 text-white/40 hover:text-white"
                  >
                    {showKeys.gemini ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Claude Key */}
              <div>
                <label className="block text-[9px] font-mono text-white/50 mb-1">Claude API Key</label>
                <div className="relative">
                  <input
                    type={showKeys.claude ? 'text' : 'password'}
                    value={claudeKey}
                    onChange={(e) => setClaudeKey(e.target.value)}
                    placeholder="sk-ant-..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-1.5 pl-3 pr-10 text-xs text-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey('claude')}
                    className="absolute right-2 top-2 text-white/40 hover:text-white"
                  >
                    {showKeys.claude ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Grok Key */}
              <div>
                <label className="block text-[9px] font-mono text-white/50 mb-1">Grok API Key</label>
                <div className="relative">
                  <input
                    type={showKeys.grok ? 'text' : 'password'}
                    value={grokKey}
                    onChange={(e) => setGrokKey(e.target.value)}
                    placeholder="xai-..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-1.5 pl-3 pr-10 text-xs text-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey('grok')}
                    className="absolute right-2 top-2 text-white/40 hover:text-white"
                  >
                    {showKeys.grok ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingKeys}
              className="bg-purple-600 hover:bg-purple-500 text-white rounded-lg px-4 py-2 text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1.5"
            >
              {savingKeys ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
              Save API Keys
            </button>
          </form>
        </div>

        {/* --- PANEL 3: VISUAL THEMING --- */}
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-white/5 pb-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-mono font-bold tracking-wider text-purple-400">Interface Theming</h3>
          </div>

          <div className="space-y-4">
            <p className="text-[10px] text-white/50 font-mono">
              Toggle global neon themes to adjust border highlights and glowing overlays.
            </p>

            <div className="grid grid-cols-2 gap-2">
              {themeAccents.map((acc) => {
                const active = store.themeAccent === acc.name;
                return (
                  <button
                    key={acc.name}
                    onClick={() => store.setThemeAccent(acc.name as any)}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-xs font-mono transition text-left cursor-pointer ${
                      active 
                        ? 'border-purple-500 bg-purple-950/20 text-white font-bold' 
                        : 'border-white/5 bg-white/2 text-white/60 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full border ${acc.color} shrink-0`}></span>
                    <span>{acc.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* --- PANEL 4: CALENDAR INTEGRATIONS --- */}
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-white/5 pb-2">
            <Calendar className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-mono font-bold tracking-wider text-purple-400">Calendar OAuth Integration</h3>
          </div>

          <div className="space-y-4">
            <p className="text-[10px] text-white/50 font-mono leading-relaxed">
              Establish synchronization pathways with Google Calendar services. Auto-export allows agenda revisions in real-time.
            </p>

            <div className="bg-white/5 border border-white/5 rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-white block">Google OAuth Token</span>
                <span className="text-[9px] font-mono text-white/40">Status: {store.calendarSynced ? 'Active Sync' : 'Inactive'}</span>
              </div>

              {store.calendarSynced ? (
                <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-400 bg-emerald-950/30 border border-emerald-500/20 rounded-full px-3 py-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> AUTHORIZED
                </div>
              ) : (
                <button
                  onClick={() => { store.setCalendarSynced(true); setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 2000); }}
                  className="bg-cyan-900/30 border border-cyan-500/30 text-cyan-200 text-[10px] font-mono font-bold px-3 py-1.5 rounded-lg hover:bg-cyan-900/50 transition cursor-pointer"
                >
                  Authorize OAuth
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
