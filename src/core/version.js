// Shared by Node build scripts and the browser bundles. Accept an optional tag prefix.
export function versionParts(value) {
  if (typeof value !== 'string' || !/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) throw new Error('版本号必须为 X.X.X 格式');
  const parts = value.replace(/^v/, '').split('.').map(Number);
  if (parts.join('.') !== value.replace(/^v/, '')) throw new Error('版本号必须为 X.X.X 格式');
  if (parts.some(part => part > 65535) || parts.every(part => part === 0)) throw new Error('版本号各部分必须为 0–65535，且不能全为 0');
  return parts;
}

export function compareVersions(left, right) {
  const a = versionParts(left), b = versionParts(right);
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
  return 0;
}
