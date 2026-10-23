/** Recover Chinese filenames that arrived as latin1-mojibake (e.g. ä¼ä¸…xlsx). */
export function decodeUploadFileName(name = '') {
  if (!name || typeof name !== 'string') return ''
  if (/[\u4e00-\u9fff]/.test(name)) return name
  try {
    const bytes = Uint8Array.from(name, (ch) => ch.charCodeAt(0) & 0xff)
    const decoded = new TextDecoder('utf-8').decode(bytes)
    if (decoded.includes('\uFFFD')) return name
    if (/[\u4e00-\u9fff]/.test(decoded)) return decoded
    return name
  } catch {
    return name
  }
}
