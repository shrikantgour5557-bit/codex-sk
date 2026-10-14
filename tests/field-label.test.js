const assert = require('node:assert/strict');
const { detectField } = require('../field-label.js');
const { interpretField } = require('../guidance.js');

const CONTROL_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
function matchesSimple(node, selector) {
  if (selector === '*') return true;
  if (selector === 'label') return node.tagName === 'LABEL';
  if (selector === 'input,textarea,select,[contenteditable="true"],[role="textbox"]') return CONTROL_TAGS.has(node.tagName) || node.attrs.role === 'textbox';
  const role = selector.match(/^\[role="([^"]+)"\]$/); if (role) return node.attrs.role === role[1];
  const attr = selector.match(/^\[([^=]+)="([^"]+)"\]$/); if (attr) return node.attrs[attr[1]] === attr[2];
  if (CONTROL_TAGS.has(node.tagName)) return selector === node.tagName.toLowerCase();
  return false;
}
class TextNode {
  constructor(text) { this.nodeType = 3; this.nodeValue = text; this.parentElement = null; }
}
class Element {
  constructor(tag, attrs = {}, text = '', rect = { left: 0, right: 80, top: 0, bottom: 30 }) {
    this.nodeType = 1; this.tagName = tag.toUpperCase(); this.attrs = { ...attrs }; this.childNodes = []; this.children = [];
    this.parentElement = null; this.ownerDocument = null; this.style = {}; this.hidden = false; this.rect = rect;
    this.required = Object.hasOwn(attrs, 'required'); this.maxLength = Number(attrs.maxlength || -1);
    if (text) this.append(new TextNode(text));
  }
  append(...nodes) {
    for (const node of nodes) {
      node.parentElement = this; node.ownerDocument = this.ownerDocument; this.childNodes.push(node);
      if (node.nodeType === 1) { this.children.push(node); node.setDocument(this.ownerDocument); }
    }
    return this;
  }
  setDocument(doc) { this.ownerDocument = doc; for (const node of this.childNodes) { node.ownerDocument = doc; node.nodeType === 1 && node.setDocument(doc); } }
  getAttribute(name) { return this.attrs[name] ?? null; }
  hasAttribute(name) { return Object.hasOwn(this.attrs, name); }
  matches(selector) { return selector.split(',').some(part => matchesSimple(this, part.trim())); }
  querySelectorAll(selector) {
    const found = [];
    const visit = node => { for (const child of node.children || []) { if (child.matches(selector)) found.push(child); visit(child); } };
    visit(this); return found;
  }
  getClientRects() { return this.hidden ? [] : [this.rect]; }
  getBoundingClientRect() { return this.rect; }
  getRootNode() { return this.ownerDocument; }
  get id() { return this.attrs.id || ''; }
  get htmlFor() { return this.attrs.for || ''; }
  get textContent() { return this.childNodes.map(n => n.nodeType === 3 ? n.nodeValue : n.textContent).join(' '); }
}
class Document extends Element {
  constructor() { super('document'); this.nodeType = 9; this.ownerDocument = this; }
  setDocument() {}
  getRootNode() { return this; }
  getElementById(id) { return this.querySelectorAll('*').find(node => node.id === id) || null; }
}
class ShadowRoot extends Element {
  constructor(host, doc) { super('shadow-root'); this.nodeType = 11; this.host = host; this.ownerDocument = doc; }
  getRootNode() { return this; }
}
function makeField(labelText, attrs = {}, placement = 'above') {
  const doc = new Document();
  const form = new Element('form'); doc.append(form);
  const row = new Element('div', { class: placement === 'left' ? 'grid-row' : 'field-row' }); form.append(row);
  const field = new Element(attrs.tag || 'input', attrs, '', { left: 220, right: 360, top: 40, bottom: 72 });
  if (placement === 'left') row.append(new Element('div', { class: 'field-label' }, labelText, { left: 20, right: 190, top: 42, bottom: 70 }), new Element('div').append(field));
  else if (placement === 'below') row.append(field, new Element('div', { class: 'field-label' }, labelText, { left: 220, right: 360, top: 80, bottom: 105 }));
  else row.append(new Element('div', { class: 'field-label' }, labelText, { left: 220, right: 360, top: 2, bottom: 28 }), field);
  field.setDocument(doc);
  return { doc, field, row };
}

// Explicit native labels win and provide the exact selected field's name.
{
  const { doc, field } = makeField('First Name', { id: 'first', name: 'first_name', placeholder: 'Given name' });
  // Replace the nearby label with a proper for/id association.
  const explicit = new Element('label', { for: 'first' }, 'First Name'); doc.append(explicit); field.labels = [explicit];
  field.attrs['aria-label'] = 'Email';
  const info = detectField(field);
  assert.equal(info.label, 'First Name');
  assert.equal(info.source, 'label');
  assert.match(interpretField(info).what, /given \(first\) name/i, 'First Name selects given-name guidance');
}

