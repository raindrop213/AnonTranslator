chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'getSettings') {
    chrome.storage.local.get(null).then(sendResponse).catch(error => sendResponse({ error: error.message }));
  } else if (['translate', 'cancel_translation', 'vits_audio', 'vits_speakers', 'huosh_audio'].includes(message.action)) {
    if (message.scope) message = { ...message, scope: JSON.stringify([_sender.tab?.id, _sender.frameId, message.scope]) };
    App.handleServiceMessage(message, App.chromeServiceRequest).then(sendResponse).catch(error => sendResponse({ error: error.message }));
  } else return false;
  return true;
});
