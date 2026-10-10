(async () => {
  const platform = App.createChromePlatform();
  const store = App.createSettingsStore(platform);
  await store.init();
  App.createReader(platform, store);
})().catch(error => console.error('AnonTranslator:', error));
