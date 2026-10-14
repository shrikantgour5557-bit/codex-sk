import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { explainWithProvider, ProviderError, providerStatus } from './providers.mjs';

const BODY_LIMIT = 32 * 1024;
const MAX_TEXT = 20000;
const MAX_CONTEXT = 4000;
const RATE_WINDOW_MS = 60_000;

function parseOrigins(value = '') { return new Set(value.split(',').map(x => x.trim()).filter(Boolean)); }
function json(res, status, body, cors = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...cors });
  res.end(JSON.stringify(body));
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0; let tooLarge = false;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > BODY_LIMIT) { tooLarge = true; chunks.length = 0; return; }
      if (!tooLarge) chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooLarge) { reject(new ProviderError('request_too_large', 413)); return; }
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new ProviderError('invalid_json', 400)); }
    });
    req.on('error', () => reject(new ProviderError('request_read_failed', 400)));
  });
}
function validateRequest(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ProviderError('invalid_request', 400);
  if (typeof data.selectedText !== 'string' || !data.selectedText.trim()) throw new ProviderError('empty_selection', 400);
  if (data.selectedText.length > MAX_TEXT) throw new ProviderError('selection_too_long', 413);
  if (data.nearbyContext !== undefined && typeof data.nearbyContext !== 'string') throw new ProviderError('invalid_context', 400);
  if (data.followupQuestion !== undefined && typeof data.followupQuestion !== 'string') throw new ProviderError('invalid_followup', 400);
  const language = ['en', 'hi', 'auto'].includes(data.language) ? data.language : 'auto';
  const previous = data.previousExplanation && typeof data.previousExplanation === 'object' && !Array.isArray(data.previousExplanation)
    ? JSON.stringify(data.previousExplanation).slice(0, 10000) : '';
  return {
    task: data.task === 'explain-further' ? 'explain-further' : 'explain-selected-text',
    selectedText: data.selectedText,
    nearbyContext: (data.nearbyContext || '').slice(0, MAX_CONTEXT),
    language,
    followupQuestion: (data.followupQuestion || '').slice(0, 1000),
    previousExplanation: previous
  };
}

export function createStepPilotServer(options = {}) {
  const env = options.env || process.env;
  const origins = options.allowedOrigins || parseOrigins(env.EXTENSION_ORIGINS);
  const publicGuardEnabled = env.PUBLIC_DEPLOYMENT_ACK === 'I_HAVE_AUTHENTICATED_THIS_BACKEND';
  const proxyToken = env.BACKEND_PROXY_TOKEN || '';
  if (publicGuardEnabled && proxyToken.length < 32) throw new Error('BACKEND_PROXY_TOKEN must be at least 32 characters when public deployment is enabled.');
  const rateLimit = new Map();
  const limit = Math.max(1, Math.min(120, Number(env.RATE_LIMIT_MAX) || 20));
  const fetchImpl = options.fetch || fetch;
  const provider = options.explain || ((input) => explainWithProvider(input, { env, fetch: fetchImpl }));

  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin || '';
    const allowed = origins.has(origin);
    const cors = allowed ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', Vary: 'Origin' } : {};
    if (publicGuardEnabled && !safeTokenEqual(req.headers['x-steppilot-proxy-auth'], proxyToken)) return json(res, 401, { error: 'authentication_required' }, cors);
    if (req.method === 'OPTIONS') {
      if (!allowed) return json(res, 403, { error: 'origin_not_allowed' });
      res.writeHead(204, { ...cors, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' });
      return res.end();
    }
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/health' && req.method === 'GET') {
      if (origin && !allowed) return json(res, 403, { error: 'origin_not_allowed' });
      return json(res, 200, { ok: true, providerConfigured: providerStatus(env).configured }, cors);
    }
    if (url.pathname !== '/explain') return json(res, 404, { error: 'not_found' }, cors);
    if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' }, cors);
    if (!allowed) return json(res, 403, { error: 'origin_not_allowed' });
    if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) return json(res, 415, { error: 'json_required' }, cors);

    const clientIp = req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const bucket = rateLimit.get(clientIp) || { start: now, count: 0 };
    if (now - bucket.start >= RATE_WINDOW_MS) { bucket.start = now; bucket.count = 0; }
    bucket.count++;
    rateLimit.set(clientIp, bucket);
    if (bucket.count > limit) return json(res, 429, { error: 'rate_limited', message: 'Too many explanation requests; retry after a short wait.' }, cors);
    if (rateLimit.size > 5000) for (const [ip, item] of rateLimit) if (now - item.start >= RATE_WINDOW_MS) rateLimit.delete(ip);

    try {
      const input = validateRequest(await readJson(req));
      const result = await provider(input);
      return json(res, 200, { explanation: result.explanation || result }, cors);
    } catch (error) {
      const code = error instanceof ProviderError ? error.code : 'backend_error';
      const status = error instanceof ProviderError ? error.status : 502;
      // Never return provider response bodies, request URLs, or secret material.
      const safeStatus = ['provider_not_configured','provider_authentication_failed','provider_model_not_found','provider_rate_limited','provider_timeout','provider_unavailable','invalid_provider_response','provider_request_rejected','invalid_json','empty_selection','selection_too_long','invalid_context','invalid_followup','invalid_request','request_too_large','request_read_failed'].includes(code) ? code : 'backend_error';
      return json(res, status, { error: safeStatus, message: safeMessage(safeStatus) }, cors);
    }
  });
  return server;
}

