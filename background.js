// MV3 service worker: the context menu only forwards explicitly selected text
// to the existing content script. Explanation itself happens locally in content.js.
const MENU_ID = 'steppilot-explain-selected-text';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: MENU_ID, title: 'Explain selected text', contexts: ['selection'] });
  });
  // Remove preferences left by older remote-provider and local-model builds.
  chrome.storage.local.remove(['remoteAiConsent', 'providerConfig', 'remoteAiEnabled', 'localModel', 'ollamaEndpoint', 'ollamaModel']);
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id || typeof info.selectionText !== 'string' || !info.selectionText.trim()) return;
  let preferences = { language: 'auto', voiceEnabled: false, voicePreferences: null };
  try {
    const stored = await chrome.storage.local.get(['language', 'voiceEnabled', 'voicePreferences']);
    preferences = { ...preferences, ...stored };
  } catch { /* The content script retains safe defaults if storage is unavailable. */ }
  const message = {
    type: 'STEPPILOT_EXPLAIN_SELECTION',
    selectedText: info.selectionText,
    language: preferences.language,
    voiceEnabled: preferences.voiceEnabled === true,
    voicePreferences: preferences.voicePreferences
  };
  try {
    await chrome.tabs.sendMessage(tab.id, message);
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['guidance.js', 'field-label.js', 'voice-guide.js', 'selection-utils.js', 'runtime-messaging.js', 'text-explainer.js', 'content.js']
      });
      await chrome.tabs.sendMessage(tab.id, message);
    } catch { /* Restricted pages and navigated tabs cannot receive this action. */ }
  }
});