// An internal control in an open shadow root can inherit its custom host's accessible name.
{
  const doc = new Document();
  const host = new Element('div', { role: 'combobox', 'aria-label': 'Business name' }); doc.append(host);
  const root = new ShadowRoot(host, doc);
  const inner = new Element('input', { type: 'text' }); root.append(inner); inner.root = root;
  inner.getRootNode = () => root;
  const info = detectField(inner);
  assert.equal(info.label, 'Business name');
  assert.match(interpretField(info).what, /company or organization/i);
}

// ARIA label, ARIA labelled-by, placeholder, and title follow the stated priority.
{
  const doc = new Document();
  const name = new Element('span', { id: 'city-name' }, 'City'); doc.append(name);
  const field = new Element('input', { id: 'city', 'aria-labelledby': 'city-name', placeholder: 'Town', title: 'Location' }); doc.append(field);
  assert.equal(detectField(field).label, 'City');
  const aria = new Element('input', { 'aria-label': 'Company' }); doc.append(aria);
  assert.equal(detectField(aria).label, 'Company');
  const placeholder = new Element('input', { placeholder: 'Website URL' }); doc.append(placeholder);
  assert.equal(detectField(placeholder).label, 'Website URL');
  const title = new Element('input', { title: 'Daily budget' }); doc.append(title);
  assert.equal(detectField(title).label, 'Daily budget');
  const externalLabel = new Element('label', { for: 'external' }, 'Company'); doc.append(externalLabel);
  const external = new Element('input', { id: 'external' }); doc.append(external); external.labels = [];
  assert.equal(detectField(external).label, 'Company', 'label[for] is resolved for the exact field id');
}

// Layout heuristics identify labels on the left, above, below, and in table rows.
for (const placement of ['left', 'above', 'below']) {
  const { field } = makeField('City', { name: `city_${placement}` }, placement);
  const info = detectField(field);
  assert.equal(info.label, 'City', `${placement} label should be detected`);
  assert.match(interpretField(info).what, /city or town/i, `selecting the ${placement} City field should produce City guidance`);
}
{
  const doc = new Document(); const row = new Element('tr'); const th = new Element('th', {}, 'Final URL'); const cell = new Element('td');
  const field = new Element('input', { type: 'url', name: 'final_url' }, '', { left: 200, right: 350, top: 10, bottom: 40 });
  cell.append(field); row.append(th, cell); doc.append(row); field.setDocument(doc);
  const info = detectField(field);
  assert.equal(info.label, 'Final URL');
  assert.equal(info.source, 'nearby');
  assert.match(interpretField(info).what, /full URL.*relevant webpage/i, 'Final URL selects landing-page guidance');
}

// Required/optional metadata and visible helper text are surfaced without touching values.
{
  const doc = new Document(); const help = new Element('span', { id: 'help' }, 'Briefly describe your campaign.'); doc.append(help);
  const field = new Element('textarea', { 'aria-label': 'Campaign description (optional)', 'aria-describedby': 'help', maxlength: '120' }); doc.append(field);
  const info = detectField(field);
  assert.equal(info.optional, true);
  assert.equal(info.maxLength, 120);
  assert.match(info.help, /Briefly describe/);
}

// A sensitive control can be identified for a privacy message without reading its value.
{
  const field = new Element('input', { id: 'card', name: 'card_number', autocomplete: 'cc-number' });
  Object.defineProperty(field, 'value', { get() { throw new Error('value must never be read'); } });
  const info = detectField(field);
  assert.equal(info.sensitive, true);
  assert.equal(info.label, '');
}

// A newly rendered control is resolved from that exact node; detection does not use a page-wide first field.
{
  const doc = new Document();
  const first = new Element('input', { 'aria-label': 'First Name' });
  const city = new Element('input', { 'aria-label': 'City' });
  doc.append(first, city);
  assert.match(interpretField(detectField(first)).what, /given \(first\) name/i);
  assert.match(interpretField(detectField(city)).what, /city or town/i);
  assert.match(interpretField(detectField(city)).what, /name of your city/i, 'City selects city guidance');
  const dynamic = new Element('input', { 'aria-label': 'Business name' });
  doc.append(dynamic);
  assert.match(interpretField(detectField(dynamic)).what, /company or organization/i);
}

// Neighboring field labels provide the personal context needed to resolve "Title".
{
  const doc = new Document();
  const fields = [];
  for (const [id, labelText] of [['salutation','Title'], ['given','First Name'], ['middle','Middle Initial'], ['family','Last Name']]) {
    const label = new Element('label', { for:id }, labelText);
    const field = new Element('input', { id, name:id });
    field.labels = [label];
    doc.append(label, field);
    fields.push(field);
  }
  const info = detectField(fields[0]);
  assert.match(info.related, /First Name/);
  assert.match(info.related, /Middle Initial/);
  assert.match(interpretField(info).what, /title or salutation/i);
  assert.equal(interpretField(info).needsClarification, false);
}

console.log('Label detector checks passed: explicit and ARIA labels, placeholder/title, left/above/below/table layouts, optional/help metadata, and sensitive-value non-access.');
