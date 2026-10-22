import { createChromePlatform } from './chrome.js';
import { startApp } from './app.js';

const ready = startApp(createChromePlatform());
chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message.action !== 'open_settings') return false;
  ready.then(async app => { await app?.openSettings(); respond({ opened: Boolean(app) }); }).catch(error => respond({ error: error.message }));
  return true;
});
ready.catch(error => console.error('AnonTranslator:', error));
