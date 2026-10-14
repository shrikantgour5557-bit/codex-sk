const assert = require('node:assert/strict');
const fs = require('node:fs');
require('../runtime-messaging.js');

const messaging = globalThis.StepPilotRuntimeMessaging;
assert.ok(messaging, 'runtime messaging helper is loaded');

async function run() {
  const goodRuntime = { id: 'extension-id', sendMessage: async message => ({ echoed: message.type }) };
  assert.deepEqual(await messaging.send(goodRuntime, { type: 'PING' }), { echoed: 'PING' });

  const invalidGetter = {};
  Object.defineProperty(invalidGetter, 'id', { get() { throw new Error('Extension context invalidated.'); } });
  assert.equal(messaging.isAvailable(invalidGetter), false);
  assert.deepEqual(await messaging.send(invalidGetter, {}), { status: 'extension-context-invalidated' });

  const synchronousInvalidation = { id: 'extension-id', sendMessage() { throw new Error('Extension context invalidated.'); } };
  assert.deepEqual(await messaging.send(synchronousInvalidation, {}), { status: 'extension-context-invalidated' });

  const asynchronousInvalidation = { id: 'extension-id', sendMessage: () => Promise.reject(new Error('Extension context invalidated.')) };
  assert.deepEqual(await messaging.send(asynchronousInvalidation, {}), { status: 'extension-context-invalidated' });

  const actualFailure = { id: 'extension-id', sendMessage: () => Promise.reject(new Error('receiver failed')) };
  await assert.rejects(messaging.send(actualFailure, {}), /receiver failed/);

  const contentSource = fs.readFileSync(require.resolve('../content.js'), 'utf8');
  const popupSource = fs.readFileSync(require.resolve('../popup.js'), 'utf8');
  const workerSource = fs.readFileSync(require.resolve('../background.js'), 'utf8');
  assert.match(contentSource, /handleRuntimeContextFailure\(error\)/);
  assert.match(contentSource, /if \(!handleRuntimeContextFailure\(error\)\) console\.warn/);
  assert.match(contentSource, /stopAfterContextInvalidation\(\)/);
  assert.match(contentSource, /Refresh this page, then select the text and explain it again/);
  assert.match(contentSource, /location\.href !== requestUrl/);
  assert.match(contentSource, /addEventListener\('pagehide', handlePageHide\)/);
  assert.match(contentSource, /runtimeMessaging\.isAvailable\(runtime\)/);
  assert.match(popupSource, /'runtime-messaging\.js'.*'text-explainer\.js'.*'content\.js'/);
  assert.match(workerSource, /'runtime-messaging\.js'.*'text-explainer\.js'.*'content\.js'/);
  console.log('runtime messaging lifecycle checks passed');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
