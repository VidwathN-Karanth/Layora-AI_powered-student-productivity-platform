'use client';

import { useCallback, useState } from 'react';
import { KeyRound, RefreshCw, Shield, Trash2, UserPlus, Users } from 'lucide-react';

import { apiFetch, errorMessage, readJson } from '@/lib/apiClient';
import type { Cohort } from '@/lib/cohorts';
import { parseEmailList } from '@/lib/emails';
import { SectionHeader } from '../_components/PanelState';
import { useSectionData } from '../_components/useSectionData';
import { useAdmin } from '../AdminContext';

type Role = 'admin' | 'student';

interface Grant {
  email: string;
  role: Role;
  cohort: Cohort | null;
}

interface AddResult {
  added: string[];
  moved: { email: string; from: Cohort }[];
  skipped: { email: string; reason: string }[];
}

/**
 * A bulk email adder — paste one or many addresses (commas, spaces or new
 * lines) and add them in one go. Reports how many landed and why any were
 * skipped, so a bad line in a pasted class list does not hide the rest.
 */
function AddEmails({ placeholder, onAdd }: { placeholder: string; onAdd: (emails: string[]) => Promise<AddResult> }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AddResult | null>(null);
  const [error, setError] = useState('');

  const parsed = parseEmailList(text);

  const submit = async () => {
    if (parsed.length === 0) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const res = await onAdd(parsed);
      setResult(res);
      // Keep only the ones that failed, so the box shows what still needs fixing.
      setText(res.skipped.map((s) => s.email).join('\n'));
    } catch (err) {
      setError(errorMessage(err, 'Could not add those.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); }}
        placeholder={`${placeholder}\nPaste many at once — commas, spaces or new lines.`}
        rows={2}
        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyber-blue resize-y font-mono"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-mono text-white/30">
          {parsed.length > 0 ? `${parsed.length} email${parsed.length === 1 ? '' : 's'} ready · ⌘/Ctrl+Enter` : ''}
        </span>
        <button
          onClick={submit}
          disabled={busy || parsed.length === 0}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white/10 border border-white/15 hover:bg-white/15 text-white text-xs font-bold uppercase tracking-wider transition cursor-pointer disabled:opacity-40"
        >
          <UserPlus className="w-4 h-4" /> {busy ? 'Adding…' : parsed.length > 1 ? `Add ${parsed.length}` : 'Add'}
        </button>
      </div>
      {error && <p className="text-[11px] font-mono text-rose-300">{error}</p>}
      {result && (
        <div className="text-[11px] font-mono space-y-1">
          {result.added.length > 0 && <p className="text-emerald-400">Added {result.added.length}.</p>}
          {result.moved.length > 0 && (
            <p className="text-cyber-blue">
              Moved {result.moved.length} from another year
              {result.moved.length <= 3 ? ` (${result.moved.map((m) => `${m.email} ← ${m.from}`).join(', ')})` : ''}.
            </p>
          )}
          {result.skipped.length > 0 && (
            <div className="text-amber-300">
              <p>Skipped {result.skipped.length}:</p>
              <ul className="mt-0.5 space-y-0.5 text-amber-300/80">
                {result.skipped.slice(0, 8).map((s) => (
                  <li key={s.email} className="truncate">• {s.email} — {s.reason}</li>
                ))}
                {result.skipped.length > 8 && <li>• …and {result.skipped.length - 8} more</li>}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EmailRow({ email, locked, disabled, onRemove, title }: {
  email: string;
  locked?: string;
  disabled: boolean;
  onRemove: () => void;
  title: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5">
      <span className="text-sm text-white truncate">{email}</span>
      {locked ? (
        <span className="text-[9px] font-mono uppercase tracking-widest text-white/40 shrink-0">{locked}</span>
      ) : (
        <button
          onClick={onRemove}
          disabled={disabled}
          className="p-1.5 rounded-lg border border-white/10 hover:border-rose-400 text-white/60 hover:text-rose-400 transition cursor-pointer disabled:opacity-40 shrink-0"
          title={title}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export default function AdminAccessPage() {
  const { selectedCohort: year } = useAdmin();
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await readJson<{ grants: Grant[] }>(await apiFetch('/api/admin/access'));
      setGrants(Array.isArray(data.grants) ? data.grants : []);
    } catch (err) {
      setError(errorMessage(err, 'Could not load the roster.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useSectionData(load);

  const post = async (body: object): Promise<AddResult> => {
    const res = await readJson<Partial<AddResult>>(await apiFetch('/api/admin/access', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }));
    await load();
    return { added: res.added ?? [], moved: res.moved ?? [], skipped: res.skipped ?? [] };
  };

  const remove = async (target: Grant) => {
    setWorking(true);
    setError('');
    try {
      await readJson(await apiFetch('/api/admin/access', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(target),
      }));
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Could not remove that.'));
    } finally {
      setWorking(false);
    }
  };

  const admins = grants.filter((g) => g.role === 'admin').map((g) => g.email);
  const students = grants.filter((g) => g.role === 'student' && g.cohort === year).map((g) => g.email);

  return (
    <div className="space-y-8">
      <SectionHeader
        icon={KeyRound}
        title="Access Management"
        subtitle="Who runs the console, and which students are in each year."
      >
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-cyber-blue text-white/70 hover:text-white transition cursor-pointer text-[10px] uppercase font-bold tracking-wider"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Reload
        </button>
      </SectionHeader>

      {error && <p className="text-xs text-rose-400 font-mono">{error}</p>}

      {/* --- Students of the year chosen in the header --- */}
      <section className="glass-panel border border-white/10 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Users className="w-4 h-4 text-cyber-blue" /> {year} · Students
          <span className="text-[10px] font-mono text-white/40">({students.length})</span>
        </h3>
        <p className="text-[11px] text-white/40 font-mono">
          Switch years with the selector at the top. Adding someone already in another year moves
          them here, which is how the yearly rollover works. Removing a student only blocks sign-in —
          their workspace stays, so adding them back restores everything.
        </p>
        <AddEmails placeholder="4mt24cs001@mite.ac.in" onAdd={(emails) => post({ emails, role: 'student', cohort: year })} />
        <div className="space-y-2">
          {!loading && students.length === 0 && <p className="text-[11px] text-white/30 font-mono">No students in {year} yet.</p>}
          {students.map((email) => (
            <EmailRow
              key={email}
              email={email}
              disabled={working}
              title="Remove from the roster"
              onRemove={() => remove({ email, role: 'student', cohort: year })}
            />
          ))}
        </div>
      </section>

      {/* --- Admins --- */}
      <section className="glass-panel border border-white/10 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Shield className="w-4 h-4 text-cyber-purple" /> Admins
          <span className="text-[10px] font-mono text-white/40">({admins.length})</span>
        </h3>
        <p className="text-[11px] text-white/40 font-mono">
          Full access to every year. Admins can be any Google account and can add other admins.
        </p>
        <AddEmails placeholder="new-admin@mite.ac.in" onAdd={(emails) => post({ emails, role: 'admin' })} />
        <div className="space-y-2">
          {admins.map((email) => (
            <EmailRow
              key={email}
              email={email}
              locked={admins.length <= 1 ? 'Last admin · locked' : undefined}
              disabled={working}
              title="Remove admin"
              onRemove={() => remove({ email, role: 'admin', cohort: null })}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