function safeMessage(code) {
  return ({
    provider_not_configured: 'No model provider is configured on the StepPilot backend.',
    provider_authentication_failed: 'Gemini rejected the configured key or its restrictions. Check that GEMINI_API_KEY is valid, active, and allowed to use the Gemini API.',
    provider_model_not_found: 'Gemini could not find the configured model. Check GEMINI_MODEL against currently available models.',
    provider_rate_limited: 'Gemini rate-limited this request or its quota is exhausted. Check current quota and free-tier limits before retrying.',
    provider_timeout: 'The model provider timed out. Retry with a shorter selection.',
    provider_unavailable: 'The model provider could not be reached.',
    invalid_provider_response: 'The model provider returned an invalid explanation response.',
    provider_request_rejected: 'Gemini rejected the request. Check the configured model and backend request format.',
    invalid_json: 'Request body must be valid JSON.', empty_selection: 'Select non-empty text to explain.',
    selection_too_long: 'Selection exceeds the supported length.', invalid_context: 'Context must be text.',
    invalid_followup: 'Follow-up must be text.', invalid_request: 'Request has an unsupported shape.',
    request_too_large: 'Request body is too large.', request_read_failed: 'Could not read the request.'
  })[code] || 'The backend could not complete this request.';
}

export function listen(server = createStepPilotServer(), options = {}) {
  const host = options.host || process.env.HOST || '127.0.0.1';
  if (!['127.0.0.1', '::1', 'localhost'].includes(host) && (process.env.PUBLIC_DEPLOYMENT_ACK !== 'I_HAVE_AUTHENTICATED_THIS_BACKEND' || !process.env.BACKEND_PROXY_TOKEN || process.env.BACKEND_PROXY_TOKEN.length < 32)) {
    throw new Error('Refusing public bind: place the service behind an authenticated proxy, configure a 32+ character BACKEND_PROXY_TOKEN, then acknowledge protected deployment.');
  }
  const port = Number(options.port || process.env.PORT || 8787);
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => { server.removeListener('error', reject); resolve(server); });
  });
}

function safeTokenEqual(provided, expected) {
  if (typeof provided !== 'string' || !expected) return false;
  const left = Buffer.from(provided); const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  listen().then(server => console.log(`StepPilot backend listening on http://${server.address().address}:${server.address().port}`))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}

export { BODY_LIMIT, MAX_TEXT, MAX_CONTEXT, validateRequest };
