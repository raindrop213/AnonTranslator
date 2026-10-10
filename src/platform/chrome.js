App.createChromePlatform = () => ({
  servicePermissions: App.chromeServices,
  hasServiceAccess(service, settings) { return chrome.permissions.contains({ origins: App.serviceOrigins(service, settings) }); },
  // Called directly by a popup button, before any await, preserving user activation.
  requestServiceAccess(service, settings) { return chrome.permissions.request({ origins: App.serviceOrigins(service, settings) }); },
  watchServiceAccess(listener) {
    chrome.permissions.onAdded.addListener(listener);
    chrome.permissions.onRemoved.addListener(listener);
    return () => { chrome.permissions.onAdded.removeListener(listener); chrome.permissions.onRemoved.removeListener(listener); };
  },
  async getSettings() {
    const settings = await chrome.runtime.sendMessage({ type: 'getSettings' });
    if (!settings || settings.error) throw new Error(settings?.error || '后台未响应');
    return settings;
  },
  async setSettings(patch) { await chrome.storage.local.set(patch); },
  watchSettings(listener) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      listener(Object.fromEntries(Object.entries(changes).map(([key, change]) => [key, change.newValue])));
    });
  },
  async send(message) {
    const response = await chrome.runtime.sendMessage(message);
    if (!response) throw new Error('后台未响应，请重新加载扩展和页面');
    if (response.error) throw new Error(response.error);
    return response;
  },
  async copy(text) { await navigator.clipboard.writeText(text); }
});
