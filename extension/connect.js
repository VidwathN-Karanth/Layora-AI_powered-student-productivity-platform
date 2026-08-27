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
 *
 * A content script cannot import, so the namespace is resolved inline here.
 * sendMessage is used in its promise form, which both engines support — the
 * callback form is Chromium-only and would be read as an options bag by
 * Firefox.
 *
 * Everything is wrapped in an IIFE because every content script listed for the
 * same document shares one scope: a bare `const` here would collide with an
 * identically named one in a sibling script, and a redeclaration aborts them
 * all — silently, with the page looking perfectly fine.
 */

(() => {
const ext = globalThis.browser ?? globalThis.chrome;

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.origin !== window.location.origin) return;

  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'layora:connect' && typeof data.token === 'string') {
    ext.runtime.sendMessage({ type: 'layora:connect', token: data.token })
      .then((reply) => {
        window.postMessage(
          {
            type: 'layora:connect:result',
            ok: Boolean(reply && reply.ok),
            error: (reply && reply.error) || null,
          },
          window.location.origin
        );
      })
      .catch((error) => {
        window.postMessage(
          {
            type: 'layora:connect:result',
            ok: false,
            error: String((error && error.message) || error),
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
})();
