import test from 'node:test';
import assert from 'node:assert/strict';
import { createStepPilotServer, validateRequest } from './server.mjs';
import { explainWithProvider, providerStatus } from './providers.mjs';

const ORIGIN = 'chrome-extension://steppilottest';
const explanation = { summary: 'Main point', simpleExplanation: 'The selected text means this.', detailedExplanation: 'A more complete explanation.', example: 'A fictional example.', contentType: 'Ordinary text', errorType: '', likelyCause: '', uncertainty: '', location: '', locationNote: '', codeExplanation: '', codeSnippet: '', fixExample: '', whyFixWorks: '', practicalApplication: '', confidenceReason: '', answer: '', steps: [], suggestions: [], importantTerms: [] };
async function withServer(t, options) {
  const server = createStepPilotServer(options);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test('request validation caps selection/context and rejects wrong types', () => {
  const valid = validateRequest({ selectedText: 'hello', language: 'hi', nearbyContext: 'x'.repeat(5000), followupQuestion: 'y'.repeat(1200) });
  assert.equal(valid.nearbyContext.length, 4000);
  assert.equal(valid.followupQuestion.length, 1000);
  assert.equal(valid.language, 'hi');
  assert.throws(() => validateRequest({ selectedText: 123 }), { code: 'empty_selection' });
  assert.throws(() => validateRequest({ selectedText: 'x'.repeat(20001) }), { code: 'selection_too_long' });
  assert.throws(() => validateRequest({ selectedText: 'ok', nearbyContext: {} }), { code: 'invalid_context' });
});

test('health exposes configuration state only and explain returns structured result', async t => {
  let received;
  const base = await withServer(t, {
    env: { GEMINI_API_KEY: 'server-secret-not-returned' }, allowedOrigins: new Set([ORIGIN]),
    explain: async input => { received = input; return { explanation, provider: 'gemini', model: 'private-model-name' }; }
  });
  const health = await fetch(`${base}/health`, { headers: { Origin: ORIGIN } });
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true, providerConfigured: true });
  const response = await fetch(`${base}/explain`, {
    method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ selectedText: 'नमस्ते — explain this 🌱', language: 'hi', nearbyContext: 'Nearby question only' })
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body, { explanation });
  assert.equal(received.selectedText, 'नमस्ते — explain this 🌱');
  assert.equal(received.nearbyContext, 'Nearby question only');
  assert.equal(JSON.stringify(body).includes('server-secret-not-returned'), false);
  assert.equal(JSON.stringify(body).includes('private-model-name'), false);
});

test('missing model credentials produce an explicit setup error, never a template', async t => {
  const env = {};
  assert.deepEqual(providerStatus(env), { configured: false, providers: [] });
  const base = await withServer(t, { env, allowedOrigins: new Set([ORIGIN]) });
  const response = await fetch(`${base}/explain`, {
    method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify({ selectedText: 'Explain this' })
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'provider_not_configured');
});

test('invalid requests, rejected origins, and rate limits are handled', async t => {
  const base = await withServer(t, { env: { RATE_LIMIT_MAX: '2' }, allowedOrigins: new Set([ORIGIN]), explain: async () => ({ explanation }) });
  const invalid = await fetch(`${base}/explain`, { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify({ selectedText: 3 }) });
  assert.equal(invalid.status, 400);
  const oversized = await fetch(`${base}/explain`, { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify({ selectedText: 'x', extra: 'z'.repeat(34000) }) });
  assert.equal(oversized.status, 413);
  const blocked = await fetch(`${base}/explain`, { method: 'POST', headers: { Origin: 'https://bad.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ selectedText: 'x' }) });
  assert.equal(blocked.status, 403);
  for (let i = 0; i < 2; i++) await fetch(`${base}/explain`, { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify({ selectedText: 'x' }) });
  const limited = await fetch(`${base}/explain`, { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify({ selectedText: 'x' }) });
  assert.equal(limited.status, 429);
});

test('Gemini generateContent is the only provider used and parses structured JSON', async () => {
  const calls = [];
  const result = await explainWithProvider({ selectedText: 'Explain the code', language: 'en' }, {
    // An OpenAI key must never trigger paid-provider use or fallback.
    env: { OPENAI_API_KEY: 'must-not-be-used', GEMINI_API_KEY: 'gemini-server-secret' },
    fetch: async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(explanation) }] } }] }) };
    }
  });
  assert.match(calls[0].url, /models\/gemini-3\.6-flash:generateContent$/);
  assert.equal(calls[0].init.headers['x-goog-api-key'], 'gemini-server-secret');
  assert.doesNotMatch(calls[0].url, /openai/);
  assert.equal(JSON.parse(calls[0].init.body).generationConfig.responseMimeType, 'application/json');
  assert.equal(result.explanation.simpleExplanation, explanation.simpleExplanation);
  assert.equal(calls.length, 1);
  assert.equal(providerStatus({ OPENAI_API_KEY: 'paid-provider-key' }).configured, false);
});

test('provider failure and timeout are normalized without leaking response details', async () => {
  await assert.rejects(() => explainWithProvider({ selectedText: 'x' }, {
    env: { GEMINI_API_KEY: 'key' }, fetch: async () => ({ ok: false, status: 429, json: async () => ({ error: { message: 'private provider detail' } }) })
  }), { code: 'provider_rate_limited', status: 429 });
  await assert.rejects(() => explainWithProvider({ selectedText: 'x' }, {
    env: { GEMINI_API_KEY: 'invalid' }, fetch: async () => ({ ok: false, status: 400, json: async () => ({ error: { status: 'INVALID_ARGUMENT', message: 'API key not valid. private provider details' } }) })
  }), { code: 'provider_authentication_failed' });
  await assert.rejects(() => explainWithProvider({ selectedText: 'x' }, {
    env: { GEMINI_API_KEY: 'key', GEMINI_MODEL: 'missing-model' }, fetch: async () => ({ ok: false, status: 404, json: async () => ({ error: { message: 'private model detail' } }) })
  }), { code: 'provider_model_not_found' });
  await assert.rejects(() => explainWithProvider({ selectedText: 'x' }, {
    env: { GEMINI_API_KEY: 'key', PROVIDER_TIMEOUT_MS: '5' },
    fetch: (_, init) => new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))))
  }), { code: 'provider_timeout', status: 504 });
});

test('a configured proxy token is required in public deployment mode', async t => {
  const env = { PUBLIC_DEPLOYMENT_ACK: 'I_HAVE_AUTHENTICATED_THIS_BACKEND', BACKEND_PROXY_TOKEN: '01234567890123456789012345678901' };
  const base = await withServer(t, { env, allowedOrigins: new Set([ORIGIN]), explain: async () => ({ explanation }) });
  const denied = await fetch(`${base}/health`, { headers: { Origin: ORIGIN } });
  assert.equal(denied.status, 401);
  const accepted = await fetch(`${base}/health`, { headers: { Origin: ORIGIN, 'X-StepPilot-Proxy-Auth': env.BACKEND_PROXY_TOKEN } });
  assert.equal(accepted.status, 200);
});
