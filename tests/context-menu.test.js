const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const calls = { created: [], messages: [], injections: [], sentToBackend: [] };
let installedHandler, clickHandler, messageHandler;
let prefs = { language: 'hi', remoteAiConsent: false };
const chrome = {
  runtime: { id: 'extension-id', onInstalled: { addListener(fn) { installedHandler = fn; } }, onMessage: { addListener(fn) { messageHandler = fn; } } },
  contextMenus: { removeAll(done) { done(); }, create(item) { calls.created.push(item); }, onClicked: { addListener(fn) { clickHandler = fn; } } },
  storage: { local: { get: async defaults => ({ ...defaults, ...prefs }), remove: async keys => { calls.removedStorage = keys; } } },
  tabs: { sendMessage: async (tabId, message) => { calls.messages.push({ tabId, message }); return { ok: true }; } },
  scripting: { executeScript: async options => { calls.injections.push(options); } },
  permissions: { remove: async details => { calls.removedPermissions = details; } }
};
const StepPilotProviderClient = {
  explain: async payload => { calls.sentToBackend.push(payload); return { status: 'ready', engine: 'provider', summary: 'Actual backend response.', simpleExplanation: 'This explains the selected text.' }; },
  health: async () => ({ ok: true, providerConfigured: false })
};
vm.runInNewContext(fs.readFileSync(require.resolve('../background.js'), 'utf8'), {
  chrome, String, Promise, Map, AbortController, URL, globalThis: { StepPilotProviderClient }, importScripts() {}
});

(async () => {
  installedHandler();
  assert.equal(JSON.stringify(calls.created[0]), JSON.stringify({ id: 'steppilot-explain-selected-text', title: 'Explain selected text', contexts: ['selection'] }));
  assert.ok(calls.removedStorage.includes('providerConfig'));
  clickHandler({ menuItemId: 'steppilot-explain-selected-text', selectionText: '  print(1)  ' }, { id: 17 });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.messages[0].message.selectedText, '  print(1)  ');
  assert.equal(calls.messages[0].message.language, 'hi');

  const sendWorkerMessage = message => new Promise(resolve => messageHandler(message, { id: 'extension-id' }, resolve));
  const noConsent = await sendWorkerMessage({ type: 'STEPPILOT_AI_EXPLAIN', requestId: 'a', selectedText: 'private selected text' });
  assert.equal(noConsent.status, 'consent-required');
  assert.equal(calls.sentToBackend.length, 0, 'no selected text is sent before user consent');

  prefs = { remoteAiConsent: true };
  const response = await sendWorkerMessage({ type: 'STEPPILOT_AI_EXPLAIN', requestId: 'b', selectedText: 'selected only', nearbyContext: 'limited nearby text', language: 'en' });
  assert.equal(response.status, 'ready');
  assert.equal(calls.sentToBackend[0].selectedText, 'selected only');
  assert.equal(calls.sentToBackend[0].nearbyContext, 'limited nearby text');

  const sensitive = await sendWorkerMessage({ type: 'STEPPILOT_AI_EXPLAIN', requestId: 'c', selectedText: 'Card number 4111 1111 1111 1111', language: 'en' });
  assert.equal(sensitive.status, 'sensitive-selection');
  assert.equal(calls.sentToBackend.length, 1, 'sensitive selections are blocked before backend invocation');
  const health = await sendWorkerMessage({ type: 'STEPPILOT_BACKEND_HEALTH' });
  assert.deepEqual(JSON.parse(JSON.stringify(health)), { ok: true, providerConfigured: false });
  console.log('context-menu and consent routing tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
