/**
 * Multer/busboy often exposes UTF-8 filenames as latin1-mojibake on Windows.
 * e.g. "企业用电明细.xlsx" → "ä¼ä¸ç´´çµæ°æ®.xlsx"
 */
function decodeUploadFileName(name = '') {
  if (!name || typeof name !== 'string') return ''
  if (/[\u4e00-\u9fff]/.test(name)) return name
  try {
    const decoded = Buffer.from(name, 'latin1').toString('utf8')
    if (decoded.includes('\uFFFD')) return name
    if (/[\u4e00-\u9fff]/.test(decoded)) return decoded
    return name
  } catch {
    return name
  }
}

module.exports = { decodeUploadFileName }
