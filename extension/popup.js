/**
 * The popup.
 *
 * Draws the cache first and revalidates behind it, so opening this feels
 * instant even on a slow connection. Every list item is a real <button>, so
 * the whole thing works from the keyboard without extra handling.
 */

import {
  CONNECT_URL, COURSES_URL, DASHBOARD_URL, api, fetchAll, getLastTab, getToken,
  readCache, setLastTab, writeCache,
} from './lib.js';

const el = (id) => document.getElementById(id);

const ui = {
  loading: el('loading'),
  gate: el('gate'),
  app: el('app'),
  who: el('who'),
  notice: el('notice'),
  tabs: { launchers: el('tab-launchers'), courses: el('tab-courses') },
  panels: { launchers: el('panel-launchers'), courses: el('panel-courses') },
  launchers: el('launchers'),
  launchersEmpty: el('launchers-empty'),
  courses: el('courses'),
  coursesEmpty: el('courses-empty'),
  form: el('add-form'),
  url: el('add-url'),
  name: el('add-name'),
  addOpen: el('add-open'),
  addCancel: el('add-cancel'),
  addSubmit: el('add-submit'),
};

let state = { launchers: [], courses: [] };
/** The launcher currently being dragged, if any. */
let dragId = null;

function closeMenus() {
  for (const menu of document.querySelectorAll('.menu')) menu.hidden = true;
}

/* ── chrome helpers ──────────────────────────────────────────── */

const openTab = (url) => {
  chrome.tabs.create({ url });
  window.close();
};

function notice(text, tone) {
  if (!text) {
    ui.notice.hidden = true;
    return;
  }
  ui.notice.textContent = text;
  ui.notice.dataset.tone = tone || 'info';
  ui.notice.hidden = false;
}

/* ── rendering ───────────────────────────────────────────────── */

function launcherRow(launcher) {
  const li = document.createElement('li');

  const row = document.createElement('button');
  row.className = 'row';
  row.title = launcher.url;
  row.addEventListener('click', () => openTab(launcher.url));

  if (launcher.icon) {
    const img = document.createElement('img');
    img.src = launcher.icon;
    img.alt = '';
    // A blocked or missing favicon leaves a broken frame otherwise.
    img.addEventListener('error', () => img.replaceWith(fallbackIcon(launcher.name)));
    row.append(img);
  } else {
    row.append(fallbackIcon(launcher.name));
  }

  const main = document.createElement('span');
  main.className = 'row-main';

  const title = document.createElement('span');
  title.className = 'row-title';
  title.textContent = launcher.name;

  const sub = document.createElement('span');
  sub.className = 'row-sub';
  sub.textContent = hostOf(launcher.url);

  main.append(title, sub);
  row.append(main);

  // Delete sits behind a menu rather than in the open: a bin icon on every
  // tile is one stray click away from losing a link.
  const menuButton = document.createElement('button');
  menuButton.className = 'menu-button';
  menuButton.type = 'button';
  menuButton.textContent = '⋮';
  menuButton.title = `Options for ${launcher.name}`;
  menuButton.setAttribute('aria-label', `Options for ${launcher.name}`);
  menuButton.setAttribute('aria-haspopup', 'menu');

  const menu = document.createElement('div');
  menu.className = 'menu';
  menu.setAttribute('role', 'menu');
  menu.hidden = true;

  const hint = document.createElement('span');
  hint.className = 'menu-hint';
  hint.textContent = 'Drag to reorder';

  const del = document.createElement('button');
  del.className = 'menu-item danger';
  del.type = 'button';
  del.setAttribute('role', 'menuitem');
  del.textContent = 'Delete';
  del.addEventListener('click', (event) => {
    event.stopPropagation();
    closeMenus();
    void removeLauncher(launcher);
  });

  menu.append(hint, del);

  menuButton.addEventListener('click', (event) => {
    event.stopPropagation();
    const open = !menu.hidden;
    closeMenus();
    if (open) return;

    // The list scrolls, so a menu hanging off a bottom tile would be clipped.
    const listBox = ui.launchers.getBoundingClientRect();
    const tileBox = li.getBoundingClientRect();
    menu.classList.toggle('menu-up', tileBox.bottom + 84 > listBox.bottom);
    menu.hidden = false;
  });

  // ── drag to reorder ──
  li.draggable = true;
  li.dataset.id = launcher.id;

  li.addEventListener('dragstart', (event) => {
    dragId = launcher.id;
    li.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    // Firefox refuses to start a drag without payload.
    event.dataTransfer.setData('text/plain', launcher.id);
  });

  li.addEventListener('dragend', () => {
    dragId = null;
    li.classList.remove('dragging');
    for (const el of ui.launchers.children) el.classList.remove('drag-over');
  });

  li.addEventListener('dragover', (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (dragId && dragId !== launcher.id) li.classList.add('drag-over');
  });

  li.addEventListener('dragleave', () => li.classList.remove('drag-over'));

  li.addEventListener('drop', (event) => {
    event.preventDefault();
    li.classList.remove('drag-over');
    void moveLauncher(dragId, launcher.id);
  });

  li.append(row, menuButton, menu);
  return li;
}

