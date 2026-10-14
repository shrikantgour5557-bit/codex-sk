/* Small DOM helpers for explicit page-text selection; never read editable values. */
(() => {
  function isEditableTarget(node) {
    const element = node?.nodeType === 1 ? node : node?.parentElement;
    return Boolean(element?.closest?.('input,textarea,select,[contenteditable=""],[contenteditable="true"],[contenteditable="plaintext-only"],[role="textbox"],[role="searchbox"],[role="combobox"],[role="spinbutton"]'));
  }
  function captureSelection(selection) {
    if (!selection || selection.isCollapsed || !selection.rangeCount) return '';
    if (isEditableTarget(selection.anchorNode) || isEditableTarget(selection.focusNode)) return '';
    const text = String(selection.toString() || '');
    return text.trim().length > 0 ? text : '';
  }
  function positionFloatingButton(rect, viewport, size) {
    const width = Math.min(size.width, viewport.width - 16);
    const left = Math.max(8, Math.min(rect.left + rect.width / 2 - width / 2, viewport.width - width - 8));
    const above = rect.top - size.height - 8;
    const top = above >= 8 ? above : Math.min(viewport.height - size.height - 8, rect.bottom + 8);
    return { left, top: Math.max(8, top), width };
  }
  const api = { isEditableTarget, captureSelection, positionFloatingButton };
  globalThis.StepPilotSelection = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
