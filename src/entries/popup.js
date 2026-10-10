(async () => {
  const platform = App.createChromePlatform();
  const store = App.createSettingsStore(platform);
  await store.init();
  App.mountSettings(document.body, store, platform);
})().catch(error => { document.body.textContent = `设置加载失败: ${error.message}`; });
