'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Network, Plus, Trash2, X } from 'lucide-react';

import { apiFetch, errorMessage, readJson } from '@/lib/apiClient';
import { formatDate } from '@/lib/dateFormat';

interface MapSummary {
  id: string;
  title: string;
  nodeCount: number;
  updated_at: string;
}

export default function MapListPage() {
  const router = useRouter();

  const [maps, setMaps] = useState<MapSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<MapSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await readJson<{ maps: MapSummary[] }>(await apiFetch('/api/maps'));
      setMaps(Array.isArray(data.maps) ? data.maps : []);
    } catch (err) {
      setError(errorMessage(err, 'Could not load your maps.'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Deferred a microtask so load()'s first setState lands after the commit.
  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);

  const create = async () => {
    const heading = title.trim();
    if (!heading) return;
    setSaving(true);
    setError('');
    try {
      const data = await readJson<{ map: { id: string } }>(
        await apiFetch('/api/maps', {
          method: 'POST',
          body: JSON.stringify({ title: heading }),
        })
      );
      router.push(`/dashboard/map/${data.map.id}`);
    } catch (err) {
      setError(errorMessage(err, 'Could not create the map.'));
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setConfirmDelete(null);
    try {
      await apiFetch(`/api/maps/${id}`, { method: 'DELETE' });
      setMaps((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      setError(errorMessage(err, 'Could not delete the map.'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}><Network className="w-5 h-5" /> Mind Maps</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>Roadmaps of what to learn to master a topic. Pin a card to add it to your courses.</p>
        </div>
        <button onClick={() => { setTitle(''); setError(''); setCreating(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-xs font-bold uppercase tracking-wider transition cursor-pointer hover:brightness-110" style={{ background: '#8b5cf6' }}>
          <Plus className="w-4 h-4" /> New map
        </button>
      </div>

      {error && <p className="text-[11px] text-rose-300 font-mono">{error}</p>}

      {loading ? (
        <div className="glass-panel border rounded-2xl p-10 text-center text-xs font-mono" style={{ borderColor: 'var(--color-outline)', color: 'var(--color-on-surface-variant)' }}>Loading…</div>
      ) : maps.length === 0 ? (
        <div className="glass-panel border rounded-2xl p-10 text-center text-xs font-mono" style={{ borderColor: 'var(--color-outline)', color: 'var(--color-on-surface-variant)' }}>No maps yet. Create one to start a roadmap.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {maps.map((m) => (
            <div key={m.id} className="group relative glass-panel border rounded-2xl p-4 transition" style={{ borderColor: 'var(--color-outline)' }}>
              <button onClick={() => router.push(`/dashboard/map/${m.id}`)} className="block text-left w-full cursor-pointer">
                <div className="w-9 h-9 rounded-lg border flex items-center justify-center" style={{ background: 'var(--color-surface-container)', borderColor: 'var(--color-outline)', color: 'var(--color-on-surface-variant)' }}>
                  <Network className="w-4 h-4" />
                </div>
                <div className="mt-3 font-bold text-sm truncate" style={{ color: 'var(--color-on-surface)' }}>{m.title}</div>
                <div className="text-[10px] mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>{m.nodeCount} card{m.nodeCount === 1 ? '' : 's'} · updated {formatDate(new Date(m.updated_at))}</div>
              </button>
              <button onClick={() => setConfirmDelete(m)} title="Delete map"
                className="absolute top-2 right-2 p-1 rounded-lg border border-white/10 text-white/40 hover:text-rose-400 hover:border-rose-400 opacity-0 group-hover:opacity-100 transition cursor-pointer">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div onClick={() => !saving && setCreating(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div role="dialog" aria-modal="true" className="glass-panel border p-6 rounded-2xl max-w-md w-full relative z-10 space-y-3" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline)' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold" style={{ color: 'var(--color-on-surface)' }}>New map</h3>
              <button onClick={() => setCreating(false)} className="cursor-pointer" style={{ color: 'var(--color-on-surface-variant)' }}><X className="w-4 h-4" /></button>
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase" style={{ color: 'var(--color-on-surface-variant)' }}>Topic / heading</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') create(); }} autoFocus placeholder="e.g. Mastering React"
                style={{ background: 'var(--color-surface-container-lowest)', borderColor: 'var(--color-outline)', color: 'var(--color-on-surface)' }}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
            {error && <p className="text-[11px] text-rose-300 font-mono">{error}</p>}
            <div className="flex justify-end gap-3 pt-1">
              <button onClick={() => setCreating(false)} className="px-4 py-2 border rounded-xl text-xs font-bold cursor-pointer" style={{ borderColor: 'var(--color-outline)', color: 'var(--color-on-surface-variant)' }}>CANCEL</button>
              <button onClick={create} disabled={saving} className="px-4 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 text-white" style={{ background: '#8b5cf6' }}>{saving ? 'CREATING…' : 'CREATE'}</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div onClick={() => setConfirmDelete(null)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div role="dialog" aria-modal="true" className="glass-panel border p-6 rounded-2xl max-w-md w-full relative z-10 space-y-3" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline)' }}>
            <h3 className="text-base font-bold" style={{ color: 'var(--color-on-surface)' }}>Delete “{confirmDelete.title}”?</h3>
            <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>This removes the map and its cards. Pinned courses already in your list stay.</p>
            <div className="flex justify-end gap-3 pt-1">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 border rounded-xl text-xs font-bold cursor-pointer" style={{ borderColor: 'var(--color-outline)', color: 'var(--color-on-surface-variant)' }}>CANCEL</button>
              <button onClick={() => remove(confirmDelete.id)} className="px-4 py-2 bg-rose-500/15 border border-rose-500/30 hover:bg-rose-500/25 text-rose-300 rounded-xl text-xs font-bold cursor-pointer">DELETE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
