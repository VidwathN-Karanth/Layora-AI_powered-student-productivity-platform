/**
 * The service worker does two jobs.
 *
 * 1. Receives the pairing token from the Layora website. The /extension page
 *    calls chrome.runtime.sendMessage with a token it minted for the signed-in
 *    student; `externally_connectable` in the manifest limits who may do that
 *    to the Layora origin, so no other site can hand us a token or read ours.
 * 2. Keeps the cache warm on a timer, so opening the popup draws instantly
 *    rather than waiting on a network round trip.
 */

import { LAYORA_ORIGIN, clearToken, fetchAll, setToken, writeCache } from './lib.js';

const REFRESH_ALARM = 'layora-refresh';

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(REFRESH_ALARM, { periodInMinutes: 15 });
  void refresh();
});

chrome.runtime.onStartup.addListener(() => {
  void refresh();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REFRESH_ALARM) void refresh();
});

/**
 * Messages from the Layora website.
 *
 * The sender's origin is checked again here even though the manifest already
 * restricts it — belt and braces, because this handler writes the credential
 * everything else depends on.
 */
chrome.runtime.onMessageExternal.addListener(handleMessage);

/**
 * The same messages, relayed by the content script on Layora's /extension page.
 *
 * An unpacked install has a random extension id, which the page cannot know, so
 * `externally_connectable` alone would leave Connect broken for anyone testing
 * before the Web Store listing exists. The sender's url is still checked.
 */
chrome.runtime.onMessage.addListener(handleMessage);

function handleMessage(message, sender, sendResponse) {
  const from = (sender && (sender.origin || sender.url)) || '';
  if (!from.startsWith(LAYORA_ORIGIN)) {
    sendResponse({ ok: false, error: 'Unrecognised origin.' });
    return false;
  }

  if (message && message.type === 'layora:connect' && typeof message.token === 'string') {
    (async () => {
      await setToken(message.token);
      try {
        const data = await fetchAll();
        await writeCache(data);
        sendResponse({ ok: true, name: data.me && data.me.name });
      } catch (error) {
        // The token stored but the first fetch failed — keep the token, let the
        // popup retry, and tell the page it is connected.
        sendResponse({ ok: true, warning: String(error.message || error) });
      }
    })();
    return true; // keep the channel open for the async reply
  }

  if (message && message.type === 'layora:disconnect') {
    (async () => {
      await clearToken();
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (message && message.type === 'layora:ping') {
    sendResponse({ ok: true, installed: true });
    return false;
  }

  sendResponse({ ok: false, error: 'Unknown message.' });
  return false;
}

async function refresh() {
  try {
    const data = await fetchAll();
    await writeCache(data);
  } catch {
    // Offline, signed out, or token revoked. The cache keeps whatever it had;
    // the popup decides what to show about it.
  }
}
