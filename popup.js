const startButton = document.querySelector('#start');
const stopButton = document.querySelector('#stop');
const languageSelect = document.querySelector('#language');
const statusBox = document.querySelector('#status');
const statusText = document.querySelector('#status-text');
const voiceToggle = document.querySelector('#voice-enabled');
const voiceSettings = document.querySelector('.voice-settings');
const voiceNote = document.querySelector('#voice-note');
const voiceSelectors = { hi: document.querySelector('#voice-hi'), en: document.querySelector('#voice-en') };
const rateInput = document.querySelector('#speech-rate');
const pitchInput = document.querySelector('#speech-pitch');
let voiceEnabled = false;
let voicePreferences = { voices: { hi: '', en: '' }, rate: 0.95, pitch: 1 };
let voiceGuide = null;

const messages = {
  en: { ready: 'Ready when you are', starting: 'Preparing your guide…', started: 'Guidance is active in this tab', stopped: 'Guidance stopped', noTab: 'Open a regular website to start guidance', unsupported: 'This Chrome page does not allow extensions', failed: 'Could not start guidance on this page' },
  hi: { ready: 'जब आप तैयार हों', starting: 'गाइड तैयार हो रही है…', started: 'इस टैब में मार्गदर्शन चालू है', stopped: 'मार्गदर्शन बंद है', noTab: 'मार्गदर्शन शुरू करने के लिए वेबसाइट खोलें', unsupported: 'इस Chrome पेज पर एक्सटेंशन काम नहीं करता', failed: 'इस पेज पर मार्गदर्शन शुरू नहीं हो सका' }
};
function uiLanguage() { return languageSelect.value === 'hi' ? 'hi' : 'en'; }
function showStatus(key, kind = '') { statusText.textContent = messages[uiLanguage()][key]; statusBox.className = `status ${kind}`.trim(); }
async function getTab() { const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); return tab; }
function isSupported(tab) { return Boolean(tab?.id && /^https?:/.test(tab.url || '')); }
async function send(tab, message) { try { return await chrome.tabs.sendMessage(tab.id, message); } catch { return null; } }
async function saveVoicePreferences() {
  voicePreferences = voiceGuide?.preferences || voicePreferences;
  try { await chrome.storage.local.set({ voicePreferences }); } catch { /* Keep current popup preference if extension reloads mid-change. */ }
  try { const tab = await getTab(); if (tab?.id) await send(tab, { type: 'STEPPILOT_VOICE_PREFERENCES', preferences: voicePreferences }); } catch { /* Tab may close or the extension may be reloaded. */ }
}
function refreshVoiceUI(update = {}) {
  if (update.preferences) voicePreferences = update.preferences;
  for (const lang of ['hi', 'en']) {
    const select = voiceSelectors[lang];
    if (!select) continue;
    const chosen = voicePreferences.voices[lang] || '';
    const matching = voiceGuide?.matchingVoices(lang) || [];
    select.innerHTML = `<option value="">${matching.length ? (lang === 'hi' ? 'उपलब्ध Hindi voice में से पसंदीदा' : 'Preferred available English voice') : (lang === 'hi' ? 'Hindi voice उपलब्ध नहीं' : 'English voice उपलब्ध नहीं')}</option>` +
      matching.map(voice => `<option value="${escapeHtml(voice.voiceURI)}">${escapeHtml(voice.name)} (${escapeHtml(voice.lang)})</option>`).join('');
    select.value = matching.some(voice => voice.voiceURI === chosen) ? chosen : '';
  }
  if (voiceGuide) {
    rateInput.value = String(voicePreferences.rate);
    pitchInput.value = String(voicePreferences.pitch);
  }
  document.querySelector('#rate-value').value = Number(rateInput.value).toFixed(2);
  document.querySelector('#pitch-value').value = Number(pitchInput.value).toFixed(2);
  const hindi = Boolean(voiceGuide?.matchingVoices('hi').length);
  const english = Boolean(voiceGuide?.matchingVoices('en').length);
  voiceNote.textContent = !voiceGuide
    ? 'Voice preview requires browser speech synthesis.'
    : !hindi && !english
      ? 'No Hindi or English system voice is available. Written guidance remains available.'
      : !hindi || !english
        ? `${!hindi ? 'Hindi' : 'English'} voice unavailable. Available voices are supplied by Chrome and your operating system.`
        : 'Voice quality and availability depend on Chrome and installed system voices.';
}
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]); }
function initSpeech() {
  if (!globalThis.StepPilotVoiceGuide || !window.speechSynthesis || !window.SpeechSynthesisUtterance) {
    voiceNote.textContent = 'This browser does not provide speech synthesis here. Written guidance remains available.';
    return;
  }
  voiceGuide = globalThis.StepPilotVoiceGuide.createVoiceGuide({
    synthesis: window.speechSynthesis, Utterance: window.SpeechSynthesisUtterance,
    language: 'en', preferences: voicePreferences,
    onChange: refreshVoiceUI,
    onPreferencesChange: saveVoicePreferences
  });
  voiceGuide.watch();
}

