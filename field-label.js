/* Reusable, value-free label and helper-text detection for native/custom controls. */
(() => {
  const CONTROL_SELECTOR = 'input,textarea,select,[contenteditable="true"],[role="textbox"],[role="combobox"],[role="searchbox"],[role="spinbutton"],[role="checkbox"],[role="radio"],[role="switch"],[tabindex]:not([tabindex="-1"])[aria-label],[tabindex]:not([tabindex="-1"])[aria-labelledby]';
  const SENSITIVE = /password|passcode|one.?time.?code|\botp\b|credit.?card|card.?number|\bcc.?number\b|\bcvv\b|\bcvc\b|cc.?csc|security.?code|social.?security|\bssn\b|national.?id|identity.?number|passport|driver.?s.?licen[sc]e|tax.?id|bank.?account|routing.?number|\biban\b|aadhaar/i;

  function attr(node, name) { return node?.getAttribute?.(name) || ''; }
  function list(node, selector) {
    try { return node?.querySelectorAll ? [...node.querySelectorAll(selector)] : []; }
    catch { return []; }
  }
  function isVisible(node) {
    if (!node || node.hidden || attr(node, 'aria-hidden') === 'true') return false;
    for (let item = node; item?.nodeType === 1; item = item.parentElement) {
      if (item.hidden || attr(item, 'aria-hidden') === 'true') return false;
      if (item.style?.display === 'none' || item.style?.visibility === 'hidden') return false;
    }
    return typeof node.getClientRects !== 'function' || node.getClientRects().length > 0;
  }
  function textWithoutValues(node) {
    if (!node) return '';
    if (node.nodeType === 3) return node.nodeValue || '';
    if (node.nodeType !== 1 || attr(node, 'aria-hidden') === 'true' || node.matches?.(CONTROL_SELECTOR)) return '';
    return [...(node.childNodes || [])].map(textWithoutValues).join(' ').replace(/\s+/g, ' ').trim();
  }
  function visibleText(node) { return isVisible(node) ? textWithoutValues(node) : ''; }
  function rootFor(node) {
    const root = node?.getRootNode?.();
    return root?.getElementById ? root : node?.ownerDocument;
  }
  function idRefs(node, attribute, allowHidden = false) {
    const root = rootFor(node);
    return attr(node, attribute).split(/\s+/).filter(Boolean)
      .map(id => root?.getElementById?.(id) || node.ownerDocument?.getElementById?.(id))
      .filter(target => target && (allowHidden || isVisible(target))).map(target => allowHidden ? textWithoutValues(target) : visibleText(target)).filter(Boolean).join(' ');
  }
  function explicitLabels(field) {
    const native = field.labels ? [...field.labels] : [];
    const id = field.id || attr(field, 'id');
    if (!native.length && id) {
      const doc = field.ownerDocument;
      native.push(...list(doc, 'label').filter(label => (label.htmlFor || attr(label, 'for')) === id));
      const root = field.getRootNode?.();
      if (root && root !== doc) native.push(...list(root, 'label').filter(label => (label.htmlFor || attr(label, 'for')) === id));
    }
    return [...new Set(native)].map(textWithoutValues).filter(Boolean);
  }
  function rect(node) {
    try { return node.getBoundingClientRect?.(); } catch { return null; }
  }
  function hasControl(node) { return node.matches?.(CONTROL_SELECTOR) || list(node, CONTROL_SELECTOR).length > 0; }
  function isLabelLike(node) {
    if (node.nodeType !== 1) return false;
    const cue = `${node.tagName || ''} ${attr(node, 'class')} ${attr(node, 'id')} ${attr(node, 'data-label')}`;
    return /label|legend|field.?name|field.?title|form.?title|^TH\b|^DT\b/i.test(cue) || node.tagName === 'LABEL' || node.tagName === 'LEGEND';
  }
  function geometryScore(candidate, field) {
    const a = rect(candidate), b = rect(field);
    if (!a || !b) return -100;
    const dx = Math.max(0, a.left - b.right, b.left - a.right);
    const dy = Math.max(0, a.top - b.bottom, b.top - a.bottom);
    const distance = Math.hypot(dx, dy);
    if (distance > 420) return -100;
    const aligned = (a.left < b.left && a.right <= b.left + 30) || (a.top < b.top && a.bottom <= b.top + 35) || (a.right > b.right && a.left >= b.right - 30) || (a.bottom > b.bottom && a.top >= b.bottom - 35);
    return (aligned ? 28 : 0) - Math.round(distance / 18);
  }
  function nearbyLabel(field) {
    let branch = field, ancestor = field.parentElement, depth = 0;
    while (ancestor && depth < 6) {
      let best = null;
      const siblings = [...(ancestor.children || [])].filter(node => node !== branch);
      const candidates = [];
      for (const sibling of siblings) {
        if (hasControl(sibling) || !isVisible(sibling)) continue;
        const text = visibleText(sibling);
        if (!text || text.length > 180) continue;
        candidates.push({ node: sibling, text, semantic: isLabelLike(sibling), sibling: true });
      }
      // Plain text nodes beside a control are common in compact and hand-built forms.
      for (const child of ancestor.childNodes || []) {
        if (child === branch || child.nodeType !== 3) continue;
        const text = String(child.nodeValue || '').replace(/\s+/g, ' ').trim();
        if (text && text.length <= 100) candidates.push({ node: child, text, semantic: false, sibling: true });
      }
      // A table row and fieldset carry reliable group relationships, including labels in adjacent cells.
      const structural = ancestor.tagName === 'TR' || ancestor.tagName === 'FIELDSET' || attr(ancestor, 'role') === 'row' || attr(ancestor, 'role') === 'group';
      const controlCount = (ancestor.matches?.(CONTROL_SELECTOR) ? 1 : 0) + list(ancestor, CONTROL_SELECTOR).length;
      for (const candidate of candidates) {
        const geometry = geometryScore(candidate.node, field);
        const score = (candidate.semantic ? 78 : 0) + (structural ? 34 : 0) + geometry + (candidate.sibling ? 24 : 0) - depth * 7;
        if (!best || score > best.score) best = { ...candidate, score, geometry, controlCount };
      }
      // Do not search a whole page/form for an unrelated phrase. Ancestor candidates are only accepted
      // when they have strong label semantics or are close in the rendered layout.
      if (best && ((best.semantic && best.controlCount === 1) || (best.geometry >= 0 && best.score >= 28))) return best.text;
      branch = ancestor;
      ancestor = ancestor.parentElement;
      depth++;
    }
    return '';
  }
  function helperText(field) {
    const ids = [attr(field, 'aria-description'), idRefs(field, 'aria-describedby'), idRefs(field, 'aria-errormessage'), idRefs(field, 'aria-details'), visibleMessages(field)].filter(Boolean);
    return [...new Set(ids)].join(' ');
  }
  function semanticContext(field) {
    const parts = [];
    let node = field;
    for (let depth = 0; node && depth < 6; depth++, node = node.parentElement) {
      if (node.tagName === 'FIELDSET') {
        const legend = list(node, 'legend')[0]; if (legend) parts.push(visibleText(legend));
      }
      if (node.tagName === 'TR') {
        for (const cell of list(node, 'th')) { const value = visibleText(cell); if (value) parts.push(value); }
      }
      if (node.tagName === 'FORM' || /section|group|step|panel|card|form/i.test(`${attr(node,'class')} ${attr(node,'role')}`)) {
        for (const candidate of list(node, 'h1,h2,h3,h4,legend,[role="heading"]')) {
          const value = visibleText(candidate);
          if (value && value.length < 160) parts.push(value);
        }
      }
      if (node === field?.ownerDocument?.body) break;
    }
    const seen = new Set();
    return parts.map(x => x.trim()).filter(x => x && !seen.has(x) && seen.add(x)).slice(0, 5).join(' · ');
  }
  function relatedFields(field) {
    // Related names around the exact control help disambiguate terms such as
    // "Title". Read labels and attributes only; never read control values.
    const root = field?.getRootNode?.();
    const fieldForm = field.closest?.('form') || null;
    const controls = list(root, CONTROL_SELECTOR).filter(item => {
      const type = attr(item, 'type').toLowerCase();
      return isVisible(item) && !['hidden','submit','reset','button','image'].includes(type) && (!fieldForm || item.closest?.('form') === fieldForm);
    });
    const index = controls.indexOf(field);
    if (index >= 0) {
      const nearby = controls.slice(Math.max(0, index - 4), index).concat(controls.slice(index + 1, index + 5));
      const labels = nearby.map(item => explicitLabels(item)[0] || attr(item,'aria-label') || idRefs(item,'aria-labelledby',true) || attr(item,'placeholder') || attr(item,'name')).filter(Boolean);
      if (labels.length) return [...new Set(labels)].join(' · ');
    }
    let node = field.parentElement;
    for (let depth = 0; node && depth < 4; depth++, node = node.parentElement) {
      const siblings = [ ...(node.matches?.(CONTROL_SELECTOR) ? [node] : []), ...list(node, CONTROL_SELECTOR) ].filter(item => item !== field);
      const labels = siblings.map(item => explicitLabels(item)[0] || attr(item,'aria-label') || attr(item,'placeholder') || attr(item,'name')).filter(Boolean);
      if (labels.length) return [...new Set(labels)].slice(0, 8).join(' · ');
    }
    return '';
  }
  function visibleMessages(field) {
    let ancestor = field.parentElement;
    for (let depth = 0; ancestor && depth < 4; depth++, ancestor = ancestor.parentElement) {
      const fieldCount = (ancestor.matches?.(CONTROL_SELECTOR) ? 1 : 0) + list(ancestor, CONTROL_SELECTOR).length;
      if (fieldCount > 1) break;
      const messages = list(ancestor, '[role="alert"],[aria-live="polite"],[aria-live="assertive"]')
        .filter(isVisible).map(visibleText).filter(Boolean);
      if (messages.length) return messages.join(' ');
    }
    return '';
  }
  function detectField(field) {
    if (!field) return null;
    const shadowHost = field.getRootNode?.()?.host || null;
    const labels = explicitLabels(field);
    if (!labels.length && shadowHost) labels.push(...explicitLabels(shadowHost));
    const ariaLabel = (attr(field, 'aria-label') || attr(shadowHost, 'aria-label')).trim();
    const ariaLabelledBy = idRefs(field, 'aria-labelledby', true) || idRefs(shadowHost, 'aria-labelledby', true);
    const placeholder = (attr(field, 'placeholder') || attr(shadowHost, 'placeholder')).trim();
    const title = (attr(field, 'title') || attr(shadowHost, 'title')).trim();
    const help = [helperText(field), shadowHost && helperText(shadowHost)].filter(Boolean).join(' ');
    const context = nearbyLabel(field) || (shadowHost && nearbyLabel(shadowHost)) || '';
    const name = labels[0] || ariaLabel || ariaLabelledBy || placeholder || title || context || '';
    const section = semanticContext(field);
    const related = relatedFields(field);
    const metadata = [name, ariaLabel, ariaLabelledBy, placeholder, title, attr(field, 'name'), attr(field, 'id'), attr(field, 'autocomplete'), help, context, section].join(' ');
    const requiredCue = /\brequired\b|mandatory|आवश्यक|अनिवार्य/i.test(`${labels.join(' ')} ${context} ${help}`) || /\*\s*$/.test(labels.join(' '));
    const required = field.required === true || shadowHost?.required === true || attr(field, 'aria-required') === 'true' || attr(shadowHost, 'aria-required') === 'true' || field.hasAttribute?.('required') === true || requiredCue;
    const optional = /\boptional\b|not required|if applicable|leave (this )?blank|वैकल्पिक|ज़रूरी नहीं|जरूरी नहीं|लागू हो/i.test(`${name} ${help}`) || attr(field, 'aria-required') === 'false' || attr(shadowHost, 'aria-required') === 'false';
    const type = (attr(field, 'type') || attr(field, 'role') || attr(shadowHost, 'type') || attr(shadowHost, 'role')).toLowerCase();
    const maxLength = Number(field.maxLength || shadowHost?.maxLength) > 0 ? Number(field.maxLength || shadowHost.maxLength) : 0;
    const sensitive = SENSITIVE.test(`${metadata} ${attr(shadowHost, 'name')} ${attr(shadowHost, 'id')} ${attr(shadowHost, 'autocomplete')}`) || type === 'password';
    return {
      element: field, label: name, source: labels.length ? 'label' : ariaLabel ? 'aria-label' : ariaLabelledBy ? 'aria-labelledby' : placeholder ? 'placeholder' : title ? 'title' : context ? 'nearby' : '',
      labels, ariaLabel, ariaLabelledBy, placeholder, title, help, context, section, related, type,
      tagName: field.tagName || '', nameAttribute: attr(field, 'name'), id: attr(field, 'id'),
      inputType: (attr(field, 'type') || '').toLowerCase(), accept: attr(field, 'accept'),
      autocomplete: attr(field, 'autocomplete'), pattern: attr(field, 'pattern') ? true : false,
      step: attr(field, 'step'), multiple: field.multiple === true || field.hasAttribute?.('multiple') === true,
      options: field.tagName === 'SELECT' ? list(field, 'option').map(visibleText).filter(Boolean).slice(0, 12) : [],
      required, optional, maxLength, min: attr(field, 'min'), max: attr(field, 'max'),
      invalid: attr(field, 'aria-invalid') === 'true' || attr(shadowHost, 'aria-invalid') === 'true', sensitive
    };
  }

  const api = { detectField, isVisible, visibleText };
  globalThis.StepPilotFieldLabels = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
