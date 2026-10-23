function ok(data, message = 'ok') {
  return { success: true, code: 'OK', message, data }
}

function fail(code, message, httpStatus = 400) {
  const err = new Error(message)
  err.bizCode = code
  err.httpStatus = httpStatus
  err.data = null
  return err
}

function sendFail(res, err) {
  const httpStatus = err.httpStatus || 500
  const code = err.bizCode || 'AI_ERROR'
  res.status(httpStatus).json({
    success: false,
    code,
    message: err.message || 'server error',
    data: null,
  })
}

module.exports = { ok, fail, sendFail }
