/**
 * The popup.
 *
 * Draws the cache first and revalidates behind it, so opening this feels
 * instant even on a slow connection. Every list item is a real <button>, so
 * the whole thing works from the keyboard without extra handling.
 *
 * Two workspaces, Layora and Club-Crumbs, share this one popup. Each keeps its
 * own token and its own cache, so switching between them is instant; the header
 * switcher only enables a workspace once it is connected.
 */

import {
  SERVICES, SERVICE_IDS, api, clearToken, connectedServices, ext, fetchAll,
  getActiveService, getLastTab, migrateLegacy, readCache, serviceUrls,
  setActiveService, setLastTab, writeCache,
} from './lib.js';

const el = (id) => document.getElementById(id);

const ui = {
  loading: el('loading'),
  gate: el('gate'),
  gateTitle: el('gate-title'),
  gateBody: el('gate-body'),
  gateActions: el('gate-actions'),
  app: el('app'),
  who: el('who'),
  notice: el('notice'),
  openDashboard: el('open-dashboard'),
  openCourses: el('open-courses'),
  switchBtns: { layora: el('svc-layora'), clubcrumbs: el('svc-clubcrumbs') },
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

/** The workspace the popup is currently showing. */
let active = 'layora';
let state = { launchers: [], courses: [] };
/** The launcher currently being dragged, if any. */
let dragId = null;

const activeLabel = () => SERVICES[active].label;

function closeMenus() {
  for (const menu of document.querySelectorAll('.menu')) menu.hidden = true;
}

/* ── chrome helpers ──────────────────────────────────────────── */

const openTab = (url) => {
  ext.tabs.create({ url });
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
  // link falls back to the workspace, where they can add one.
  const target = course.url || serviceUrls(active).courses;

  const row = document.createElement('button');
  row.className = 'row';
  row.title = course.url
    ? `Continue ${course.name} at ${course.platform}`
    : `Open ${course.name} in ${activeLabel()}`;
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
    const isActive = key === which;
    ui.tabs[key].setAttribute('aria-selected', String(isActive));
    ui.panels[key].hidden = !isActive;
  }
  void setLastTab(which);
}

/* ── workspace switching ─────────────────────────────────────── */

/** The account line under the header, e.g. "Asha Rao · Club-Crumbs". */
function accountLine(me) {
  const name = (me && me.name) || '';
  return name ? `${name} · ${activeLabel()}` : activeLabel();
}

/** Paint the two switch buttons from what is connected. */
function renderSwitch(connected) {
  for (const id of SERVICE_IDS) {
    const btn = ui.switchBtns[id];
    const isConnected = connected.includes(id);
    btn.disabled = !isConnected;
    btn.setAttribute('aria-pressed', String(id === active && isConnected));
    btn.title = isConnected
      ? `Show ${SERVICES[id].label}`
      : `Sign in on ${new URL(SERVICES[id].origin).host} and press Connect to enable`;
  }
}

/** Outbound links and labels that depend on the active workspace. */
function applyServiceChrome() {
  ui.openDashboard.title = `Open the ${activeLabel()} dashboard`;
  ui.openCourses.textContent = `Open courses in ${activeLabel()}`;
}

function showApp() {
  ui.loading.hidden = true;
  ui.gate.hidden = true;
  ui.app.hidden = false;
}

function showGate(connected) {
  ui.loading.hidden = true;
  ui.app.hidden = true;
  ui.who.hidden = true;

  const unconnected = SERVICE_IDS.filter((id) => !connected.includes(id));
  ui.gateTitle.textContent = connected.length ? `Connect ${activeLabel()}` : 'Connect a workspace';

  ui.gateActions.replaceChildren(
    ...unconnected.map((id, index) => {
      const btn = document.createElement('button');
      btn.className = index === 0 ? 'primary' : 'ghost';
      btn.textContent = `Open ${SERVICES[id].label}`;
      btn.addEventListener('click', () => openTab(serviceUrls(id).connect));
      return btn;
    })
  );

  ui.gate.hidden = false;
}

/** Which workspace to show: the stored choice if connected, else any connected. */
async function resolveActive(connected) {
  const stored = await getActiveService();
  if (connected.includes(stored)) return stored;
  if (connected.length) return connected[0];
  return stored;
}

async function switchTo(id) {
  if (id === active) return;
  const connected = await connectedServices();
  if (!connected.includes(id)) return; // Button is disabled anyway.

  active = id;
  await setActiveService(id);
  notice('');
  ui.app.hidden = true;
  ui.loading.hidden = false;
  await load(connected);
}

/**
 * Draw the active workspace: cache first, then a live fetch behind it.
 *
 * A revoked token here fails over to the other workspace if one is connected,
 * rather than dropping the student at a dead end.
 */
async function load(connected) {
  connected = connected || (await connectedServices());
  renderSwitch(connected);

  if (!connected.includes(active)) {
    showGate(connected);
    return;
  }

  applyServiceChrome();
  const cache = await readCache(active);

  if (cache && cache.me) {
    state = { launchers: cache.launchers || [], courses: cache.courses || [] };
    ui.who.textContent = accountLine(cache.me);
    ui.who.hidden = false;
    render();
    showApp();
    showTab(await getLastTab());
  }

  try {
    const data = await fetchAll(active);
    state = { launchers: data.launchers, courses: data.courses };
    ui.who.textContent = accountLine(data.me);
    ui.who.hidden = false;
    render();
    await writeCache(active, data);
    showApp();
    showTab(await getLastTab());
    notice('');
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      // The token was revoked, or the account left the roster. Drop it and
      // fall back to whatever else is connected.
      await clearToken(active);
      const now = await connectedServices();
      active = await resolveActive(now);
      await load(now);
      return;
    }

    if (cache && cache.me) {
      showApp();
      notice(`Showing your last saved copy — couldn't reach ${activeLabel()}.`, 'error');
    } else {
      showGate(connected);
    }
  }
}

/* ── actions ─────────────────────────────────────────────────── */

async function removeLauncher(launcher) {
  const previous = state.launchers;
  // Optimistic: the row goes now, and comes back if the server disagrees.
  state.launchers = state.launchers.filter((l) => l.id !== launcher.id);
  render();

  try {
    const body = await api(active, `/api/extension/quicklaunchers/?id=${encodeURIComponent(launcher.id)}`, {
      method: 'DELETE',
    });
    state.launchers = body.launchers || [];
    render();
    await writeCache(active, { launchers: state.launchers });
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
    const body = await api(active, '/api/extension/quicklaunchers/', {
      method: 'PATCH',
      body: JSON.stringify({ order: ids }),
    });
    state.launchers = body.launchers || state.launchers;
    render();
    await writeCache(active, { launchers: state.launchers });
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
    const body = await api(active, '/api/extension/quicklaunchers/', {
      method: 'POST',
      body: JSON.stringify({ url, name: ui.name.value.trim() || undefined }),
    });
    state.launchers = body.launchers || [];
    render();
    await writeCache(active, { launchers: state.launchers });

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
  ui.openDashboard.addEventListener('click', () => openTab(serviceUrls(active).dashboard));
  ui.openCourses.addEventListener('click', () => openTab(serviceUrls(active).courses));
  ui.tabs.launchers.addEventListener('click', () => showTab('launchers'));
  ui.tabs.courses.addEventListener('click', () => showTab('courses'));

  for (const id of SERVICE_IDS) {
    ui.switchBtns[id].addEventListener('click', () => void switchTo(id));
  }

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

  await migrateLegacy();
  const connected = await connectedServices();
  active = await resolveActive(connected);
  await load(connected);
}

void boot();
