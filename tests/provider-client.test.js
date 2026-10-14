const assert = require('node:assert/strict');
const { explain, health, validateResult, baseUrl } = require('../provider-client.js');

const config = { BASE_URL: 'http://127.0.0.1:8787', INCLUDE_COOKIES: false };
assert.equal(baseUrl(config), 'http://127.0.0.1:8787');
assert.throws(() => baseUrl({ BASE_URL: 'http://remote.example' }), { code: 'invalid_backend_config' });
assert.throws(() => validateResult({ summary: '' }), { code: 'empty_response' });
assert.throws(() => validateResult({ output: 'not structured' }), { code: 'empty_response' });

(async () => {
  let call;
  const result = await explain({ selectedText: 'Explain RAG simply.', nearbyContext: 'A nearby heading', language: 'hi' }, {
    config,
    fetch: async (url, options) => {
      call = { url, options };
      return { ok: true, status: 200, json: async () => ({ explanation: { summary: 'Main point', simpleExplanation: 'RAG pehle relevant documents dhoondhta hai.', detailedExplanation: 'Then the model uses those sources to answer.', example: 'A support bot searches its help articles.', contentType: 'Technical concept', importantTerms: [{ term: 'retrieval', explanation: 'Finding relevant information.' }] } }) };
    }
  });
  assert.equal(call.url, 'http://127.0.0.1:8787/explain');
  assert.equal(call.options.credentials, 'omit');
  assert.equal(call.options.cache, 'no-store');
  const payload = JSON.parse(call.options.body);
  assert.equal(payload.selectedText, 'Explain RAG simply.');
  assert.equal(payload.nearbyContext, 'A nearby heading');
  assert.equal(payload.language, 'hi');
  assert.equal(result.status, 'ready');
  assert.equal(result.simpleExplanation, 'RAG pehle relevant documents dhoondhta hai.');
  assert.equal(result.importantTerms[0].term, 'retrieval');

  const follow = await explain({ selectedText: 'Original', followup: 'simpler please', previousExplanation: { simpleExplanation: 'Current answer' } }, {
    config: { ...config, INCLUDE_COOKIES: true },
    fetch: async (url, options) => { call = { url, options }; return { ok: true, json: async () => ({ explanation: { simpleExplanation: 'Simpler.' } }) }; }
  });
  assert.equal(call.options.credentials, 'include');
  assert.equal(JSON.parse(call.options.body).task, 'explain-further');
  assert.equal(JSON.parse(call.options.body).followupQuestion, 'simpler please');
  assert.equal(follow.simpleExplanation, 'Simpler.');

  const status = await health({ config, fetch: async () => ({ ok: true, json: async () => ({ ok: true, providerConfigured: true, providers: ['openai', 'gemini'] }) }) });
  assert.deepEqual(status, { ok: true, providerConfigured: true, providers: ['gemini'] });
  await assert.rejects(() => explain({ selectedText: '' }, { config }), { code: 'empty_selection' });
  await assert.rejects(() => explain({ selectedText: 'x' }, { config, fetch: async () => ({ ok: false, status: 503, json: async () => ({ error: 'provider_not_configured', message: 'Set key on server.' }) }) }), { code: 'provider_not_configured' });
  await assert.rejects(() => explain({ selectedText: 'x' }, { config, fetch: async () => ({ ok: true, json: async () => { throw new Error('bad json'); } }) }), { code: 'malformed_response' });
  await assert.rejects(() => explain({ selectedText: 'x' }, { config, fetch: async () => { throw new TypeError('network unavailable'); } }));
  await assert.rejects(() => explain({ selectedText: 'x' }, { config, timeoutMs: 5, fetch: (_, options) => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))) }), { code: 'backend_timeout' });
  console.log('backend client tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