function fallbackIcon(name) {
  const span = document.createElement('span');
  span.className = 'fallback';
  span.textContent = (name || '?').trim().charAt(0).toUpperCase();
  return span;
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function courseRow(course) {
  const li = document.createElement('li');

  // The course itself, not our page about it. Only a course saved without a
  // link falls back to Layora, where they can add one.
  const target = course.url || COURSES_URL;

  const row = document.createElement('button');
  row.className = 'row';
  row.title = course.url ? `Continue ${course.name} at ${course.platform}` : `Open ${course.name} in Layora`;
  row.addEventListener('click', () => openTab(target));

  row.append(fallbackIcon(course.platform || course.name));

  const main = document.createElement('span');
  main.className = 'row-main';

  const title = document.createElement('span');
  title.className = 'row-title';
  title.textContent = course.name;

  const sub = document.createElement('span');
  sub.className = 'row-sub';
  sub.textContent = course.url
    ? `${course.platform} · ${course.progress}%`
    : `No link saved · ${course.progress}%`;

  const meter = document.createElement('span');
  meter.className = 'meter';
  const fill = document.createElement('span');
  fill.style.width = `${course.progress}%`;
  meter.append(fill);

  main.append(title, sub, meter);
  row.append(main);
  li.append(row);
  return li;
}

function render() {
  ui.launchers.replaceChildren(...state.launchers.map(launcherRow));
  ui.launchersEmpty.hidden = state.launchers.length > 0;

  ui.courses.replaceChildren(...state.courses.map(courseRow));
  ui.coursesEmpty.hidden = state.courses.length > 0;
}

function showTab(which) {
  for (const key of ['launchers', 'courses']) {
    const active = key === which;
    ui.tabs[key].setAttribute('aria-selected', String(active));
    ui.panels[key].hidden = !active;
  }
  void setLastTab(which);
}

/* ── actions ─────────────────────────────────────────────────── */

async function removeLauncher(launcher) {
  const previous = state.launchers;
  // Optimistic: the row goes now, and comes back if the server disagrees.
  state.launchers = state.launchers.filter((l) => l.id !== launcher.id);
  render();

  try {
    const body = await api(`/api/extension/quicklaunchers/?id=${encodeURIComponent(launcher.id)}`, {
      method: 'DELETE',
    });
    state.launchers = body.launchers || [];
    render();
    await writeCache({ launchers: state.launchers });
  } catch (error) {
    state.launchers = previous;
    render();
    notice(error.message || 'Could not remove that.', 'error');
  }
}

async function moveLauncher(sourceId, targetId) {
  dragId = null;
  if (!sourceId || sourceId === targetId) return;

  const ids = state.launchers.map((l) => l.id);
  const from = ids.indexOf(sourceId);
  const to = ids.indexOf(targetId);
  if (from === -1 || to === -1) return;

  const previous = state.launchers;
  ids.splice(to, 0, ids.splice(from, 1)[0]);
  state.launchers = ids.map((id) => previous.find((l) => l.id === id));
  render();

  try {
    const body = await api('/api/extension/quicklaunchers/', {
      method: 'PATCH',
      body: JSON.stringify({ order: ids }),
    });
    state.launchers = body.launchers || state.launchers;
    render();
    await writeCache({ launchers: state.launchers });
  } catch (error) {
    state.launchers = previous;
    render();
    notice(error.message || 'Could not save that order.', 'error');
  }
}

async function addLauncher(event) {
  event.preventDefault();
  const url = ui.url.value.trim();
  if (!url) return;

  ui.addSubmit.disabled = true;
  notice('');

  try {
    const body = await api('/api/extension/quicklaunchers/', {
      method: 'POST',
      body: JSON.stringify({ url, name: ui.name.value.trim() || undefined }),
    });
    state.launchers = body.launchers || [];
    render();
    await writeCache({ launchers: state.launchers });

    ui.form.reset();
    ui.form.dataset.open = 'false';
    ui.addOpen.hidden = false;
  } catch (error) {
    notice(error.message || 'Could not add that link.', 'error');
  } finally {
    ui.addSubmit.disabled = false;
  }
}

/* ── boot ────────────────────────────────────────────────────── */

async function boot() {
  el('open-dashboard').addEventListener('click', () => openTab(DASHBOARD_URL));
  ui.tabs.launchers.addEventListener('click', () => showTab('launchers'));
  ui.tabs.courses.addEventListener('click', () => showTab('courses'));
  el('connect').addEventListener('click', () => openTab(CONNECT_URL));
  el('open-courses').addEventListener('click', () => openTab(COURSES_URL));

  ui.addOpen.addEventListener('click', () => {
    ui.form.dataset.open = 'true';
    ui.addOpen.hidden = true;
    ui.url.focus();
  });
  ui.addCancel.addEventListener('click', () => {
    ui.form.reset();
    ui.form.dataset.open = 'false';
    ui.addOpen.hidden = false;
    notice('');
  });
  ui.form.addEventListener('submit', addLauncher);
  document.addEventListener('click', closeMenus);

  const token = await getToken();
  const cache = await readCache();

  // Something to look at immediately, if we have ever succeeded before.
  if (cache && cache.me) {
    state = { launchers: cache.launchers || [], courses: cache.courses || [] };
    ui.who.textContent = cache.me.name || '';
    render();
    ui.loading.hidden = true;
    ui.app.hidden = false;
    showTab(await getLastTab());
  } else if (!token) {
    // Never connected and no cookie session to fall back on.
    ui.loading.hidden = true;
    ui.gate.hidden = false;
    return;
  }

  try {
    const data = await fetchAll();
    state = { launchers: data.launchers, courses: data.courses };
    ui.who.textContent = (data.me && data.me.name) || '';
    render();
    await writeCache(data);

    ui.loading.hidden = true;
    ui.gate.hidden = true;
    ui.app.hidden = false;
    showTab(await getLastTab());
    notice('');
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      // The token was revoked, or the account left the roster.
      ui.loading.hidden = true;
      ui.app.hidden = true;
      ui.gate.hidden = false;
      notice(error.message, 'error');
      return;
    }

    ui.loading.hidden = true;
    if (cache && cache.me) {
      notice("Showing your last saved copy — couldn't reach Layora.", 'error');
    } else {
      ui.gate.hidden = false;
      notice(error.message || 'Could not reach Layora.', 'error');
    }
  }
}

void boot();
