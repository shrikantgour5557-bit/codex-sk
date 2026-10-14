/* Fixed-target client for StepPilot's own backend. No endpoint or provider data
 * is read from popup fields or browser storage.
 */
(function (root) {
  'use strict';
  const MAX_TEXT = 20000;
  function baseUrl(config = root.StepPilotBackendConfig) {
    const url = new URL(config?.BASE_URL || '');
    const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
    if ((!local && url.protocol !== 'https:') || (local && !['http:', 'https:'].includes(url.protocol)) || url.username || url.password || url.search || url.hash) {
      throw Object.assign(new Error('invalid_backend_config'), { code: 'invalid_backend_config' });
    }
    return url.origin;
  }
  function validateResult(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Object.assign(new Error('malformed_response'), { code: 'malformed_response' });
    const result = value.explanation && typeof value.explanation === 'object' ? value.explanation : value;
    const allowed = ['summary','simpleExplanation','detailedExplanation','example','contentType','errorType','likelyCause','uncertainty','location','locationNote','codeExplanation','codeSnippet','fixExample','whyFixWorks','practicalApplication','confidenceReason','answer'];
    const normalized = { status: 'ready', engine: 'provider' };
    for (const key of allowed) if (typeof result[key] === 'string') normalized[key] = result[key].slice(0, 12000);
    for (const key of ['suggestions','steps']) if (Array.isArray(result[key])) normalized[key] = result[key].filter(item => typeof item === 'string').slice(0, 12).map(item => item.slice(0, 1500));
    if (Array.isArray(result.importantTerms)) normalized.importantTerms = result.importantTerms.filter(item => item && typeof item.term === 'string' && typeof item.explanation === 'string').slice(0, 12).map(item => ({ term: item.term.slice(0, 200), explanation: item.explanation.slice(0, 1500) }));
    if (!normalized.summary && !normalized.simpleExplanation && !normalized.detailedExplanation && !normalized.errorType && !normalized.codeExplanation && !normalized.answer) throw Object.assign(new Error('empty_response'), { code: 'empty_response' });
    return normalized;
  }
  async function request(path, payload, options = {}) {
    const config = options.config || root.StepPilotBackendConfig;
    const origin = baseUrl(config);
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (options.signal) {
      if (options.signal.aborted) controller.abort();
      else options.signal.addEventListener('abort', abort, { once: true });
    }
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 45000);
    try {
      const response = await (options.fetch || fetch)(`${origin}${path}`, {
        method: payload ? 'POST' : 'GET', credentials: config?.INCLUDE_COOKIES ? 'include' : 'omit',
        cache: 'no-store', signal: controller.signal,
        headers: payload ? { 'Content-Type': 'application/json', 'Accept': 'application/json' } : { 'Accept': 'application/json' },
        ...(payload ? { body: JSON.stringify(payload) } : {})
      });
      let body;
      try { body = await response.json(); } catch { throw Object.assign(new Error('malformed_response'), { code: 'malformed_response' }); }
      if (!response.ok) throw Object.assign(new Error(body?.error || 'backend_error'), { code: body?.error || 'backend_error', status: response.status, message: body?.message || 'The StepPilot backend could not complete the request.' });
      return body;
    } catch (error) {
      if (error?.name === 'AbortError') throw Object.assign(new Error('backend_timeout'), { code: 'backend_timeout' });
      throw error;
    } finally { clearTimeout(timeout); options.signal?.removeEventListener('abort', abort); }
  }
  async function explain(payload, options = {}) {
    if (typeof payload?.selectedText !== 'string' || !payload.selectedText.trim()) throw Object.assign(new Error('empty_selection'), { code: 'empty_selection' });
    if (payload.selectedText.length > MAX_TEXT) throw Object.assign(new Error('selection_too_long'), { code: 'selection_too_long' });
    const body = {
      task: payload.followup ? 'explain-further' : 'explain-selected-text',
      selectedText: payload.selectedText,
      nearbyContext: typeof payload.nearbyContext === 'string' ? payload.nearbyContext.slice(0, 4000) : '',
      language: ['hi','en','auto'].includes(payload.language) ? payload.language : 'auto',
      followupQuestion: typeof payload.followup === 'string' ? payload.followup.slice(0, 1000) : '',
      previousExplanation: payload.previousExplanation && typeof payload.previousExplanation === 'object' ? payload.previousExplanation : undefined
    };
    return validateResult(await request('/explain', body, options));
  }
  async function health(options = {}) {
    const body = await request('/health', null, options);
    if (body?.ok !== true || typeof body.providerConfigured !== 'boolean') throw Object.assign(new Error('malformed_response'), { code: 'malformed_response' });
    return { ok: true, providerConfigured: body.providerConfigured, providers: Array.isArray(body.providers) ? body.providers.filter(x => x === 'gemini') : [] };
  }
  const api = { explain, health, baseUrl, validateResult };
  root.StepPilotProviderClient = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
