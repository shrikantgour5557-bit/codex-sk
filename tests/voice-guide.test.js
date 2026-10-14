const assert = require('node:assert/strict');
const { createVoiceGuide, prepareSpokenExplanation, cleanForSpeech } = require('../voice-guide.js');

class FakeUtterance { constructor(text) { this.text = text; } }
class FakeSynthesis {
  constructor(voices = []) { this.voices = voices; this.listeners = new Set(); this.spoken = []; this.cancelCount = 0; }
  getVoices() { return this.voices; }
  addEventListener(name, fn) { if (name === 'voiceschanged') this.listeners.add(fn); }
  removeEventListener(name, fn) { if (name === 'voiceschanged') this.listeners.delete(fn); }
  speak(utterance) { this.spoken.push(utterance); }
  cancel() { this.cancelCount++; }
  pause() {}
  resume() {}
  load(voices) { this.voices = voices; for (const fn of this.listeners) fn(); }
}
const hi = { name: 'Hindi', lang: 'hi-IN', voiceURI: 'hi' };
const enIn = { name: 'English India', lang: 'en-IN', voiceURI: 'en-in' };
const enUs = { name: 'English US', lang: 'en-US', voiceURI: 'en-us' };
const french = { name: 'French', lang: 'fr-FR', voiceURI: 'fr' };
function create(synthesis, language = 'en', callback) { return createVoiceGuide({ synthesis, Utterance: FakeUtterance, language, onChange: callback }); }

// Watching and enabling voice controls must never start speech by itself.
{
  const synth = new FakeSynthesis([hi, enIn]); const guide = create(synth); guide.watch();
  assert.equal(synth.spoken.length, 0); assert.equal(guide.preferredVoice().voiceURI, 'en-in');
  assert.equal(guide.play('Enter a fictional example.'), true); assert.equal(synth.spoken.length, 1);
  assert.equal(synth.spoken[0].text, 'Enter a fictional example.'); assert.equal(synth.spoken[0].rate, 0.95);
  assert.equal(synth.spoken[0].pitch, 1); assert.equal(synth.spoken[0].volume, 1); assert.equal(synth.spoken[0].voice.voiceURI, 'en-in');
  guide.pause(); assert.equal(guide.state, 'paused'); guide.resume(); assert.equal(guide.state, 'speaking');
  guide.repeat(); assert.equal(synth.spoken.length, 2); guide.stop(); assert.equal(guide.state, 'ready');
  guide.dispose(); assert.equal(synth.listeners.size, 0);
}
// Hindi selection uses Hindi voices; English fallback remains English-only.
{
  const synth = new FakeSynthesis([french, enUs, hi]); const guide = create(synth, 'hi'); guide.watch();
  assert.equal(guide.preferredVoice().voiceURI, 'hi'); guide.setLanguage('en');
  assert.equal(guide.preferredVoice().voiceURI, 'en-us'); assert.equal(guide.selectVoice('fr'), false);
  assert.equal(guide.selectVoice('en-us'), true); assert.equal(guide.preferredVoice().voiceURI, 'en-us');
}
// No unrelated voice is selected; late-loading voices are discovered.
{
  const synth = new FakeSynthesis([french]); const updates = []; const guide = create(synth, 'hi', update => updates.push(update)); guide.watch();
  assert.equal(guide.state, 'unavailable'); assert.equal(guide.play('Hindi guidance'), false); assert.equal(synth.spoken.length, 0);
  synth.load([french, hi]); assert.equal(guide.state, 'ready'); assert.equal(guide.preferredVoice().voiceURI, 'hi');
  assert.ok(updates.some(update => update.state === 'unavailable'));
}
// Missing Web Speech support degrades without throwing.
{
  const guide = create(null); guide.watch(); assert.equal(guide.state, 'unavailable');
  assert.equal(guide.play('Hello'), false); guide.dispose();
}
// Independent Hindi/English choices, bounded prosody, and prepared speech.
{
  const synth = new FakeSynthesis([hi, enIn, enUs]); const updates = [];
  const guide = createVoiceGuide({ synthesis: synth, Utterance: FakeUtterance, language: 'en', preferences: { voices: { hi: 'hi', en: 'en-us' }, rate: 1.05, pitch: 1.1 }, onPreferencesChange: value => updates.push(value) });
  guide.watch();
  assert.equal(guide.preferredVoice('hi').voiceURI, 'hi');
  assert.equal(guide.preferredVoice('en').voiceURI, 'en-us');
  assert.equal(guide.play('A clear sample sentence.', 'en'), true);
  assert.equal(synth.spoken.at(-1).rate, 1.05);
  assert.equal(synth.spoken.at(-1).pitch, 1.1);
  guide.selectVoice('en-in', 'en');
  assert.equal(updates.at(-1).voices.en, 'en-in');
  guide.setPreferences({ rate: 9, pitch: 0 });
  assert.equal(guide.preferences.rate, 1.15);
  assert.equal(guide.preferences.pitch, 0.8);
  guide.dispose();
}
// Watch is idempotent, replaced utterances cannot overwrite later state, and
// Repeat uses the last prepared response after its first playback has ended.
{
  const synth = new FakeSynthesis([enIn]); const guide = create(synth);
  guide.watch(); guide.watch(); assert.equal(synth.listeners.size, 1);
  guide.play('First response.'); const oldUtterance = synth.spoken.at(-1);
  guide.play('Second response.'); const current = synth.spoken.at(-1);
  oldUtterance.onend(); assert.equal(guide.state, 'speaking');
  current.onend(); assert.equal(guide.state, 'ready');
  assert.equal(guide.repeat(), true);
  assert.equal(synth.spoken.at(-1).text, 'Second response.');
  guide.dispose(); assert.equal(synth.listeners.size, 0);
}
{
  const fieldSpeech = prepareSpokenExplanation({ meaning: 'Middle initial.', what: 'Enter the first letter of your middle name. Example: if your middle name is Singh, enter S.', example: 'S', format: 'One letter.' }, { type: 'field' }, 'en');
  assert.match(fieldSpeech, /first letter of your middle name/i);
  const hindiSpeech = prepareSpokenExplanation({ what: 'DOB is required. Enter your date.', meaning: '', example: '' }, { type: 'field' }, 'hi');
  assert.match(hindiSpeech, /जन्म तिथि/);
  const selectionSpeech = prepareSpokenExplanation({ summary: 'A function adds two values.', simpleExplanation: 'It returns their sum.', codeSnippet: 'def add(a, b): return a + b', example: '`2 + 3` gives `5`.' }, { type: 'selection' }, 'en');
  assert.match(selectionSpeech, /adds two values/i);
  assert.doesNotMatch(selectionSpeech, /def add|codeSnippet/i);
  assert.equal(prepareSpokenExplanation({ what: 'Read this.' }, { type: 'field', sensitive: true }, 'en'), '');
  assert.equal(cleanForSpeech('## Heading\n\n**Simple** `code`'), 'Heading Simple code');
}
console.log('voice-guide tests passed');
