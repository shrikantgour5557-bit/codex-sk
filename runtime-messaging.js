// Defensive wrapper for extension runtime messaging from long-lived content
// scripts. A reload/update can invalidate the isolated world between events.
(function (root) {
  'use strict';

  function isContextInvalidated(error) {
    return /extension context invalidated/i.test(String(error?.message || error || ''));
  }

  // Reading runtime.id can itself throw after an extension reload, so keep the
  // probe inside a try/catch and still guard the actual send separately.
  function isAvailable(runtime) {
    try { return Boolean(runtime && runtime.id); }
    catch { return false; }
  }

  function send(runtime, message) {
    if (!isAvailable(runtime)) return Promise.resolve({ status: 'extension-context-invalidated' });
    try {
      return Promise.resolve(runtime.sendMessage(message)).catch(error => {
        if (isContextInvalidated(error) || !isAvailable(runtime)) {
          return { status: 'extension-context-invalidated' };
        }
        throw error;
      });
    } catch (error) {
      if (isContextInvalidated(error) || !isAvailable(runtime)) {
        return Promise.resolve({ status: 'extension-context-invalidated' });
      }
      return Promise.reject(error);
    }
  }

  root.StepPilotRuntimeMessaging = Object.freeze({ isAvailable, isContextInvalidated, send });
})(typeof globalThis !== 'undefined' ? globalThis : this);
