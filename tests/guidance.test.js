const assert = require('node:assert/strict');
const fs = require('node:fs');
const { interpretField } = require('../guidance.js');
const run = (label, extra = {}, language = 'en') => interpretField({ label, ...extra }, language);

const cases = [
  ['Title', { related:'First Name · Middle Initial · Last Name' }, 'title', /salutation/i],
  ['First Name', {}, 'firstName', /given \(first\) name/i],
  ['Middle Name', {}, 'middleName', /middle name in full/i],
  ['Middle Initial', {}, 'middleInitial', /first letter.*not the full middle name/i],
  ['Last Name / Surname', {}, 'lastName', /surname or family name/i],
  ['Full Name', {}, 'fullName', /complete name/i],
  ['Company / Organization', {}, 'company', /company or organization/i],
  ['Position', {}, 'position', /job title or role/i],
  ['Address Line 1', {}, 'address1', /main street address/i],
  ['Address Line 2', { optional:true }, 'address2', /apartment, flat, unit/i],
  ['City', {}, 'city', /city or town/i],
  ['State / Province', {}, 'state', /state, province, or region/i],
  ['Country', { tagName:'SELECT' }, 'country', /select the country/i],
  ['ZIP', {}, 'postal', /postal code/i],
  ['Date of Birth', { type:'date' }, 'dob', /date of birth.*not your current age/i],
  ['Age', { type:'number' }, 'age', /your age/i],
  ['Email', { type:'email' }, 'email', /email address/i],
  ['Phone', { type:'tel' }, 'phone', /phone number/i],
  ['Website URL', { type:'url' }, 'url', /full URL/i],
  ['Customer Account ID', {}, 'accountId', /account or record identifier/i],
  ['Start Date', { type:'date' }, 'date', /date named by this field/i],
  ['Conversion Percentage', {}, 'percent', /percentage or rate/i],
  ['Quantity', { type:'number' }, 'quantity', /count or quantity/i],
  ['Payment Amount', { type:'number' }, 'amount', /amount requested/i],
  ['Resume Upload', { type:'file', accept:'.pdf' }, 'file', /document or file/i],
  ['Application Status', { tagName:'SELECT', options:['New','In progress'] }, 'choice', /select the option/i]
];
for (const [label, extra, meaning, expected] of cases) {
  const result = run(label, extra);
  assert.equal(result.concept, meaning, label + ' meaning');
  assert.equal(result.needsClarification, false, label + ' is confidently interpreted');
  assert.match(result.what, expected, label + ' actionable explanation');
}

const initial = run('Middle Initial');
assert.match(initial.what, /first letter of your middle name/i);
assert.doesNotMatch(initial.what, /enter your middle name in full/i);
assert.equal(run('Middle Initial').example, 'S');
assert.notEqual(run('Full Name').what, run('First Name').what, 'Full Name differs from First Name');

const personalTitle = run('Title', { related:'First Name · Middle Initial · Last Name' });
assert.match(personalTitle.what, /salutation/i);
assert.equal(personalTitle.confidence, 'high');
const jobTitle = run('Title', { related:'Company · Position · Department' });
assert.equal(jobTitle.concept, 'position');
assert.match(jobTitle.what, /job title or role/i);
const unclearTitle = run('Title');
assert.equal(unclearTitle.needsClarification, true);
assert.match(unclearTitle.what, /salutation.*job title.*document\/item title/i);

const contextual = run('Campaign destination', { help:'Enter the website URL visitors should reach after an ad click.' });
assert.equal(contextual.concept, 'url');
assert.equal(contextual.confidence, 'moderate');
assert.match(contextual.what, /full URL/i);
const ambiguous = run('Customer reference');
assert.equal(ambiguous.needsClarification, true);
assert.match(ambiguous.what, /not specific enough/i);
const unlabeled = run('', { type:'text' });
assert.equal(unlabeled.needsClarification, true);
assert.match(unlabeled.what, /No label or nearby instruction/i);
const leftLabel = run('Middle Initial', { source:'nearby', context:'Personal details', related:'First Name · Last Name' });
assert.match(leftLabel.what, /first letter/i);
const conflict = run('First Name', { help:'Enter your email address here.' });
assert.equal(conflict.needsClarification, true);
assert.match(conflict.what, /hints conflict/i);

const hindi = run('Middle Initial', {}, 'hi');
assert.match(hindi.what, /पहला अक्षर/);
assert.match(run('Title', { related:'First Name · Middle Initial · Last Name' }, 'hi').what, /salutation/);
assert.match(run('City', {}, 'hi').what, /शहर/);
assert.equal(run('Password', { type:'password' }).sensitive, true);

for (const file of ['contact-form.html','google-ads-campaign.html','universal-detection.html']) {
  assert.ok(fs.readFileSync('tests/fixtures/' + file, 'utf8').length > 100, file + ' fixture exists');
}
console.log('Field interpretation checks passed: requested labels, Title context, middle initial/full name distinction, ambiguity, conflicts, language, and fixtures.');
