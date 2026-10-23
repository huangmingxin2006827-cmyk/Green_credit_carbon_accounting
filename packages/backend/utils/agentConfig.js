function loadAgentConfig() {
  return {
    apiKey: process.env.DASHSCOPE_API_KEY || '',
    timeoutMs: Number(process.env.BAILIAN_TIMEOUT_MS || 300000),
    apps: {
      chat: process.env.DASHSCOPE_APP_ID_CHAT || '',
      report: process.env.DASHSCOPE_APP_ID_REPORT || '',
      suggestion: process.env.DASHSCOPE_APP_ID_SUGGESTION || '',
    },
  }
}

module.exports = { loadAgentConfig }
