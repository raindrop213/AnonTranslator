let updateCache = null;
function checkForUpdate(request, force = false) {
  // Only settings opening triggers a check. Share pending work and cache successful checks for five minutes.
  if (updateCache && (updateCache.pending || (!force && updateCache.expires > Date.now()))) return updateCache.promise;
  const entry = { pending: true, expires: 0 };
  entry.promise = (async () => {
    let data;
    try {
      const response = await request(App.release.api, { timeout: 8000, headers: { Accept: 'application/vnd.github+json' } });
      data = await response.json();
    } catch (error) {
      if (error.status === 404) return { state: 'unpublished', url: App.release.listing };
      throw error;
    }
    if (data.draft || data.prerelease) throw new Error('未获取到正式发布版本');
    const version = versionParts(data.tag_name).join('.');
    const comparison = compareVersions(version, App.version);
    // Use our own repository URL rather than a URL supplied by the API response.
    return { state: comparison > 0 ? 'available' : 'current', version, url: App.release.page };
  })().then(result => {
    entry.pending = false; entry.expires = Date.now() + 300000;
    return result;
  }).catch(error => {
    if (updateCache === entry) updateCache = null;
    throw error;
  });
  updateCache = entry;
  return entry.promise;
}
Object.assign(App, { compareVersions, checkForUpdate });
