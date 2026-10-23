const fs = require('fs')
const path = require('path')
const { nowId } = require('../utils/ids')
const { ensureDir } = require('../utils/fileStore')
const { UPLOADS_DIR } = require('../utils/paths')
const { decodeUploadFileName } = require('../utils/fileName')
const { parseExcelBuffer } = require('./parseExcelService')
const { saveUploadCache } = require('./reportStore')
const { fail } = require('../utils/response')

async function saveUpload(file, userId) {
  const fileName = decodeUploadFileName(file.originalname || '')
  const ext = path.extname(fileName || file.originalname || '').toLowerCase()
  if (!['.xlsx', '.xls'].includes(ext)) {
    throw fail('AI_ERROR', '仅支持 .xlsx / .xls', 400)
  }
  ensureDir(UPLOADS_DIR)
  const fileId = nowId('f')
  const dest = path.join(UPLOADS_DIR, `${fileId}${ext}`)
  fs.writeFileSync(dest, file.buffer)
  const parsed = parseExcelBuffer(file.buffer)
  await saveUploadCache(
    fileId,
    {
      fileId,
      fileName,
      storedPath: dest,
      parsed,
    },
    userId,
  )
  return { fileId, fileName }
}

module.exports = { saveUpload }
