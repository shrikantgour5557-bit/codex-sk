/* Shared, browser-native speech engine. No audio or page data leaves the browser. */
(() => {
  const DEFAULTS = { voices: { hi: '', en: '' }, rate: 0.95, pitch: 1 };
  const clamp = (value, min, max, fallback) => Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : fallback));
  const cleanForSpeech = value => String(value || '')
    .replace(/<[^>]*>/g, ' ').replace(/```[\s\S]*?```/g, ' code example omitted ')
    .replace(/`([^`]*)`/g, '$1').replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/^\s{0,3}#{1,6}\s*/gm, '')
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, '').replace(/[*_~>#|]/g, ' ')
    .replace(/\s+/g, ' ').trim();

  function prepareSpokenExplanation(explanation, context = {}, language = 'en') {
    const lang = language === 'hi' ? 'hi' : 'en';
    if (!explanation || context.sensitive || context.isSensitive) return '';
    const parts = [];
    if (context.type === 'field') {
      const guide = explanation;
      // Explain the interpreted field rather than reading its label or page value.
      if (guide.meaning) parts.push(guide.meaning);
      if (guide.what) parts.push(guide.what);
      if (guide.why) parts.push(guide.why);
      if (guide.example) parts.push(lang === 'hi' ? `केवल उदाहरण: ${guide.example}` : `For example only: ${guide.example}`);
      if (guide.format) parts.push(guide.format);
      if (guide.requirement) parts.push(guide.requirement);
      if (guide.warning) parts.push(guide.warning);
    } else {
      // Never speak the selected source verbatim. Speak only interpreted output;
      // source snippets and code are intentionally excluded.
      for (const key of ['summary', 'simpleExplanation', 'answer', 'codeExplanation', 'likelyCause']) {
        if (explanation[key]) parts.push(explanation[key]);
      }
      if (Array.isArray(explanation.steps)) parts.push(...explanation.steps.slice(0, 8));
      if (explanation.example) parts.push(explanation.example);
      if (Array.isArray(explanation.suggestions)) parts.push(...explanation.suggestions);
      if (explanation.status === 'uncertain' && explanation.message) parts.push(explanation.message);
    }
    const spoken = [...new Set(parts.map(cleanForSpeech).filter(Boolean))].join(' ');
    if (!spoken) return '';
    // Pronounce common abbreviations naturally without altering displayed copy.
    const substitutions = lang === 'hi'
      ? [[/\bDOB\b/gi, 'जन्म तिथि'], [/\bURL\b/gi, 'वेब पता'], [/\bMr\.?\b/gi, 'मिस्टर'], [/\bMs\.?\b/gi, 'मिस'], [/\bDr\.?\b/gi, 'डॉक्टर']]
      : [[/\bDOB\b/gi, 'date of birth'], [/\bURL\b/gi, 'web address'], [/\bMr\.?\b/gi, 'Mister'], [/\bMs\.?\b/gi, 'Miz'], [/\bDr\.?\b/gi, 'Doctor']];
    return substitutions.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), spoken)
      .replace(/https?:\/\/\S+/gi, lang === 'hi' ? 'दिखाया गया वेब पता' : 'the displayed web address')
      .replace(/\b(?:\d[ -]?){12,19}\b/g, '')
      .replace(/\b(?:password|passcode|CVV|CVC|security code|one[- ]time code)\b[^.!?]*/gi, '')
      .replace(/\s+([,.!?])/g, '$1').replace(/\s+/g, ' ').trim();
  }

  function createVoiceGuide(options = {}) {
    const synthesis = options.synthesis;
    const Utterance = options.Utterance;
    const onChange = typeof options.onChange === 'function' ? options.onChange : () => {};
    const onPreferencesChange = typeof options.onPreferencesChange === 'function' ? options.onPreferencesChange : () => {};
    let language = options.language === 'hi' ? 'hi' : 'en';
    let preferences = { ...DEFAULTS, ...(options.preferences || {}) };
    preferences.voices = { ...DEFAULTS.voices, ...(options.preferences?.voices || {}) };
    preferences.rate = clamp(preferences.rate, 0.75, 1.15, DEFAULTS.rate);
    preferences.pitch = clamp(preferences.pitch, 0.8, 1.2, DEFAULTS.pitch);
    let voices = [], state = 'ready', currentText = '', lastText = '', currentUtterance = null, watching = false;
    let voiceChangeHandler = null;

    function matchingVoices(forLanguage = language) {
      const prefix = forLanguage === 'hi' ? 'hi' : 'en';
      return voices.filter(voice => new RegExp(`^${prefix}(?:-|$)`, 'i').test(voice.lang || ''));
    }
    function emit(next = state) {
      state = next;
      onChange({ state, voices: matchingVoices(), allVoices: voices.slice(), selectedUri: preferences.voices[language] || '', preferences: { ...preferences, voices: { ...preferences.voices } } });
    }
    function refreshVoices() {
      if (!synthesis || typeof synthesis.getVoices !== 'function' || typeof Utterance !== 'function') { emit('unavailable'); return []; }
      try { voices = synthesis.getVoices() || []; } catch { voices = []; }
      emit(matchingVoices().length ? (state === 'unavailable' ? 'ready' : state) : 'unavailable');
      return matchingVoices();
    }
    function preferredVoice(forLanguage = language) {
      const matching = matchingVoices(forLanguage);
      const chosen = preferences.voices[forLanguage];
      if (chosen) {
        const selected = matching.find(voice => voice.voiceURI === chosen);
        if (selected) return selected;
      }
      const locale = forLanguage === 'hi' ? 'hi-IN' : 'en-IN';
      return matching.find(voice => (voice.lang || '').toLowerCase() === locale.toLowerCase()) ||
        matching.find(voice => forLanguage === 'en' && /^(en-US|en-GB)$/i.test(voice.lang || '')) || matching[0] || null;
    }
    function stop() {
      // Clear identity before cancel: some engines dispatch onend asynchronously.
      currentUtterance = null; currentText = ''; lastText = '';
      try { synthesis?.cancel?.(); } catch { /* Text guidance remains available. */ }
      emit(preferredVoice() ? 'ready' : 'unavailable');
      return true;
    }
    function play(text, forLanguage = language) {
      const prepared = cleanForSpeech(text);
      const lang = forLanguage === 'hi' ? 'hi' : 'en';
      if (!prepared) return false;
      const voice = preferredVoice(lang);
      if (!synthesis || typeof synthesis.speak !== 'function' || typeof Utterance !== 'function' || !voice) { emit('unavailable'); return false; }
      try {
        const utterance = new Utterance(prepared);
        utterance.voice = voice;
        utterance.lang = voice.lang || (lang === 'hi' ? 'hi-IN' : 'en-IN');
        utterance.rate = preferences.rate;
        utterance.pitch = preferences.pitch;
        utterance.volume = 1;
        utterance.onstart = () => { if (currentUtterance === utterance) emit('speaking'); };
        utterance.onpause = () => { if (currentUtterance === utterance) emit('paused'); };
        utterance.onresume = () => { if (currentUtterance === utterance) emit('speaking'); };
        utterance.onend = () => { if (currentUtterance === utterance) { currentUtterance = null; currentText = ''; emit('ready'); } };
        utterance.onerror = () => { if (currentUtterance === utterance) { currentUtterance = null; currentText = ''; emit('error'); } };
        currentUtterance = utterance; currentText = prepared; lastText = prepared;
        synthesis.cancel();
        synthesis.speak(utterance);
        emit('speaking');
        return true;
      } catch {
        currentUtterance = null; currentText = ''; lastText = ''; emit('error'); return false;
      }
    }
    function pause() { if (state !== 'speaking') return false; try { synthesis.pause(); emit('paused'); return true; } catch { emit('error'); return false; } }
    function resume() { if (state !== 'paused') return false; try { synthesis.resume(); emit('speaking'); return true; } catch { emit('error'); return false; } }
    function repeat() { return lastText ? play(lastText, language) : false; }
    function setLanguage(next) { const nextLanguage = next === 'hi' ? 'hi' : 'en'; if (nextLanguage !== language) stop(); language = nextLanguage; emit(preferredVoice() ? 'ready' : 'unavailable'); }
    function selectVoice(uri, forLanguage = language) {
      if (uri && !matchingVoices(forLanguage).some(voice => voice.voiceURI === uri)) return false;
      stop();
      preferences.voices[forLanguage] = uri || '';
      onPreferencesChange({ ...preferences, voices: { ...preferences.voices } });
      emit(); return true;
    }
    function setPreferences(next = {}) {
      preferences = { ...preferences, ...next, voices: { ...preferences.voices, ...(next.voices || {}) } };
      preferences.rate = clamp(preferences.rate, 0.75, 1.15, DEFAULTS.rate);
      preferences.pitch = clamp(preferences.pitch, 0.8, 1.2, DEFAULTS.pitch);
      onPreferencesChange({ ...preferences, voices: { ...preferences.voices } }); emit();
    }
    function watch() {
      if (watching) return;
      if (!synthesis) { refreshVoices(); return; }
      voiceChangeHandler = refreshVoices;
      if (typeof synthesis.addEventListener === 'function') synthesis.addEventListener('voiceschanged', voiceChangeHandler);
      else synthesis.onvoiceschanged = voiceChangeHandler;
      watching = true; refreshVoices();
    }
    function dispose() {
      stop();
      if (watching && typeof synthesis?.removeEventListener === 'function') synthesis.removeEventListener('voiceschanged', voiceChangeHandler);
      else if (watching && synthesis?.onvoiceschanged === voiceChangeHandler) synthesis.onvoiceschanged = null;
      watching = false; voiceChangeHandler = null;
    }
    return { play, pause, resume, repeat, stop, setLanguage, setPreferences, selectVoice, refreshVoices, watch, dispose, matchingVoices, preferredVoice, get allVoices() { return voices.slice(); }, get preferences() { return { ...preferences, voices: { ...preferences.voices } }; }, get state() { return state; } };
  }
  const api = { createVoiceGuide, prepareSpokenExplanation, cleanForSpeech };
  globalThis.StepPilotVoiceGuide = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
