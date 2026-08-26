/**
 * The bridge between the Layora website and this extension.
 *
 * Runs only on Layora's /extension page. The page mints a pairing token for
 * whoever is signed in and posts it to its own window; this relays it to the
 * service worker, which stores it.
 *
 * Why a content script rather than `externally_connectable`: that route needs
 * the page to know the extension's ID, and an unpacked install gets a random
 * one. This way the connect button works the moment the folder is loaded, with
 * nothing to configure. The manifest keeps `externally_connectable` as well,
 * for a Web Store build where the ID is fixed.
 *
 * Only messages from this page's own window are accepted, so another frame
 * cannot inject a token or ask for ours.
 */

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.origin !== window.location.origin) return;

  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'layora:connect' && typeof data.token === 'string') {
    chrome.runtime.sendMessage({ type: 'layora:connect', token: data.token }, (reply) => {
      window.postMessage(
        {
          type: 'layora:connect:result',
          ok: Boolean(reply && reply.ok),
          error: (reply && reply.error) || (chrome.runtime.lastError && chrome.runtime.lastError.message) || null,
        },
        window.location.origin
      );
    });
  }

  if (data.type === 'layora:ping') {
    // Lets the page say "installed" or "not installed" without guessing.
    window.postMessage({ type: 'layora:pong', installed: true }, window.location.origin);
  }
});

// Announce on load too, so a page that renders after us still learns we exist.
window.postMessage({ type: 'layora:pong', installed: true }, window.location.origin);
