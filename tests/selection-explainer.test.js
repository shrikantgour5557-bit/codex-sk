const assert = require('node:assert/strict');
const fs = require('node:fs');
const { captureSelection, positionFloatingButton } = require('../selection-utils.js');

const contentSource = fs.readFileSync(require.resolve('../content.js'), 'utf8');
const workerSource = fs.readFileSync(require.resolve('../background.js'), 'utf8');
assert.match(contentSource, /openTextExplanation\(captured, language, \{ nearbyContext: context \}\)/);
assert.match(contentSource, /STEPPILOT_AI_EXPLAIN/);
assert.match(contentSource, /further-submit/);
assert.match(contentSource, /toggle-language/);
assert.match(contentSource, /copy-explanation/);
assert.match(contentSource, /document\.addEventListener\('selectionchange', scheduleSelectionUpdate\)/);
assert.match(workerSource, /remoteAiConsent/);
assert.match(workerSource, /StepPilotProviderClient\.explain/);
assert.doesNotMatch(workerSource, /providerConfig\?\.|endpointInput|apiKey/i);

function node(selectorMatches) { return { nodeType: 1, closest: selector => selectorMatches && selector.includes(selectorMatches) ? {} : null }; }
function selection(text, anchor = node(null), focus = anchor, collapsed = false) { return { isCollapsed: collapsed, rangeCount: 1, anchorNode: anchor, focusNode: focus, toString: () => text }; }
assert.equal(captureSelection(selection('  selected paragraph  ')), '  selected paragraph  ');
assert.equal(captureSelection(selection('')), '');
assert.equal(captureSelection(selection('selection', node('textarea'))), '');
assert.equal(captureSelection(selection('selection', node('input'))), '');
assert.equal(captureSelection(selection('selection', node('[contenteditable="true"]'))), '');
assert.equal(captureSelection(selection('selection', node(null), node('[role="textbox"]'))), '');
assert.equal(captureSelection(selection('collapsed', node(null), node(null), true)), '');
assert.equal(captureSelection(selection('x'.repeat(20001))), 'x'.repeat(20001));
assert.deepEqual(positionFloatingButton({ left: 100, width: 60, top: 90, bottom: 110 }, { width: 400, height: 300 }, { width: 190, height: 36 }), { left: 35, top: 46, width: 190 });
const edge = positionFloatingButton({ left: 380, width: 30, top: 4, bottom: 18 }, { width: 400, height: 300 }, { width: 190, height: 36 });
assert.ok(edge.left >= 0 && edge.left + edge.width <= 400 && edge.top >= 0);
console.log('selection capture and fixed-backend integration checks passed');
