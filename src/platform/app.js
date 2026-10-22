import { createSettingsStore } from '../settings/settings.js';
import { isReaderUIFrame, mountReaderSession } from '../reader/reader.js';
import { topDocument } from '../reader/geometry.js';
import { resolveSiteURL } from '../settings/site-access.js';
import { mountSettingsWidget } from '../settings/widget.js';
import { createSiteUI } from './site-ui.js';
import readerCSS from '../reader/reader.css';

// Both distributions use this lifecycle and the same in-page glass panel.
export async function startApp(platform, doc = document) {
  if (isReaderUIFrame(doc) || topDocument(doc) !== doc) return;
  // Chromium exposes the top ancestor origin even in cross-origin / opaque
  // chapter frames. Their reading lifecycle belongs to the visible website.
  platform.siteURL = resolveSiteURL({ url: doc.location?.href || platform.siteURL,
    ancestorOrigins: Array.from(doc.location?.ancestorOrigins || []), referrer: doc.referrer,
    isTop: doc.defaultView === doc.defaultView.top });
  const store = createSettingsStore(platform);
  await store.init();
  const reader = mountReaderSession(platform, store, doc, readerCSS);
  const ui = doc.defaultView === doc.defaultView.top ? createSiteUI(store, () => mountSettingsWidget(store, platform, doc)) : null;
  await ui?.ready;
  return { store, openSettings() { return ui?.open(); }, destroy() { ui?.destroy(); reader.destroy(); store.destroy?.(); } };
}
