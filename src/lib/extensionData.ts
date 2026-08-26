import 'server-only';

import { supabaseAdmin } from './supabaseAdmin';

/**
 * The extension's read/write path into a student's workspace.
 *
 * Quick launchers and courses are not tables — they are arrays inside the one
 * `user_states.state` JSON blob the web app syncs wholesale. So a write here is
 * a read-modify-write of that blob, touching only the array in question and
 * leaving every other key exactly as it was.
 *
 * Two consequences worth knowing:
 *  - We bump `clientTimestamp` on write, because that is what an open Layora
 *    tab compares against when its realtime subscription delivers the change.
 *    Without it the tab would keep its older copy and write it back.
 *  - There is still a narrow race: a tab that had already staged a write can
 *    land it after ours and drop the new launcher. The tab picks the change up
 *    within its sync interval, which closes the window in practice but not in
 *    theory. Fixing it properly means moving launchers out of the blob.
 */

export interface QuickLauncher {
  id: string;
  name: string;
  url: string;
  /** Origin-derived favicon, resolved here so the popup does not have to guess. */
  icon: string | null;
}

export interface ExtensionCourse {
  id: string;
  name: string;
  platform: string;
  progress: number;
  deadline: string | null;
}

interface StoredWebsite {
  id?: string;
  name?: string;
  url?: string;
  timeSpentGoal?: number;
}

interface StoredCourse {
  id?: string;
  name?: string;
  platform?: string;
  progress?: number;
  deadline?: string;
}

type UserState = Record<string, unknown> & {
  websites?: StoredWebsite[];
  courses?: StoredCourse[];
};

async function readState(userId: string): Promise<UserState | null> {
  const { data, error } = await supabaseAdmin
    .from('user_states')
    .select('state')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw new Error(`Could not read the workspace: ${error.message}`);
  const state = (data as { state?: UserState } | null)?.state;
  return state && typeof state === 'object' ? state : null;
}

async function writeState(userId: string, state: UserState): Promise<void> {
  const { error } = await supabaseAdmin
    .from('user_states')
    .upsert({
      id: userId,
      // An open tab compares this before accepting a realtime update.
      state: { ...state, clientTimestamp: Date.now() },
      updated_at: new Date().toISOString(),
    });

  if (error) throw new Error(`Could not save the workspace: ${error.message}`);
}

/**
 * A link the extension is willing to open, or null.
 *
 * Only http and https: a `javascript:` or `data:` URL saved here would be
 * handed to `chrome.tabs.create` later, which is a script-execution hole
 * dressed up as a bookmark.
 */
export function normaliseUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 2000) return null;

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname.includes('.')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Google's favicon service — no key, cached hard, and it degrades to a globe. */
function faviconFor(url: string): string | null {
  try {
    const { hostname } = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`;
  } catch {
    return null;
  }
}

function mapLauncher(site: StoredWebsite, index: number): QuickLauncher {
  const url = typeof site.url === 'string' ? site.url : '';
  return {
    id: String(site.id || `site-${index}`),
    name: String(site.name || url || 'Untitled').slice(0, 80),
    url,
    icon: url ? faviconFor(url) : null,
  };
}

export async function listQuickLaunchers(userId: string): Promise<QuickLauncher[]> {
  const state = await readState(userId);
  return (state?.websites || []).map(mapLauncher);
}

export async function addQuickLauncher(
  userId: string,
  input: { name: string; url: string }
): Promise<QuickLauncher[]> {
  const state = (await readState(userId)) || {};
  const websites = Array.isArray(state.websites) ? [...state.websites] : [];

  // A launcher list is a convenience, not a bookmark manager; a cap keeps one
  // runaway client from bloating the state blob every device has to download.
  if (websites.length >= 60) {
    throw new Error('You have reached the maximum of 60 quick launchers.');
  }

  websites.push({
    id: `site-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: input.name.slice(0, 80),
    url: input.url,
    // The web app's own form asks for this; keep the shape identical so the
    // dashboard renders an extension-made launcher exactly like its own.
    timeSpentGoal: 0,
  });

  await writeState(userId, { ...state, websites });
  return websites.map(mapLauncher);
}

export async function removeQuickLauncher(userId: string, id: string): Promise<QuickLauncher[]> {
  const state = (await readState(userId)) || {};
  const websites = Array.isArray(state.websites) ? state.websites : [];
  const remaining = websites.filter((s) => String(s.id) !== id);

  if (remaining.length !== websites.length) {
    await writeState(userId, { ...state, websites: remaining });
  }
  return remaining.map(mapLauncher);
}

export async function listCourses(userId: string): Promise<ExtensionCourse[]> {
  const state = await readState(userId);

  return (state?.courses || []).map((course, index) => ({
    id: String(course.id || `course-${index}`),
    name: String(course.name || 'Untitled course').slice(0, 120),
    platform: String(course.platform || '').slice(0, 40),
    progress: Math.max(0, Math.min(100, Math.round(Number(course.progress) || 0))),
    deadline: typeof course.deadline === 'string' ? course.deadline : null,
  }));
}
