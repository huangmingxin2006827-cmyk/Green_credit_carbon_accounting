const { sendFail } = require('../utils/response')

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    next(err)
    return
  }
  console.error('[error]', err.bizCode || err.name, err.message)
  sendFail(res, err)
}

module.exports = errorHandler
