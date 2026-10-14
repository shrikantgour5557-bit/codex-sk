const assert = require('node:assert/strict');
const { explain, glossary, maxLength } = require('../text-explainer.js');

const passage = 'We deliver cutting-edge software solutions that drive growth and innovation. With 10+ years of expertise, 100+ expert engineers, and 150+ successful projects, we help businesses transform digitally and achieve their goals.';

for (const language of ['en', 'hi', 'hinglish']) {
  const result = explain(passage, { language });
  assert.equal(result.status, 'ready', `${language} should explain the selected paragraph`);
  assert.equal(result.engine, 'local');
  assert.equal(result.language, language);
  assert.ok(result.simpleExplanation.length > 30);
  assert.ok(result.detailedExplanation.includes('10+ years of expertise'));
  assert.ok(result.detailedExplanation.includes('100+ expert engineers'));
  assert.ok(result.detailedExplanation.includes('150+ successful projects'));
  assert.match(result.example, /Illustration/i, 'example must be labeled as an illustration');
  assert.match(result.example, /hypothetical|काल्पनिक/i);
  assert.ok(result.summary.length > 20);
}

const english = explain(passage, { language: 'en' });
assert.match(english.simpleExplanation, /businesses grow|grow, innovate/i);
assert.match(english.importantTerms.map(term => term.term).join(' '), /EXPERTISE/);
assert.match(english.importantTerms.map(term => term.term).join(' '), /DIGITAL TRANSFORMATION/);
assert.match(english.importantTerms.map(term => term.term).join(' '), /CUTTING-EDGE/);
assert.match(english.importantTerms.find(term => term.term === 'EXPERTISE').explanation, /specialized knowledge or skill/i);
assert.match(english.importantTerms.find(term => term.term === 'DIGITAL TRANSFORMATION').explanation, /digital technology/i);
assert.ok(glossary.expertise && glossary['digital transformation']);
assert.equal(maxLength, 20000);

const normalized = explain('  We deliver\u00a0 modern\u2011software.\n\nWe help teams.  ', { language: 'en' });
assert.equal(normalized.status, 'ready');
assert.match(normalized.summary, /modern-software/);
assert.equal(explain('', { language: 'hi' }).status, 'empty');
console.log('Local text explainer regression tests passed');
