(() => {
  if (globalThis.__stepPilotInstalled) return;
  globalThis.__stepPilotInstalled = true;
  const { interpretField } = globalThis.StepPilotGuidance;
  const { detectField } = globalThis.StepPilotFieldLabels;
  const { createVoiceGuide, prepareSpokenExplanation } = globalThis.StepPilotVoiceGuide || {};
  const localExplainer = globalThis.StepPilotTextExplainer;
  const { isEditableTarget, captureSelection, positionFloatingButton: calculateSelectionPosition } = globalThis.StepPilotSelection || {};
  const runtimeMessaging = globalThis.StepPilotRuntimeMessaging;
  const hostId = '__steppilot_ai_root';
  let host, shadow, language = 'en', languagePreference = 'en', currentField = null, fields = [], observer, observedRoots = [], pickMode = false, listenersActive = false, refreshQueued = false;
  let voiceEnabled = false, voiceGuide = null, voiceState = 'ready', voiceChoices = [], selectedVoiceUri = '';
  let voicePreferences = { voices: { hi: '', en: '' }, rate: 0.95, pitch: 1 };
  let textExplanation = null, textRequestPending = false, textRequestId = 0, explanationSourceText = '', copyFeedback = '';
  let selectionHost = null, selectionButton = null, selectionPageUrl = '', pressedSelection = '', selectionNavigationObserver = null;
  let selectionUpdateFrame = 0, lastSelectionMouseUp = 0, explanationSourceContext = '', extensionContextInvalidated = false, pageHidden = false;
  let previousOutline = '', previousOffset = '';

  const words = {
    en: { title: 'StepPilot field guide', close: 'Close guide', pick: 'Guide this field', picking: 'Click a field on the page, or focus it.', what: 'What to enter', why: 'Why do I need this?', example: 'Show example', format: 'Format & requirements', mistakes: 'Common mistakes', next: 'Next action', previous: 'Previous field', nextField: 'Next field', unknown: 'I’m not sure what this field is for from the visible information. What are you trying to enter here?', clarify: 'Tell me what you want to enter', empty: 'No other matching fields found. You can select a field on the page.', whyHide: 'Hide explanation', exampleHide: 'Hide example', none: 'No visible form fields found. Select “Guide this field” and click a field.', field: 'Field', noLabel: 'Selected field', sensitive: 'For privacy, StepPilot does not guide password, payment, or identity fields. Their contents are never read.', optional: 'This field is marked optional. You can leave it blank if it does not apply.', selectAgain: 'Select the field again or clarify its purpose.', inaccessible: 'I could not identify a form field at that spot. Try selecting the input itself or use a field with an accessible label.', kindNames: { website: 'Website URL', business: 'Business name', email: 'Email address', phone: 'Phone number', budget: 'Budget', location: 'Location', keywords: 'Keywords', date: 'Date', description: 'Description', firstName: 'First Name', lastName: 'Last Name', city: 'City', person: 'Name' } },
    hi: { title: 'StepPilot फ़ील्ड गाइड', close: 'गाइड बंद करें', pick: 'इस फ़ील्ड की मदद लें', picking: 'पेज पर किसी फ़ील्ड पर क्लिक करें या उसे फ़ोकस करें।', what: 'क्या भरें', why: 'यह क्यों चाहिए?', example: 'उदाहरण दिखाएँ', format: 'प्रारूप और निर्देश', mistakes: 'आम गलतियाँ', next: 'अगला कदम', previous: 'पिछला फ़ील्ड', nextField: 'अगला फ़ील्ड', unknown: 'दिखाई गई जानकारी से इस फ़ील्ड का उद्देश्य स्पष्ट नहीं है।', clarify: 'बताएँ कि आप क्या भरना चाहते हैं', whyHide: 'कारण छिपाएँ', exampleHide: 'उदाहरण छिपाएँ', none: 'कोई दिखाई देने वाला फ़ॉर्म फ़ील्ड नहीं मिला। किसी फ़ील्ड पर क्लिक करें या फ़ोकस करें।', field: 'फ़ील्ड', noLabel: 'चुना हुआ फ़ील्ड', sensitive: 'गोपनीयता के लिए StepPilot पासवर्ड, भुगतान या पहचान वाले फ़ील्ड में मार्गदर्शन नहीं देता। उनकी सामग्री कभी नहीं पढ़ी जाती।', optional: 'पेज इस फ़ील्ड को वैकल्पिक बताता है। लागू न हो तो इसे खाली छोड़ सकते हैं।', selectAgain: 'फ़ील्ड फिर चुनें या उसका उद्देश्य बताएँ।', inaccessible: 'इस जगह फ़ॉर्म फ़ील्ड नहीं पहचान पाया। इनपुट पर सीधे क्लिक करें या सुलभ लेबल वाला फ़ील्ड चुनें।', kindNames: { website: 'वेबसाइट URL', business: 'व्यवसाय का नाम', email: 'ईमेल पता', phone: 'फ़ोन नंबर', budget: 'बजट', location: 'जगह', keywords: 'कीवर्ड', date: 'तारीख', description: 'विवरण', firstName: 'पहला नाम', lastName: 'उपनाम', city: 'शहर', person: 'नाम' } }
  };
  const w = key => words[language][key];
  function resolveLanguage(preference) {
    if (preference === 'hi' || preference === 'en') return preference;
    const pageLanguage = document.documentElement?.lang || '';
    return /^hi(?:-|$)/i.test(pageLanguage) || /^hi(?:-|$)/i.test(navigator.language || '') ? 'hi' : 'en';
  }

  function isField(el) {
    if (!(el instanceof Element)) return false;
    const role = el.getAttribute('role') || '';
    if ((el.tagName === 'BUTTON' || el.tagName === 'A') && !/^(textbox|combobox|searchbox|spinbutton|checkbox|radio|switch)$/.test(role)) return false;
    return el.matches('input:not([type="hidden"]):not([type="submit"]):not([type="reset"]):not([type="button"]):not([type="image"]),textarea,select,[contenteditable="true"],[role="textbox"],[role="combobox"],[role="searchbox"],[role="spinbutton"],[role="checkbox"],[role="radio"],[role="switch"],[tabindex]:not([tabindex="-1"])[aria-label],[tabindex]:not([tabindex="-1"])[aria-labelledby]') && el.getClientRects().length && !el.disabled && !el.readOnly && el.getAttribute('aria-disabled') !== 'true';
  }
  function attr(el, name) { return el.getAttribute(name) || ''; }
  function fieldInfo(el) {
    const detected = detectField(el);
    if (!detected) return null;
    return { ...detected, accessibleName: detected.ariaLabel || detected.ariaLabelledBy || '', name: detected.nameAttribute, id: detected.id, tagName: detected.tagName };
  }
  function discover() {
    const selector = 'input,textarea,select,[contenteditable="true"],[role="textbox"],[role="combobox"],[role="searchbox"],[role="spinbutton"],[role="checkbox"],[role="radio"],[role="switch"],[tabindex]:not([tabindex="-1"])[aria-label],[tabindex]:not([tabindex="-1"])[aria-labelledby]';
    const roots = [document], controls = [];
    for (let index = 0; index < roots.length; index++) {
      const root = roots[index];
      controls.push(...root.querySelectorAll(selector));
      for (const element of root.querySelectorAll('*')) if (element.shadowRoot) roots.push(element.shadowRoot);
    }
    observedRoots = roots;
    fields = [...new Set(controls)].filter(isField);
    observeRoots();
    return fields;
  }
  function observeRoots() {
    if (!observer) return;
    for (const root of observedRoots) observer.observe(root === document ? document.documentElement : root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['disabled','hidden','class','style','placeholder','aria-label','aria-labelledby','aria-describedby','aria-description','aria-details','aria-errormessage','aria-required','aria-invalid','role','contenteditable','name','autocomplete','for','data-label','title','required','maxlength','type'] });
  }
  function scopeToForm(field) {
    const form = field?.closest?.('form');
    if (form) fields = fields.filter(candidate => candidate === field || candidate.closest?.('form') === form);
  }
  function clearHighlight() {
    if (currentField?.element?.isConnected) {
      currentField.element.style.outline = previousOutline;
      currentField.element.style.outlineOffset = previousOffset;
    }
  }
  function focusField(el, scroll = true) {
    if (!isField(el)) return;
    if (textRequestPending) { textRequestId++; textRequestPending = false; }
    textExplanation = null; explanationSourceText = ''; textRequestId++; textRequestPending = false;
    if (currentField?.element !== el && voiceGuide) voiceGuide.stop();
    clearHighlight();
    discover();
    scopeToForm(el);
    const info = fieldInfo(el);
    if (!info) return;
    currentField = { element: el, info, guide: interpretField(info, language), sensitive: info.sensitive };
    previousOutline = el.style.outline;
    previousOffset = el.style.outlineOffset;
    el.style.outline = '3px solid #4387ed';
    el.style.outlineOffset = '3px';
    if (scroll) el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    pickMode = false;
    render();
    positionPanel(el);
  }

  function section(title, value, cls = '') {
    if (!value) return '';
    return `<section class="detail ${cls}"><h3>${title}</h3><p>${escapeHtml(value)}</p></section>`;
  }
  function codeSection(title, value) {
    if (!value) return '';
    return `<section class="detail"><h3>${title}</h3><pre class="code-snippet">${escapeHtml(value)}</pre></section>`;
  }
  function selectedTextPreview(value) {
    const text = String(value || '');
    const preview = text.length > 360 ? `${text.slice(0, 360)}…` : text;
    return preview ? `<section class="selection-preview"><h3>${language === 'hi' ? 'चुना हुआ टेक्स्ट' : 'Selected text'}</h3><blockquote>${escapeHtml(preview)}</blockquote></section>` : '';
  }
  function isSensitiveSelection(value) {
    const text = String(value || '');
    return /\b(?:password|passcode|one[- ]time password|verification code|security code|cvv|cvc|card number|credit card|debit card|secret key|access token|token|ssn|social security|national id|passport number)\b\s*[:=]\s*\S+/i.test(text)
      || /\bBearer\s+[A-Za-z0-9._~+/-]{12,}/i.test(text)
      || /\b(?:sk|api|ghp|gho|github_pat|AIza)[-_][A-Za-z0-9_-]{16,}/i.test(text)
      || /(?:\d[ -]?){12,19}/.test(text);
  }
  function extensionRuntime() {
    try { return globalThis.chrome?.runtime || null; }
    catch { return null; }
  }
  function handleRuntimeContextFailure(error) {
    if (!runtimeMessaging) return false;
    const invalidated = runtimeMessaging.isContextInvalidated(error) || !runtimeMessaging.isAvailable(extensionRuntime());
    if (invalidated) stopAfterContextInvalidation();
    return invalidated;
  }
  function stopAfterContextInvalidation() {
    if (extensionContextInvalidated) return;
    extensionContextInvalidated = true;
    textRequestId++;
    textRequestPending = false;
    textExplanation = { status: 'extension-context-invalidated' };
    explanationSourceText = '';
    explanationSourceContext = '';
    observer?.disconnect(); observer = null; observedRoots = [];
    removePageListeners();
    clearHighlight();
    voiceGuide?.dispose(); voiceGuide = null;
    voiceEnabled = false; voiceChoices = []; selectedVoiceUri = ''; voiceState = 'ready';
    removeSelectionButton();
    currentField = null; pickMode = false;
    if (host?.isConnected && !pageHidden) render();
    else { host?.remove(); host = null; shadow = null; }
  }
  function stopStaleExplanationForNavigation(requestId = textRequestId) {
    if (requestId !== textRequestId) return;
    const wasPending = textRequestPending;
    textRequestId++;
    textRequestPending = false;
    
    textExplanation = { status: 'navigation-changed' };
    explanationSourceText = '';
    explanationSourceContext = '';
    if (host?.isConnected && !pageHidden) render();
    else if (pageHidden) { host?.remove(); host = null; shadow = null; }
  }
  function handlePageNavigation() {
    removeSelectionButton();
    if (textRequestPending || textExplanation) stopStaleExplanationForNavigation();
  }
  function handlePageHide() {
    pageHidden = true;
    removeSelectionButton();
    if (textRequestPending) stopStaleExplanationForNavigation();
  }
  function handlePageShow() { pageHidden = false; }
  function renderExplanationResult(result) {
    if (!result || result.status !== 'ready') return '';
    if (result.mode === 'error' || result.errorType) {
      const location = result.location ? `${language === 'hi' ? 'दिखाई गई जगह' : 'Reported location'}: ${result.location}` : '';
      const steps = (result.suggestions || []).map((item, index) => `<li><span>${index + 1}.</span> ${escapeHtml(item)}</li>`).join('');
      const detailedCause = result.uncertainty ? `${result.likelyCause || ''} ${result.uncertainty}`.trim() : result.likelyCause;
      return `${section(language === 'hi' ? 'त्रुटि का प्रकार' : 'Error type', result.errorType)}${section(language === 'hi' ? 'क्या हुआ' : 'What happened', result.simpleExplanation)}${section(language === 'hi' ? 'संभावित कारण' : 'Likely cause', detailedCause)}${location ? section(language === 'hi' ? 'दिखाई गई जगह' : 'Reported location', location) : ''}${section(language === 'hi' ? 'Stack trace का अर्थ' : 'Stack trace note', result.locationNote)}${steps ? `<section class="detail"><h3>${language === 'hi' ? 'कैसे जाँचें / ठीक करें' : 'How to check or fix it'}</h3><ol class="fix-steps">${steps}</ol></section>` : ''}${result.fixExample ? codeSection(language === 'hi' ? 'Command का उदाहरण (चलाने से पहले जाँचें)' : 'Example command (review before running)', result.fixExample) : ''}${result.codeSnippet && (result.location || /Traceback| at .*:\d+:\d+|SyntaxError|TypeError|Exception/i.test(result.codeSnippet)) ? codeSection(language === 'hi' ? 'चुना हुआ error context' : 'Selected error context', result.codeSnippet) : ''}${result.confidence === 'low' && !result.uncertainty ? section(language === 'hi' ? 'सीमा' : 'Limit', language === 'hi' ? 'यह सामान्य व्याख्या है; सटीक कारण के लिए संबंधित code, command या runtime का संदर्भ चाहिए।' : 'This is a general explanation; the exact cause needs the relevant code, command, or runtime context.') : ''}`;
    }
    const sections = [];
    if (result.contentType) sections.push(section(language === 'hi' ? 'पहचाना गया प्रकार' : 'Detected content type', result.contentType));
    if (result.question) sections.push(section(language === 'hi' ? 'प्रश्न' : 'Question', result.question));
    sections.push(section(language === 'hi' ? 'यह क्या कहता है' : 'What it says', result.summary));
    sections.push(section(language === 'hi' ? 'सरल अर्थ' : 'Simple meaning', result.simpleExplanation));
    sections.push(section(language === 'hi' ? 'विस्तृत व्याख्या' : 'Detailed explanation', result.detailedExplanation));
    if (result.example) sections.push(section(language === 'hi' ? 'उदाहरण' : 'Example', result.example));
    if (result.importantTerms?.length) sections.push(section(language === 'hi' ? 'महत्वपूर्ण शब्द' : 'Important terms', result.importantTerms.map(item => `${item.term}: ${item.explanation}`).join(' ')));
    if (result.answer) sections.push(section(language === 'hi' ? 'उत्तर' : 'Answer', result.answer));
    if (result.steps?.length) sections.push(section(language === 'hi' ? 'समझने के चरण' : 'Reasoning steps', result.steps.join(' ')));
    if (result.optionsAnalysis?.length) sections.push(section(language === 'hi' ? 'विकल्पों का मूल्यांकन' : 'Option evaluation', result.optionsAnalysis.map(item => `${item.option}: ${item.correct === true ? (language === 'hi' ? 'सही' : 'evaluated as correct') : item.correct === false ? (language === 'hi' ? 'गलत' : 'evaluated as incorrect') : (language === 'hi' ? 'निर्णय नहीं' : 'not determined')}. ${item.reason}`).join(' ')));
    if (result.codeExplanation) sections.push(section(language === 'hi' ? 'Code की व्याख्या' : 'Code explanation', result.codeExplanation));
    if (result.codeSnippet && result.mode === 'code') sections.push(codeSection(language === 'hi' ? 'चुना हुआ code' : 'Selected code', result.codeSnippet));
    if (result.suggestions?.length) sections.push(section(language === 'hi' ? 'सुझाव' : 'Suggestions', result.suggestions.join(' ')));
    if (result.practicalApplication) sections.push(section(language === 'hi' ? 'व्यावहारिक उपयोग' : 'Practical application', result.practicalApplication));
    if (result.whyFixWorks) sections.push(section(language === 'hi' ? 'यह सुधार क्यों काम करना चाहिए' : 'Why this fix should work', result.whyFixWorks));
    if (result.uncertainty) sections.push(section(language === 'hi' ? 'संदर्भ की सीमा' : 'Context limitation', result.uncertainty));
    if (result.confidenceReason) sections.push(section(language === 'hi' ? 'विश्वास का कारण' : 'Confidence note', result.confidenceReason));
    return sections.join('');
  }
  function explanationCopyText(result) {
    return [result?.contentType, result?.errorType, result?.summary, result?.simpleExplanation, result?.detailedExplanation, result?.answer, ...(result?.steps || []), result?.likelyCause, ...(result?.suggestions || []), result?.fixExample, result?.example, result?.codeExplanation, result?.practicalApplication, ...(result?.importantTerms || []).map(item => `${item.term}: ${item.explanation}`)]
      .filter(Boolean).join('\n\n');
  }
  function textExplanationBody(result) {
    if (result.status === 'extension-context-invalidated') return `<p class="unknown">${language === 'hi' ? 'StepPilot को reload या update किया गया है। इस पेज को refresh करें, फिर text दोबारा चुनकर समझाएँ।' : 'StepPilot was reloaded or updated. Refresh this page, then select the text and explain it again.'}</p>`;
    if (result.status === 'navigation-changed') return `<p class="unknown">${language === 'hi' ? 'पेज बदल गया, इसलिए पुराना उत्तर नहीं दिखाया गया। नए पेज पर text फिर चुनें।' : 'The page changed, so the previous response was discarded. Select text again on the current page.'}</p>`;
    const preview = selectedTextPreview(explanationSourceText);
    if (result.status === 'sensitive-selection') return `<p class="unknown">${language === 'hi' ? 'इस selection में संवेदनशील जानकारी हो सकती है। StepPilot इसे नहीं समझाता। कृपया गैर-संवेदनशील text चुनें।' : 'This selection may contain sensitive information. StepPilot will not interpret it. Select non-sensitive text instead.'}</p>`;
    if (result.status === 'loading') return `${preview}<p class="unknown" role="status">${language === 'hi' ? 'स्थानीय व्याख्या तैयार हो रही है…' : 'Preparing a local explanation…'}</p>`;
    if (result.status === 'empty') return `<p class="unknown">${language === 'hi' ? 'कोई text चयनित नहीं है। पहले page पर text चुनें।' : 'No text was selected. Select text on the page and try again.'}</p>`;
    if (result.status === 'too-long') return `<p class="unknown">${language === 'hi' ? 'चयन बहुत लंबा है। 20,000 अक्षरों से छोटा हिस्सा चुनें।' : 'The selection is too long. Select a passage under 20,000 characters.'}</p>`;
    if (result.status !== 'ready') return `${preview}<p class="unknown">${language === 'hi' ? 'स्थानीय व्याख्या तैयार नहीं हो सकी। छोटा या अधिक स्पष्ट selection चुनें।' : 'A local explanation could not be prepared. Select a shorter or clearer passage.'}</p>`;
    return `${preview}${renderExplanationResult(result)}`;
  }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  }
  function voiceStatusLabel() {
    const labels = language === 'hi'
      ? { ready: 'तैयार', speaking: 'बोल रहा है', paused: 'रुका हुआ', unavailable: 'आवाज़ उपलब्ध नहीं', error: 'प्लेबैक में समस्या' }
      : { ready: 'Ready', speaking: 'Speaking', paused: 'Paused', unavailable: 'Voice unavailable', error: 'Playback error' };
    return labels[voiceState] || labels.ready;
  }
  function spokenExplanation() {
    if (!prepareSpokenExplanation) return '';
    if (textExplanation) {
      const source = explanationSourceText;
      const sensitive = /\b(?:password|passcode|cvv|cvc|security code|one[- ]time code|social security|national id|card number)\b/i.test(source) || /(?:\d[ -]?){12,19}/.test(source);
      return prepareSpokenExplanation(textExplanation, { type: 'selection', sensitive }, language);
    }
    if (!currentField?.guide || currentField.sensitive) return '';
    return prepareSpokenExplanation(currentField.guide, { type: 'field', sensitive: currentField.sensitive }, language);
  }
  function voiceControls() {
    if (!voiceEnabled) return '';
    const canSpeak = Boolean(spokenExplanation()) && voiceChoices.length > 0;
    return `<section class="voice-controls" aria-label="${language === 'hi' ? 'आवाज़ मार्गदर्शन' : 'Voice guidance'}"><p class="voice-status" role="status" aria-live="polite">${language === 'hi' ? 'स्थिति' : 'Status'}: ${voiceStatusLabel()}${!voiceChoices.length ? (language === 'hi' ? ' · इस भाषा की आवाज़ उपलब्ध नहीं है' : ' · No voice for this language is available') : ''}</p><div class="voice-buttons"><button class="btn" data-voice="play" aria-label="${language === 'hi' ? 'व्याख्या सुनें' : 'Play explanation'}" ${!canSpeak ? 'disabled' : ''}>▶ ${language === 'hi' ? 'चलाएँ' : 'Play'}</button><button class="btn" data-voice="pause" aria-label="Pause" ${voiceState !== 'speaking' ? 'disabled' : ''}>Ⅱ ${language === 'hi' ? 'रोकें' : 'Pause'}</button><button class="btn" data-voice="resume" aria-label="Resume" ${voiceState !== 'paused' ? 'disabled' : ''}>▶ ${language === 'hi' ? 'फिर शुरू' : 'Resume'}</button><button class="btn" data-voice="repeat" aria-label="Repeat explanation" ${!canSpeak ? 'disabled' : ''}>↻ ${language === 'hi' ? 'दोहराएँ' : 'Repeat'}</button><button class="btn" data-voice="stop" aria-label="Stop speech">■ ${language === 'hi' ? 'बंद' : 'Stop'}</button></div>${voiceChoices.length > 1 ? `<label class="sr-only" for="voice-choice">${language === 'hi' ? 'आवाज़ चुनें' : 'Choose voice'}</label><select class="voice-select" id="voice-choice" aria-label="${language === 'hi' ? 'आवाज़ चुनें' : 'Choose voice'}"><option value="">${language === 'hi' ? 'डिफ़ॉल्ट आवाज़' : 'Default voice'}</option>${voiceChoices.map(voice => `<option value="${escapeHtml(voice.voiceURI)}" ${selectedVoiceUri === voice.voiceURI ? 'selected' : ''}>${escapeHtml(voice.name)} (${escapeHtml(voice.lang)})</option>`).join('')}</select>` : ''}</section>`;
  }
  function setupVoiceGuide() {
    if (!voiceEnabled || voiceGuide) return;
    if (!createVoiceGuide || !window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      voiceState = 'unavailable'; render(); return;
    }
    voiceGuide = createVoiceGuide({ synthesis: window.speechSynthesis, Utterance: window.SpeechSynthesisUtterance, language, preferences: voicePreferences,
      onPreferencesChange: prefs => {
        voicePreferences = prefs;
        try {
          const runtime = extensionRuntime();
          if (runtimeMessaging && !runtimeMessaging.isAvailable(runtime)) { stopAfterContextInvalidation(); return; }
          Promise.resolve(globalThis.chrome?.storage?.local?.set({ voicePreferences: prefs })).catch(error => {
            if (!handleRuntimeContextFailure(error)) console.warn('[StepPilot] Could not persist voice preferences:', error?.name || 'storage error');
          });
        } catch (error) {
          if (!handleRuntimeContextFailure(error)) console.warn('[StepPilot] Could not persist voice preferences:', error?.name || 'storage error');
        }
      },
      onChange: update => { voiceState = update.state; voiceChoices = update.voices || []; selectedVoiceUri = update.selectedUri || ''; if (update.preferences) voicePreferences = update.preferences; if (host?.isConnected && voiceEnabled) render(); }
    });
    voiceGuide.watch();
  }
  function setVoiceEnabled(enabled) {
    voiceEnabled = enabled === true;
    if (voiceEnabled) setupVoiceGuide();
    else {
      voiceGuide?.dispose(); voiceGuide = null; voiceChoices = []; selectedVoiceUri = ''; voiceState = 'ready';
    }
    render();
  }
  function editableElement(node) {
    return isEditableTarget ? isEditableTarget(node) : false;
  }
  function readPageSelection() {
    if (editableElement(document.activeElement)) return '';
    const selection = window.getSelection?.();
    return captureSelection ? captureSelection(selection) : '';
  }
  function findNearbyQuestionContext(selectedText) {
    const questionLike = /\?|\b(?:which|what|solve|calculate|hcf|lcm|choose|select|answer|percentage|percent)\b|कौन|क्या|हल|प्रतिशत/i.test(selectedText);
    const errorLike = /\b(?:error|exception|warning|failed|failure|traceback|syntaxerror|typeerror|referenceerror|modulenotfounderror|importerror|404|econnrefused|command not found|permission denied|cors)\b|त्रुटि|गलती/i.test(selectedText);
    if (!questionLike && !errorLike) return '';
    const selection = window.getSelection?.();
    let element = selection?.rangeCount ? selection.getRangeAt(0).commonAncestorContainer : null;
    element = element?.nodeType === Node.ELEMENT_NODE ? element : element?.parentElement;
    for (let depth = 0; element && depth < 6; depth++, element = element.parentElement) {
      if (!element.matches?.('div,li,fieldset,section,article,table,tr,[role="listitem"],[role="group"],[role="radiogroup"]')) continue;
      if (element.querySelector?.('input[type="password"],input[autocomplete*="cc-"],input[name*="cvv" i],textarea,[contenteditable="true"]')) continue;
      const text = String(element.innerText || '').trim();
      const choices = text.match(/(?:^|\n)\s*(?:[A-Da-d][).:]|\([A-Da-d]\)|[1-4][).])\s+\S/g) || [];
      const containsSelection = text.toLowerCase().includes(selectedText.trim().slice(0, 24).toLowerCase());
      if (text.length <= (questionLike ? 2500 : 1600) && containsSelection && (choices.length >= 2 || errorLike)) return text;
    }
    return '';
  }
  function scheduleSelectionUpdate() {
    if (selectionUpdateFrame) return;
    const run = () => { selectionUpdateFrame = 0; updateSelectionButton(); };
    selectionUpdateFrame = requestAnimationFrame(run);
  }
  function removeSelectionButton() {
    selectionNavigationObserver?.disconnect(); selectionNavigationObserver = null;
    selectionHost?.remove(); selectionHost = null; selectionButton = null; pressedSelection = '';
  }
  function updateSelectionButton() {
    if (extensionContextInvalidated) { removeSelectionButton(); return; }
    if (selectionHost && selectionPageUrl !== location.href) { removeSelectionButton(); return; }
    const text = readPageSelection();
    if (!text) { removeSelectionButton(); return; }
    if (!selectionHost?.isConnected) {
      selectionPageUrl = location.href;
      selectionHost = document.createElement('div');
      selectionHost.id = '__steppilot_explain_selection';
      const root = selectionHost.attachShadow({ mode: 'closed' });
      root.innerHTML = `<style>:host{all:initial;position:fixed;z-index:2147483646;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.explain{border:0;border-radius:9px;background:#172744;color:#fff;box-shadow:0 5px 18px #12274340;padding:9px 12px;font:600 12px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer;white-space:nowrap}.explain:hover{background:#28446e}.explain:focus-visible{outline:3px solid #91bbff;outline-offset:2px}</style><button class="explain" type="button">Explain with StepPilot</button>`;
      selectionButton = root.querySelector('button');
      selectionButton.addEventListener('mousedown', event => { pressedSelection = readPageSelection(); event.preventDefault(); });
      selectionButton.addEventListener('click', event => {
        event.preventDefault(); event.stopPropagation();
        const latest = readPageSelection();
        const captured = latest || pressedSelection;
        const context = findNearbyQuestionContext(captured);
        removeSelectionButton();
        openTextExplanation(captured, language, { nearbyContext: context });
      });
      (document.documentElement || document.body).appendChild(selectionHost);
      selectionNavigationObserver = new MutationObserver(() => {
        if (selectionPageUrl !== location.href) removeSelectionButton();
      });
      selectionNavigationObserver.observe(document.documentElement, { childList: true, subtree: true });
    }
    positionSelectionButton();
  }
  function positionSelectionButton() {
    if (!selectionHost?.isConnected) return;
    const selection = window.getSelection?.();
    if (!selection || !selection.rangeCount) return;
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (!rect.width && !rect.height) return;
    const point = calculateSelectionPosition
      ? calculateSelectionPosition(rect, { width: window.innerWidth, height: window.innerHeight }, { width: 190, height: 36 })
      : { left: 8, top: 8 };
    selectionHost.style.left = `${point.left}px`; selectionHost.style.top = `${point.top}px`;
  }
  function openTextExplanation(text, selectedLanguage = language, options = {}) {
    if (extensionContextInvalidated) return false;
    const selectedText = String(text ?? '');
    languagePreference = ['hi','en','hinglish','auto'].includes(selectedLanguage) ? selectedLanguage : languagePreference;
    language = resolveLanguage(languagePreference);
    voiceGuide?.setLanguage(language === 'hinglish' ? 'hi' : language);
    voiceGuide?.stop();
    if (textRequestPending && selectedText === explanationSourceText && !options.followup) return false;
    textRequestId++;
    textRequestPending = false;
    explanationSourceText = selectedText;
    explanationSourceContext = String(options.nearbyContext || '').slice(0, 4000);
    copyFeedback = '';
    const requestId = textRequestId;
    if (selectedText.length > 20000) textExplanation = { status: 'too-long' };
    else if (!selectedText.trim()) textExplanation = { status: 'empty' };
    else if (isSensitiveSelection(selectedText)) textExplanation = { status: 'sensitive-selection' };
    else {
      textRequestPending = true;
      textExplanation = { status: 'loading' };
    }
    ensurePanel();
    render();
    if (!textRequestPending) return true;
    const requestUrl = location.href;
    Promise.resolve().then(() => {
      if (!localExplainer?.explain) throw new Error('Local explanation module is unavailable');
      return localExplainer.explain(selectedText, {
        language: language === 'auto' ? resolveLanguage('auto') : language,
        nearbyContext: explanationSourceContext,
        followup: options.followup || '',
        previousExplanation: options.previousExplanation || null
      });
    }).then(result => {
      if (requestId !== textRequestId || !host?.isConnected || pageHidden) return;
      if (location.href !== requestUrl) { stopStaleExplanationForNavigation(requestId); return; }
      textExplanation = result?.status === 'ready' ? result : { status: result?.status || 'unavailable' };
      render();
    }).catch(error => {
      if (requestId !== textRequestId) return;
      if (location.href !== requestUrl) { stopStaleExplanationForNavigation(requestId); return; }
      if (!host?.isConnected || pageHidden) return;
      textExplanation = { status: 'unavailable', message: error?.message || '' };
      render();
    }).finally(() => { if (requestId === textRequestId) textRequestPending = false; });
    return true;
  }
  function installSelectionListeners() {
    document.addEventListener('selectionchange', scheduleSelectionUpdate);
    document.addEventListener('mouseup', () => { lastSelectionMouseUp = Date.now(); scheduleSelectionUpdate(); });
    document.addEventListener('keyup', scheduleSelectionUpdate);
    document.addEventListener('click', event => {
      if (!selectionHost || event.composedPath().includes(selectionHost)) return;
      if (Date.now() - lastSelectionMouseUp < 350) { scheduleSelectionUpdate(); return; }
      removeSelectionButton();
    }, true);
    window.addEventListener('resize', positionSelectionButton);
    window.addEventListener('scroll', positionSelectionButton, true);
    window.addEventListener('popstate', handlePageNavigation);
    window.addEventListener('hashchange', handlePageNavigation);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);
  }
  function ensurePanel() {
    if (host?.isConnected) return;
    host = document.createElement('div'); host.id = hostId;
    (document.documentElement || document.body).appendChild(host);
    shadow = host.attachShadow({ mode: 'closed' });
  }
  function requirements(info) {
    const parts = [];
    if (info.help) parts.push(info.help);
    if (info.optional) parts.push(w('optional'));
    if (info.required) parts.push(language === 'hi' ? 'पेज इस फ़ील्ड को आवश्यक बताता है।' : 'The page marks this field as required.');
    if (info.maxLength) parts.push(language === 'hi' ? `अधिकतम ${info.maxLength} अक्षर।` : `Up to ${info.maxLength} characters.`);
    if (info.min || info.max) parts.push(`${language === 'hi' ? 'दिखाई गई सीमा' : 'Visible range'}: ${info.min || '…'}–${info.max || '…'}.`);
    if (info.step && info.step !== 'any') parts.push(`${language === 'hi' ? 'कदम' : 'Step'}: ${info.step}.`);
    if (info.accept) parts.push(`${language === 'hi' ? 'स्वीकृत फ़ाइल प्रकार' : 'Accepted file types'}: ${info.accept}.`);
    if (info.options?.length) parts.push(`${language === 'hi' ? 'विकल्प' : 'Options'}: ${info.options.join(', ')}.`);
    if (info.invalid && info.help) parts.push(`${language === 'hi' ? 'पेज का संदेश' : 'Page message'}: ${info.help}`);
    if (info.invalid && !parts.length) parts.push(language === 'hi' ? 'पेज इस फ़ील्ड को जाँचने का संकेत दे रहा है।' : 'The page indicates this field needs attention.');
    if (!parts.length && info.type === 'url') parts.push(language === 'hi' ? 'यह URL फ़ील्ड है। पेज का अपना संकेत या त्रुटि संदेश मानें।' : 'This is a URL field. Follow the page’s own hint or validation message.');
    if (!parts.length) parts.push(language === 'hi' ? 'पेज ने कोई अतिरिक्त प्रारूप निर्देश नहीं दिखाया।' : 'No extra format requirement is visible on the page.');
    return parts.join(' ');
  }
  function render() {
    if (!shadow) return;
    const info = currentField?.info;
    const guide = currentField?.guide || (info && interpretField(info, language));
    const name = info?.label || info?.accessibleName || info?.placeholder || w('noLabel');
    const title = textExplanation
      ? (language === 'hi' ? 'चुने हुए टेक्स्ट की व्याख्या' : 'Selected text explanation')
      : info ? w('field') + ': ' + name : w('clarify');
    const textStatus = textExplanation?.status;
    const localBadge = textExplanation?.engine === 'local'
      ? `<p class="engine-badge">${language === 'hi' ? 'स्थानीय व्याख्या · नियम-आधारित' : 'Local explanation · rules-based'}</p>`
      : '';
    const panelBody = textExplanation
      ? textExplanationBody(textExplanation)
      : currentField?.inaccessible
      ? `<p class="unknown">${w('inaccessible')}</p>`
      : guide
      ? `${section(language === 'hi' ? 'संभावित अर्थ' : 'Likely meaning', guide.meaning)}${section(w('what'), guide.what)}${guide.why ? `<button class="disclosure" data-toggle="why">${w('why')}</button><div class="optional why">${section(w('why'), guide.why)}</div>` : ''}${guide.example ? `<button class="disclosure" data-toggle="example">${w('example')}</button><div class="optional example">${section(language === 'hi' ? 'उदाहरण (केवल उदाहरण)' : 'Example (example only)', guide.example)}</div>` : ''}${section(w('format'), guide.format)}${section(language === 'hi' ? 'आवश्यकता' : 'Requirement', guide.requirement)}${!guide.needsClarification ? section(language === 'hi' ? 'ध्यान दें' : 'Note', guide.warning) : ''}${guide.needsClarification ? section(language === 'hi' ? 'क्या जाँचें' : 'What to check next', guide.next || guide.warning) : ''}`
      : `<p class="unknown">${language === 'hi' ? 'दिखाई गई जानकारी पर्याप्त नहीं है।' : 'There is not enough visible information to explain this field.'}</p>`;
    const total = fields.length;
    const index = currentField ? fields.indexOf(currentField.element) : -1;
    shadow.innerHTML = `<style>
      :host{all:initial;position:fixed;z-index:2147483647;width:min(340px,calc(100vw - 20px));color:#17243c;font:13px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*{box-sizing:border-box}.panel{max-height:min(72vh,620px);display:flex;flex-direction:column;background:#fff;border:1px solid #e3eaf3;border-radius:15px;box-shadow:0 14px 42px #12274335;overflow:hidden}.head{display:flex;align-items:center;padding:12px 14px;border-bottom:1px solid #edf1f6;flex:none}.mark{width:27px;height:27px;border-radius:8px;background:#172744;color:#9bcaff;display:grid;place-items:center;margin-right:8px}.headtitle{font-weight:700;font-size:12px}.close{margin-left:auto;border:0;background:transparent;font-size:19px;color:#718096;cursor:pointer;border-radius:7px}.body{padding:12px 14px;overflow:auto}.fieldname{font-size:11px;color:#6483ac;font-weight:700;margin:0 0 8px;overflow-wrap:anywhere}.detail{margin:0 0 10px}.detail h3{font-size:10px;color:#697991;margin:0 0 3px}.detail p,.unknown{font-size:12px;color:#34445c;margin:0;overflow-wrap:anywhere}.optional{display:none}.optional.open{display:block;margin-top:6px}.disclosure{padding:0;border:0;background:transparent;color:#3678cf;font:600 11px inherit;cursor:pointer;margin:0 0 8px}.footer{display:flex;flex-wrap:wrap;gap:7px;padding:10px 12px;border-top:1px solid #edf1f6;flex:none}.btn{height:33px;border:0;border-radius:8px;padding:0 11px;background:#eef2f7;color:#506179;font:600 11px inherit;cursor:pointer}.btn:disabled{opacity:.4;cursor:not-allowed}.primary{margin-left:auto;background:#3f82df;color:#fff}.pick{background:#eaf2ff;color:#2865ac}.btn:focus-visible,.close:focus-visible,.disclosure:focus-visible,textarea:focus-visible{outline:3px solid #91bbff;outline-offset:2px}textarea{width:100%;resize:vertical;border:1px solid #dce4ee;border-radius:8px;padding:8px;font:12px inherit;margin-top:5px}.clarify-label{display:block;font-size:10px;color:#687991;margin-top:10px}
      .btn,.disclosure,textarea{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.voice-controls{border-top:1px solid #edf1f6;margin-top:10px;padding-top:9px}.voice-status{font-size:10px;color:#667892;margin:0 0 7px}.voice-buttons{display:flex;gap:5px;flex-wrap:wrap}.voice-buttons .btn{padding:0 8px}.voice-select{max-width:100%;margin-top:7px;font:11px inherit}.voice-select:focus-visible{outline:3px solid #91bbff;outline-offset:2px}.engine-badge{display:inline-block;margin:0 0 8px;padding:3px 7px;border-radius:20px;background:#eef5ff;color:#3973b8;font-size:10px;font-weight:650}.code-snippet{white-space:pre-wrap;overflow-wrap:anywhere;background:#f4f6f9;border:1px solid #e5eaf0;border-radius:7px;padding:8px;margin:0;font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;color:#27364e}.selection-preview{margin:0 0 10px;padding:8px 9px;background:#f6f8fb;border-left:3px solid #91b9ee;border-radius:5px}.selection-preview h3{font-size:10px;color:#687991;margin:0 0 4px}.selection-preview blockquote{font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;color:#48566b;margin:0;white-space:pre-wrap;overflow-wrap:anywhere;max-height:90px;overflow:auto}.fix-steps{margin:0;padding-left:18px}.fix-steps li{font-size:12px;color:#34445c;margin:0 0 5px;overflow-wrap:anywhere}
    </style><section class="panel" role="region" aria-live="polite" aria-label="${escapeHtml(title)}"><header class="head"><span class="mark" aria-hidden="true">✦</span><span class="headtitle">${escapeHtml(textExplanation ? title : w('title'))}</span><button class="close" aria-label="${w('close')}" title="${w('close')}">×</button></header><div class="body">${!textExplanation && !info ? `<p class="unknown">${w('none')}</p>` : !textExplanation ? `<p class="fieldname">${escapeHtml(title)}</p>` : `${localBadge}${textExplanation.engine === 'local' && textExplanation.confidence ? `<p class="fieldname">${language === 'hi' ? `विश्वास: ${textExplanation.confidence === 'high' ? 'अच्छा' : textExplanation.confidence === 'medium' ? 'मध्यम' : 'कम'}` : `Confidence: ${textExplanation.confidence}`}</p>` : ''}`}${panelBody}${textExplanation && textExplanation.status === 'ready' ? `<button class="btn" data-action="further-open">${language === 'hi' ? 'और पूछें' : 'Explain further'}</button><div class="further-box" hidden><label class="clarify-label" for="further-question">${language === 'hi' ? 'सरल व्याख्या, अधिक विवरण, या दूसरा उदाहरण माँगें' : 'Ask for a simpler explanation, more detail, or another example'}</label><textarea id="further-question" rows="2" maxlength="1000"></textarea><button class="btn primary" data-action="further-submit">${language === 'hi' ? 'भेजें' : 'Ask'}</button></div>` : ''}${copyFeedback ? `<p class="voice-status" role="status">${copyFeedback === 'copied' ? (language === 'hi' ? 'व्याख्या कॉपी हो गई।' : 'Explanation copied.') : escapeHtml(copyFeedback)}</p>` : ''}${!textExplanation && info ? `<button class="btn pick" data-action="explain">${language === 'hi' ? 'इस फ़ील्ड को समझाएँ' : 'Explain this field'}</button>` : ''}${textExplanation?.status !== 'extension-context-invalidated' && textExplanation?.status !== 'navigation-changed' ? voiceControls() : ''}</div><footer class="footer">${textExplanation?.status === 'extension-context-invalidated' || textExplanation?.status === 'navigation-changed' ? '' : textExplanation ? `<button class="btn pick" data-action="copy-explanation" ${textExplanation.status !== 'ready' ? 'disabled' : ''}>${language === 'hi' ? (copyFeedback === 'copied' ? 'कॉपी हो गया' : 'व्याख्या कॉपी करें') : (copyFeedback === 'copied' ? 'Copied' : 'Copy explanation')}</button><button class="btn" data-action="toggle-language">${language === 'hi' ? 'English में समझाएँ' : 'हिन्दी में समझाएँ'}</button>` : `<button class="btn pick" data-action="pick">${pickMode ? w('picking') : w('pick')}</button><button class="btn" data-action="prev" ${index <= 0 ? 'disabled' : ''}>${w('previous')}</button><button class="btn primary" data-action="next" ${total < 2 || index < 0 || index >= total - 1 ? 'disabled' : ''}>${w('nextField')}</button>`}</footer></section>`;
    shadow.querySelector('.close').addEventListener('click', stop);
    shadow.querySelector('[data-action="pick"]')?.addEventListener('click', () => { pickMode = !pickMode; render(); });
    shadow.querySelector('[data-action="explain"]')?.addEventListener('click', () => { if (currentField?.element?.isConnected) focusField(currentField.element, false); });
    shadow.querySelector('[data-action="prev"]')?.addEventListener('click', () => move(-1));
    shadow.querySelector('[data-action="next"]')?.addEventListener('click', () => move(1));
    shadow.querySelector('[data-action="further-open"]')?.addEventListener('click', event => { const box = shadow.querySelector('.further-box'); box.hidden = false; event.currentTarget.hidden = true; shadow.querySelector('#further-question')?.focus(); });
    shadow.querySelector('[data-action="further-submit"]')?.addEventListener('click', () => { const question = shadow.querySelector('#further-question')?.value.trim(); if (question) openTextExplanation(explanationSourceText, languagePreference, { nearbyContext: explanationSourceContext, followup: question, previousExplanation: textExplanation }); });
    shadow.querySelector('[data-action="toggle-language"]')?.addEventListener('click', () => {
      if (textRequestPending) { textRequestId++; textRequestPending = false; }
      openTextExplanation(explanationSourceText, language === 'hi' ? 'en' : 'hi', { nearbyContext: explanationSourceContext });
    });
    shadow.querySelector('[data-action="copy-explanation"]')?.addEventListener('click', async () => {
      try {
        const copyText = explanationCopyText(textExplanation);
        if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(copyText);
        else {
          const temporary = document.createElement('textarea');
          temporary.value = copyText; temporary.setAttribute('readonly', ''); temporary.style.cssText = 'position:fixed;left:-10000px;top:0';
          shadow.appendChild(temporary); temporary.select();
          let copied = false;
          try { copied = document.execCommand('copy'); } finally { temporary.remove(); }
          if (!copied) throw new Error('clipboard unavailable');
        }
        copyFeedback = 'copied';
      } catch {
        copyFeedback = language === 'hi' ? 'कॉपी नहीं हो सका।' : 'Could not copy this explanation.';
      }
      render();
    });
    shadow.querySelectorAll('[data-voice]').forEach(button => button.addEventListener('click', () => {
      if (!voiceGuide) setupVoiceGuide();
      const action = button.dataset.voice;
      if (action === 'play' || action === 'repeat') voiceGuide?.play(spokenExplanation(), language);
      else voiceGuide?.[action]();
    }));
    shadow.querySelector('#voice-choice')?.addEventListener('change', event => voiceGuide?.selectVoice(event.target.value, language));
    shadow.querySelectorAll('[data-toggle]').forEach(button => button.addEventListener('click', () => {
      const which = button.dataset.toggle;
      const box = shadow.querySelector(`.optional.${which}`);
      const opened = box.classList.toggle('open');
      button.textContent = which === 'why' ? (opened ? w('whyHide') : w('why')) : (opened ? w('exampleHide') : w('example'));
    }));
    positionPanel(textExplanation ? null : currentField?.element);
  }
  function positionPanel(el) {
    if (!host) return;
    const width = Math.min(340, window.innerWidth - 20);
    let left = window.innerWidth - width - 12, top = window.innerHeight - Math.min(460, window.innerHeight * .72) - 12;
    if (el?.isConnected) {
      const rect = el.getBoundingClientRect();
      const rightSpace = window.innerWidth - rect.right;
      const leftSpace = rect.left;
      const panelHeight = host.getBoundingClientRect().height || 300;
      if (rightSpace >= width + 12) left = rect.right + 12;
      else if (leftSpace >= width + 12) left = rect.left - width - 12;
      else {
        left = Math.max(10, Math.min(rect.left, window.innerWidth - width - 10));
        if (rect.bottom + panelHeight + 10 <= window.innerHeight) top = rect.bottom + 8;
        else if (rect.top - panelHeight - 10 >= 0) top = rect.top - panelHeight - 8;
        else top = Math.max(10, Math.min(rect.top, window.innerHeight - panelHeight - 10));
      }
      if (rightSpace >= width + 12 || leftSpace >= width + 12) top = Math.max(10, Math.min(rect.top - 8, window.innerHeight - panelHeight - 10));
    }
    host.style.left = `${Math.max(10, Math.min(left, window.innerWidth - width - 10))}px`;
    host.style.top = `${Math.max(10, Math.min(top, window.innerHeight - 80))}px`;
    host.style.right = 'auto'; host.style.bottom = 'auto';
  }
  function move(delta) {
    discover();
    scopeToForm(currentField?.element);
    const index = currentField ? fields.indexOf(currentField.element) : -1;
    const next = fields[index + delta];
    if (next) focusField(next);
  }
  function onResize() { positionPanel(textExplanation ? null : currentField?.element); }
  function onScroll() { positionPanel(textExplanation ? null : currentField?.element); }
  function addPageListeners() {
    if (listenersActive) return;
    document.addEventListener('focusin', fieldEvent, true);
    document.addEventListener('click', fieldEvent, true);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true);
    listenersActive = true;
  }
  function removePageListeners() {
    if (!listenersActive) return;
    document.removeEventListener('focusin', fieldEvent, true);
    document.removeEventListener('click', fieldEvent, true);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('scroll', onScroll, true);
    listenersActive = false;
  }
  function start(nextLanguage, nextVoiceEnabled = false, nextVoicePreferences = null) {
    languagePreference = ['hi','en','hinglish','auto'].includes(nextLanguage) ? nextLanguage : 'en';
    language = resolveLanguage(languagePreference);
    if (nextVoicePreferences && typeof nextVoicePreferences === 'object') voicePreferences = { ...voicePreferences, ...nextVoicePreferences, voices: { ...voicePreferences.voices, ...(nextVoicePreferences.voices || {}) } };
    setVoiceEnabled(nextVoiceEnabled);
    voiceGuide?.setPreferences(voicePreferences);
    ensurePanel();
    discover();
    clearHighlight();
    currentField = null;
    addPageListeners();
    const active = document.activeElement;
    if (isField(active)) focusField(active, false);
    else { currentField = null; pickMode = false; render(); }
    observer?.disconnect();
    observer = new MutationObserver(records => {
      const relevant = records.some(record => {
        const target = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
        return !target?.closest('[contenteditable="true"],[role="textbox"]');
      });
      if (!relevant || refreshQueued) return;
      refreshQueued = true;
      requestAnimationFrame(() => {
        refreshQueued = false;
        if (!host) return;
        discover();
        observeRoots();
        if (currentField && (!currentField.element?.isConnected || !fields.includes(currentField.element))) { clearHighlight(); currentField = null; render(); }
        else if (currentField?.element) { scopeToForm(currentField.element); currentField.info = fieldInfo(currentField.element); currentField.guide = interpretField(currentField.info, language); currentField.sensitive = currentField.info.sensitive; render(); }
      });
    });
    observeRoots();
    return { ok: true, fields: fields.length };
  }
  function stop() {
    observer?.disconnect(); observer = null; observedRoots = [];
    removePageListeners();
    clearHighlight();
    voiceGuide?.dispose(); voiceGuide = null; voiceEnabled = false; voiceChoices = []; selectedVoiceUri = ''; voiceState = 'ready';
    if (textRequestPending) { textRequestId++; textRequestPending = false; }
    textRequestId++; textRequestPending = false; textExplanation = null; explanationSourceText = ''; explanationSourceContext = '';
    host?.remove(); host = null; shadow = null; currentField = null;
    return { ok: true };
  }
  function fieldEvent(event) {
    const path = event.composedPath();
    const field = path.map(node => isField(node) ? node : node?.tagName === 'LABEL' && isField(node.control) ? node.control : null).find(Boolean);
    if (field && (event.type === 'focusin' || pickMode || event.type === 'click') && field.getRootNode() !== shadow) focusField(field, false);
    else if (event.type === 'click' && pickMode && !path.includes(host)) {
      clearHighlight(); currentField = { element: null, info: null, kind: null, inaccessible: true }; render();
    }
  }

  const runtime = extensionRuntime();
  if (!runtimeMessaging?.isAvailable(runtime)) {
    extensionContextInvalidated = true;
  } else try { runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type === 'STEPPILOT_START') respond(start(message.language, message.voiceEnabled, message.voicePreferences));
    else if (message?.type === 'STEPPILOT_STOP') respond(stop());
    else if (message?.type === 'STEPPILOT_STATUS') respond({ ok: true, active: Boolean(host?.isConnected) });
    else if (message?.type === 'STEPPILOT_LANGUAGE' && host) {
      if (textRequestPending) { textRequestId++; textRequestPending = false; }
      languagePreference = ['hi','en','hinglish','auto'].includes(message.language) ? message.language : 'en';
      language = resolveLanguage(languagePreference);
      if (voiceGuide) voiceGuide.setLanguage(language);
      if (textExplanation && explanationSourceText) { const selected = explanationSourceText; const context = explanationSourceContext; textRequestId++; textRequestPending = false; textExplanation = null; openTextExplanation(selected, languagePreference, { nearbyContext: context }); }
      else if (currentField?.element) { currentField.info = fieldInfo(currentField.element); currentField.guide = interpretField(currentField.info, language); render(); }
      else render();
      respond({ ok: true });
    }
    else if (message?.type === 'STEPPILOT_VOICE_SETTING' && host) { setVoiceEnabled(message.enabled); respond({ ok: true }); }
    else if (message?.type === 'STEPPILOT_VOICE_PREFERENCES') {
      voicePreferences = { ...voicePreferences, ...(message.preferences || {}), voices: { ...voicePreferences.voices, ...(message.preferences?.voices || {}) } };
      voiceGuide?.setPreferences(voicePreferences);
      respond({ ok: true });
    }
    else if (message?.type === 'STEPPILOT_EXPLAIN_SELECTION') {
      const selectedText = String(message.selectedText ?? '');
      if (message.voicePreferences && typeof message.voicePreferences === 'object') voicePreferences = { ...voicePreferences, ...message.voicePreferences, voices: { ...voicePreferences.voices, ...(message.voicePreferences.voices || {}) } };
      if (typeof message.voiceEnabled === 'boolean') setVoiceEnabled(message.voiceEnabled);
      voiceGuide?.setPreferences(voicePreferences);
      if (editableElement(document.activeElement)) respond({ ok: false, reason: 'editable' });
      else { const accepted = openTextExplanation(selectedText, message.language || language, { nearbyContext: findNearbyQuestionContext(selectedText) }); respond({ ok: accepted, reason: accepted ? '' : 'busy' }); }
    }
    // All handled content messages respond synchronously. Close unknown
    // message channels instead of leaving an unanswered port open.
    return false;
  }); } catch (error) {
    if (runtimeMessaging.isContextInvalidated(error) || !runtimeMessaging.isAvailable(runtime)) extensionContextInvalidated = true;
    else throw error;
  }
  if (!extensionContextInvalidated) installSelectionListeners();
})();
