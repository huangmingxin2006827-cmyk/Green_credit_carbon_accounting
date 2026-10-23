const { getReport } = require('./reportStore')
const { streamChat } = require('../agents/chatAgent')
const { fail } = require('../utils/response')

async function knowledgeChat({ message, history, onText }) {
  if (!message) throw fail('AI_ERROR', '缺少 message', 400)
  return streamChat({
    question: message,
    history: history || [],
    report: null,
    benchmark: null,
    onText,
  })
}

async function reportQuestion({ reportId, question, history, onText, userId }) {
  if (!question) throw fail('AI_ERROR', '缺少 question', 400)
  const report = await getReport(reportId, userId)
  return streamChat({
    question,
    history: history || [],
    report,
    benchmark: report.benchmark || null,
    onText,
  })
}

module.exports = { knowledgeChat, reportQuestion }
