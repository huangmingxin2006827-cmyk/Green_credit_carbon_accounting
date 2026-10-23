const { ok } = require('../utils/response')
const { saveUpload } = require('../services/uploadService')

async function upload(req, res, next) {
  try {
    if (!req.file) {
      const err = new Error('请上传 Excel 文件')
      err.bizCode = 'AI_ERROR'
      err.httpStatus = 400
      throw err
    }
    const data = await saveUpload(req.file, req.user.id)
    res.json(ok(data))
  } catch (err) {
    next(err)
  }
}

module.exports = { upload }
