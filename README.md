# StepPilot AI

StepPilot AI is a Manifest V3 Chrome extension for field-by-field form guidance and selected-text explanations. It includes a floating **Explain with StepPilot** action, a right-click **Explain selected text** command, Hindi/English language selection, optional browser voice, and a small form guidance panel.

Selected-text explanations use the included backend and a configured language model. The extension does not contain an AI model and does not fabricate an answer when the backend has no provider credentials. The backend is not deployed or configured by this repository.

## Project files

- `manifest.json` — MV3 permissions and service worker.
- `popup.html`, `popup.css`, `popup.js` — guidance language, local voice settings, and start/stop controls. The popup has no API keys, backend settings, remote provider options, consent controls, or backend status indicator.
- `content.js` — floating selection action, explanation panel, form guidance and voice controls.
- `background.js` — context menu and consent-gated selected-text routing.
- `backend-config.js` — fixed build/deployment backend URL; this is not user-configurable in the popup.
- `provider-client.js` — fixed-route API client and response validation.
- `runtime-messaging.js` — guarded content-script messaging for extension reload/update lifecycle failures.
- `backend/server.mjs` — local Node HTTP backend (`/health`, `/explain`).
- `backend/providers.mjs` — Gemini API adapter and structured response validation.
- `backend/server.test.mjs`, `tests/` — backend and extension module tests with mocks/fixtures.

## Backend and privacy

Selected-text explanations are routed through the fixed StepPilot backend. The extension sends explicitly selected text, language, up to 4,000 characters of nearby visible context when available, and (for Explain Further) the prior explanation and follow-up question. Do not select passwords, payment data, authentication secrets, or other sensitive information. No full-page scan or selected code execution occurs.

The health endpoint reports only whether credentials are configured; it does not disclose provider keys or model names. The extension UI does not expose provider/model configuration or backend health. There is no AI provider configured in this checkout, no API key, and no deployed backend.

## Local development setup

Requirements: Node.js 20 or newer and Chrome. The backend uses only Node built-in modules; no package installation or third-party backend dependencies are required.

1. In Chrome, open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and choose this project folder.
2. Copy the extension ID shown on its card. It will be used as an exact CORS origin, for example `chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef`.
3. In a terminal, from the project root:

   ```sh
   cd backend
   cp .env.example .env
   ```

4. Edit `backend/.env` locally. Set `EXTENSION_ORIGINS` to the exact extension origin from step 2. Add a provider key only on the backend host:

   ```dotenv
   EXTENSION_ORIGINS=chrome-extension://your_actual_extension_id
   GEMINI_API_KEY=your_gemini_key_here
   ```

   Keep `.env` private; it is ignored by Git. Never put the key in extension source, browser storage, or a deployed extension package. This backend uses Gemini only; it does not call or fall back to OpenAI or another paid provider. The optional server-side model override is `GEMINI_MODEL`.

5. Start the backend from the `backend` directory:

   ```sh
   npm start
   ```

   It binds only to `127.0.0.1:8787` by default. Check `http://127.0.0.1:8787/health`; with credentials configured it returns `{"ok":true,"providerConfigured":true}`. Without keys, health says `false`, and `/explain` returns a clear setup error instead of a template.

6. Development URL is fixed in `backend-config.js` as `http://127.0.0.1:8787`. The matching exact localhost host permission is in `manifest.json`. If you change the development port, update both. Do not add an arbitrary user-supplied endpoint.
7. Reload the extension at `chrome://extensions`, then refresh the webpage tab. Select a paragraph or error message and click the floating button or use right-click to request an explanation. Use **Explain Further** to send a follow-up about the same selection. The popup's language and optional voice controls remain available.

`npm install` is not needed: the package has no runtime dependencies. `npm test` runs the backend tests.

## Provider details

The Gemini adapter calls the official `models.generateContent` API using the `x-goog-api-key` header and JSON response mode. It defaults to `gemini-3.6-flash`, which Google's current model page lists as a stable model. Confirm current model availability before overriding it ([Gemini model docs](https://ai.google.dev/gemini-api/docs/models/gemini-3.6-flash), [GenerateContent API](https://ai.google.dev/api/generate-content)). Gemini free access, where available, has quotas, regional restrictions and data-use conditions; check current [pricing and terms](https://ai.google.dev/gemini-api/docs/pricing). The backend does not automatically switch to a different provider.

The prompt treats webpage selection/context as untrusted data. Requests are size-limited, response fields are schema-validated, provider errors are sanitized, and the backend applies a basic per-IP rate limit. This is a small self-hosted backend, not a complete public SaaS abuse-prevention system.

## Production deployment

No production backend URL is embedded in this repository and no deployment has been performed. Deploy the Node backend behind HTTPS and an authenticated gateway that identifies authorized users. Do not expose the backend as an unrestricted public proxy that spends your provider quota.

For a protected deployment, configure server environment values (`EXTENSION_ORIGINS`, provider key, rate limits) in the hosting platform's secret manager. If binding the app beyond loopback, set `PUBLIC_DEPLOYMENT_ACK=I_HAVE_AUTHENTICATED_THIS_BACKEND` and a random `BACKEND_PROXY_TOKEN` of at least 32 characters. The reverse proxy must authenticate the user, strip any incoming `X-StepPilot-Proxy-Auth`, and inject the backend token itself; do not ship that token to the extension. Restrict network access to the backend so it is reachable only through that proxy. The app refuses a public bind without this guard configuration, but the guard token alone is not user authentication.

For an extension release, set `BASE_URL` in `backend-config.js` to the fixed HTTPS origin and change `host_permissions` in `manifest.json` to that exact origin only. Set `INCLUDE_COOKIES: true` only if the authenticated gateway intentionally uses browser session cookies and has been configured for credentialed extension CORS; otherwise leave it false. Rebuild/review the extension package, publish or load it, and verify CORS, authentication, rate limits and user consent in the deployed environment. There is no production URL or provider configuration to provide from this project yet.

## Tests

Run backend tests from `backend/`:

```sh
npm test
```

Run extension module tests from the project root:

```sh
node tests/provider-client.test.js
node tests/selection-explainer.test.js
node tests/runtime-messaging.test.js
node tests/context-menu.test.js
node tests/guidance.test.js
node tests/field-label.test.js
node tests/voice-guide.test.js
```

Tests use mocked provider responses and local fixtures. They do not verify live provider inference, Chrome UI behavior, or a production deployment. A real provider-backed end-to-end test requires a valid server-side key and running backend.