async function loadPreferences() {
  try {
    const result = await chrome.storage.local.get({ voiceEnabled: false, language: 'en', voicePreferences: { voices: { hi: '', en: '' }, rate: 0.95, pitch: 1 } });
    voiceEnabled = result.voiceEnabled === true;
    languageSelect.value = ['en','hi','hinglish','auto'].includes(result.language) ? result.language : 'en';
    voicePreferences = { ...voicePreferences, ...(result.voicePreferences || {}), voices: { ...voicePreferences.voices, ...(result.voicePreferences?.voices || {}) } };
  } catch { voiceEnabled = false; }
  voiceToggle.checked = voiceEnabled;
  voiceSettings.hidden = !voiceEnabled;
  initSpeech();
  voiceGuide?.setPreferences(voicePreferences);
  refreshVoiceUI();
}

voiceToggle.addEventListener('change', async () => {
  voiceEnabled = voiceToggle.checked;
  voiceSettings.hidden = !voiceEnabled;
  try { await chrome.storage.local.set({ voiceEnabled }); } catch { /* Current popup setting remains usable. */ }
  try { const tab = await getTab(); if (tab?.id) await send(tab, { type: 'STEPPILOT_VOICE_SETTING', enabled: voiceEnabled }); } catch { /* The guide may not be active yet. */ }
});
for (const lang of ['hi','en']) voiceSelectors[lang].addEventListener('change', () => {
  voiceGuide?.selectVoice(voiceSelectors[lang].value, lang);
});
rateInput.addEventListener('input', () => { voiceGuide?.setPreferences({ rate: Number(rateInput.value) }); });
pitchInput.addEventListener('input', () => { voiceGuide?.setPreferences({ pitch: Number(pitchInput.value) }); });
document.querySelector('#preview-voice').addEventListener('click', () => {
  const lang = document.querySelector('#preview-language').value === 'hi' ? 'hi' : 'en';
  const sample = lang === 'hi'
    ? 'नमस्ते। यह StepPilot की आवाज़ का नमूना है। मैं फ़ील्ड की जानकारी सरल तरीके से समझाऊँगा।'
    : 'Hello. This is a preview of StepPilot voice guidance. I will explain the field in clear, simple language.';
  if (!voiceGuide?.play(sample, lang)) voiceNote.textContent = `${lang === 'hi' ? 'Hindi' : 'English'} voice is unavailable in this browser.`;
});

startButton.addEventListener('click', async () => {
  showStatus('starting'); startButton.disabled = true;
  try {
    const tab = await getTab();
    if (!isSupported(tab)) { showStatus(tab?.id ? 'unsupported' : 'noTab', 'error'); return; }
    let response = await send(tab, { type: 'STEPPILOT_START', language: languageSelect.value, voiceEnabled, voicePreferences });
    if (!response) {
      try { await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['guidance.js', 'field-label.js', 'voice-guide.js', 'selection-utils.js', 'runtime-messaging.js', 'text-explainer.js', 'content.js'] }); }
      catch { showStatus('unsupported', 'error'); return; }
      response = await send(tab, { type: 'STEPPILOT_START', language: languageSelect.value, voiceEnabled, voicePreferences });
    }
    if (!response?.ok) { showStatus(response?.reason === 'unsupported' ? 'noTab' : 'failed', 'error'); return; }
    showStatus('started', 'active'); stopButton.disabled = false;
  } catch { showStatus('failed', 'error'); }
  finally { startButton.disabled = false; }
});
stopButton.addEventListener('click', async () => {
  let stopped = false;
  try { const tab = await getTab(); if (tab?.id) await send(tab, { type: 'STEPPILOT_STOP' }); stopped = true; }
  catch { showStatus('failed', 'error'); }
  finally { stopButton.disabled = true; if (stopped) showStatus('stopped'); }
});
languageSelect.addEventListener('change', async () => {
  try { await chrome.storage.local.set({ language: languageSelect.value }); } catch { /* Session preference remains active. */ }
  try { const tab = await getTab(); if (tab?.id) await send(tab, { type: 'STEPPILOT_LANGUAGE', language: languageSelect.value }); } catch { /* No active guide. */ }
  if (!statusBox.classList.contains('error') && !statusBox.classList.contains('active')) showStatus('ready');
});
window.addEventListener('pagehide', () => voiceGuide?.dispose(), { once: true });

loadPreferences();
chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
  if (!isSupported(tab)) showStatus(tab?.id ? 'unsupported' : 'noTab', 'error');
  else send(tab, { type: 'STEPPILOT_STATUS' }).then(response => { if (response?.active) { stopButton.disabled = false; showStatus('started', 'active'); } });
}).catch(() => showStatus('failed', 'error'));
