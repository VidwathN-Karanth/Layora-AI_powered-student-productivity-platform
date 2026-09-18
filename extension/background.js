/**
 * The service worker does two jobs.
 *
 * 1. Receives a pairing token from a workspace's website. The /extension page
 *    calls chrome.runtime.sendMessage with a token it minted for the signed-in
 *    student; `externally_connectable` in the manifest limits who may do that
 *    to the known workspace origins, so no other site can hand us a token or
 *    read ours. The sender's origin also decides which workspace the token
 *    belongs to.
 * 2. Keeps every connected workspace's cache warm on a timer, so opening the
 *    popup draws instantly rather than waiting on a network round trip.
 */

import {
  IS_GECKO, clearToken, connectedServices, ext, fetchAll, migrateLegacy,
  serviceForOrigin, setToken, writeCache,
} from './lib.js';

const REFRESH_ALARM = 'layora-refresh';

ext.runtime.onInstalled.addListener(() => {
  ext.alarms.create(REFRESH_ALARM, { periodInMinutes: 15 });
  void migrateLegacy().then(refresh);
});

ext.runtime.onStartup.addListener(() => {
  void migrateLegacy().then(refresh);
});

ext.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REFRESH_ALARM) void refresh();
});

/**
 * Messages from a workspace's website.
 *
 * The sender's origin is checked again here even though the manifest already
 * restricts it — belt and braces, because this handler writes the credential
 * everything else depends on. That same origin names the workspace the token
 * is filed under, so a token minted on Club-Crumbs can never land in the
 * Layora slot.
 */
if (ext.runtime.onMessageExternal) ext.runtime.onMessageExternal.addListener(handleMessage);

/**
 * The same messages, relayed by the content script on a workspace's /extension
 * page.
 *
 * An unpacked install has a random extension id, which the page cannot know, so
 * `externally_connectable` alone would leave Connect broken for anyone testing
 * before the Web Store listing exists. The sender's url is still checked.
 */
ext.runtime.onMessage.addListener(handleMessage);

/** What to reply, independent of how this browser wants it delivered. */
async function respond(message, sender) {
  const from = (sender && (sender.origin || sender.url)) || '';
  const serviceId = serviceForOrigin(from);
  if (!serviceId) return { ok: false, error: 'Unrecognised origin.' };

  if (message && message.type === 'layora:connect' && typeof message.token === 'string') {
    await setToken(serviceId, message.token);
    try {
      const data = await fetchAll(serviceId);
      await writeCache(serviceId, data);
      return { ok: true, name: data.me && data.me.name };
    } catch (error) {
      // The token stored but the first fetch failed — keep the token, let the
      // popup retry, and tell the page it is connected.
      return { ok: true, warning: String(error.message || error) };
    }
  }

  if (message && message.type === 'layora:disconnect') {
    await clearToken(serviceId);
    return { ok: true };
  }

  if (message && message.type === 'layora:ping') return { ok: true, installed: true };

  return { ok: false, error: 'Unknown message.' };
}

/**
 * The one place the two engines genuinely disagree.
 *
 * Firefox takes an asynchronous reply as a promise returned from the listener
 * and ignores sendResponse. Chromium ignores a returned promise and needs
 * sendResponse plus a synchronous `true` to hold the channel open. Doing both
 * at once is not possible, so it branches.
 */
function handleMessage(message, sender, sendResponse) {
  const reply = respond(message, sender);
  if (IS_GECKO) return reply;
  void reply.then(sendResponse);
  return true;
}

/** Refresh every workspace that is connected, each into its own cache. */
async function refresh() {
  const ids = await connectedServices();
  await Promise.all(ids.map(async (id) => {
    try {
      const data = await fetchAll(id);
      await writeCache(id, data);
    } catch {
      // Offline, signed out, or token revoked. That workspace's cache keeps
      // whatever it had; the popup decides what to show about it.
    }
  }));
}
