/* Fixed build-time backend target. Never place provider credentials here.
 * For production builds, set BASE_URL to the deployed HTTPS origin and replace
 * the matching exact entry in manifest.json host_permissions.
 */
globalThis.StepPilotBackendConfig = Object.freeze({
  BASE_URL: 'http://127.0.0.1:8787',
  INCLUDE_COOKIES: false
});
