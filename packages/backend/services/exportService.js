const fs = require('fs')
const path = require('path')
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  ShadingType,
  LevelFormat,
} = require('docx')
const PDFDocument = require('pdfkit')
const { getReport, upsertReport } = require('./reportStore')
const { REPORTS_DIR } = require('../utils/paths')
const { ensureDir } = require('../utils/fileStore')
const { fail } = require('../utils/response')

const YAHEI = 'Microsoft YaHei'

const TABLE_BORDERS = {
  top: { style: 'single', size: 4, color: '94A3B8' },
  bottom: { style: 'single', size: 4, color: '94A3B8' },
  left: { style: 'single', size: 4, color: '94A3B8' },
  right: { style: 'single', size: 4, color: '94A3B8' },
  insideHorizontal: { style: 'single', size: 4, color: 'CBD5E1' },
  insideVertical: { style: 'single', size: 4, color: 'CBD5E1' },
}

function assertExportable(report) {
  if (!report.confirmed && report.status === 'generating') {
    throw fail('AI_ERROR', '报告尚未生成完成', 409)
  }
}

function splitTableRow(line) {
  return String(line)
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((c) => c.trim())
}

function isSepRow(line) {
  return /^\s*\|?\s*:?-{3,}/.test(line)
}

function parseBlocks(md) {
  const lines = String(md || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
  const blocks = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!String(line).trim()) {
      i += 1
      continue
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      blocks.push({ type: 'heading', depth: heading[1].length, text: heading[2].trim() })
      i += 1
      continue
    }
    if (line.includes('|') && i + 1 < lines.length && isSepRow(lines[i + 1])) {
      const rows = []
      while (i < lines.length && lines[i].includes('|')) {
        if (!isSepRow(lines[i])) rows.push(splitTableRow(lines[i]))
        i += 1
      }
      if (rows.length) blocks.push({ type: 'table', rows })
      continue
    }
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const items = []
      while (i < lines.length && (/^\s*[-*]\s+/.test(lines[i]) || /^\s*\d+\.\s+/.test(lines[i]))) {
        items.push(lines[i].replace(/^\s*(?:[-*]|\d+\.)\s+/, '').trim())
        i += 1
      }
      blocks.push({ type: 'list', items })
      continue
    }
    const chunk = [line]
    i += 1
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith('#') &&
      !lines[i].includes('|') &&
      !/^\s*[-*]\s+/.test(lines[i])
    ) {
      chunk.push(lines[i])
      i += 1
    }
    blocks.push({ type: 'p', text: chunk.join('\n') })
  }
  return blocks
}

function inlinePlain(text) {
  return String(text || '').replace(/\*\*([^*]+)\*\*/g, '$1')
}

function wordRuns(text, size, forceBold) {
  const parts = String(text || '').split(/(\*\*[^*]+\*\*)/g)
  return parts
    .filter(Boolean)
    .map((part) => {
      const marked = part.startsWith('**') && part.endsWith('**')
      return new TextRun({
        text: marked ? part.slice(2, -2) : part,
        bold: Boolean(forceBold || marked),
        font: YAHEI,
        size,
      })
    })
}

function wordCell(text, header) {
  return new TableCell({
    shading: header ? { type: ShadingType.CLEAR, fill: 'E2E8F0' } : undefined,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: wordRuns(text, 20, header),
      }),
    ],
  })
}

function wordChildren(blocks) {
  const children = []
  for (const block of blocks) {
    if (block.type === 'heading') {
      const size = block.depth === 1 ? 36 : block.depth === 2 ? 28 : 24
      children.push(
        new Paragraph({
          alignment: block.depth === 1 ? AlignmentType.CENTER : AlignmentType.LEFT,
          spacing: { before: block.depth === 1 ? 0 : 280, after: 160, line: 360 },
          children: wordRuns(block.text, size, true),
        }),
      )
      continue
    }
    if (block.type === 'table') {
      children.push(
        new Table({
          width: { size: 9026, type: WidthType.DXA },
          borders: TABLE_BORDERS,
          rows: block.rows.map(
            (row, ri) =>
              new TableRow({
                tableHeader: ri === 0,
                children: row.map((cell) => wordCell(cell, ri === 0)),
              }),
          ),
        }),
      )
      children.push(new Paragraph({ spacing: { after: 160 }, children: [] }))
      continue
    }
    if (block.type === 'list') {
      block.items.forEach((item) => {
        children.push(
          new Paragraph({
            numbering: { reference: 'report-bullets', level: 0 },
            spacing: { after: 80, line: 360 },
            alignment: AlignmentType.LEFT,
            children: wordRuns(item, 24),
          }),
        )
      })
      continue
    }
    children.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 160, line: 360 },
        indent: { firstLine: 480 },
        children: wordRuns(block.text, 24),
      }),
    )
  }
  if (!children.length) {
    children.push(new Paragraph({ children: [new TextRun({ text: ' ', font: YAHEI })] }))
  }
  return children
}

const CJK_FONTS = [
  'C:\\Windows\\Fonts\\simhei.ttf',
  'C:\\Windows\\Fonts\\msyh.ttf',
  'C:\\Windows\\Fonts\\simfang.ttf',
  'C:\\Windows\\Fonts\\msyh.ttc',
  'C:\\Windows\\Fonts\\simsun.ttc',
]

function registerCjkFont(doc) {
  for (const file of CJK_FONTS) {
    if (!fs.existsSync(file)) continue
    try {
      doc.registerFont('CJK', file)
      doc.font('CJK')
      return 'CJK'
    } catch {
      /* 试下一个字体 */
    }
  }
  return 'Helvetica'
}

async function exportMarkdown(report) {
  const dest = path.join(REPORTS_DIR, `${report.reportId}.md`)
  const body = report.content || ''
  fs.writeFileSync(dest, `\uFEFF${body}`, 'utf8')
  return dest
}

async function exportWord(report) {
  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'report-bullets',
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '•',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 420, hanging: 240 } } },
            },
          ],
        },
      ],
    },
    styles: {
      default: {
        document: {
          run: { font: YAHEI, size: 24 },
          paragraph: { alignment: AlignmentType.LEFT, spacing: { line: 360 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          },
        },
        children: wordChildren(parseBlocks(report.content)),
      },
    ],
  })
  const buf = await Packer.toBuffer(doc)
  const dest = path.join(REPORTS_DIR, `${report.reportId}.docx`)
  fs.writeFileSync(dest, buf)
  return dest
}

function drawPdfTable(doc, rows, fontName) {
  const left = doc.page.margins.left
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right
  const cols = Math.max(1, ...rows.map((r) => r.length))
  const colW = width / cols
  rows.forEach((row, ri) => {
    const texts = Array.from({ length: cols }, (_, i) => inlinePlain(row[i] || ''))
    const sizes = texts.map((t) => doc.font(fontName).fontSize(ri === 0 ? 9 : 8).heightOfString(t, { width: colW - 8 }))
    const rowH = Math.max(18, ...sizes) + 8
    if (doc.y + rowH > doc.page.height - doc.page.margins.bottom) doc.addPage()
    const y = doc.y
    let x = left
    texts.forEach((t) => {
      doc.rect(x, y, colW, rowH).stroke('#94a3b8')
      if (ri === 0) {
        doc.save()
        doc.fillColor('#f1f5f9').rect(x, y, colW, rowH).fill()
        doc.restore()
        doc.rect(x, y, colW, rowH).stroke('#94a3b8')
      }
      doc.fillColor('#0f172a').font(fontName).fontSize(ri === 0 ? 9 : 8).text(t, x + 4, y + 4, {
        width: colW - 8,
        height: rowH - 6,
        align: 'left',
        lineBreak: false,
      })
      x += colW
    })
    doc.x = left
    doc.y = y + rowH
  })
  doc.x = left
  doc.moveDown(0.6)
}

function exportPdf(report) {
  return new Promise((resolve, reject) => {
    const dest = path.join(REPORTS_DIR, `${report.reportId}.pdf`)
    const doc = new PDFDocument({ margin: 48, size: 'A4' })
    const stream = fs.createWriteStream(dest)
    doc.pipe(stream)
    const fontName = registerCjkFont(doc)
    const left = doc.page.margins.left
    const blocks = parseBlocks(report.content)
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right
    for (const block of blocks) {
      doc.x = left
      if (block.type === 'heading') {
        const size = block.depth === 1 ? 18 : block.depth === 2 ? 14 : 12
        doc.font(fontName).fontSize(size).fillColor('#0f172a').text(inlinePlain(block.text), left, doc.y, {
          width,
          align: block.depth === 1 ? 'center' : 'left',
          paragraphGap: 8,
        })
        continue
      }
      if (block.type === 'table') {
        drawPdfTable(doc, block.rows, fontName)
        continue
      }
      if (block.type === 'list') {
        block.items.forEach((item) => {
          doc.x = left
          doc.font(fontName).fontSize(11).text(`• ${inlinePlain(item)}`, left, doc.y, {
            width,
            align: 'left',
            paragraphGap: 4,
          })
        })
        continue
      }
      doc.font(fontName).fontSize(11).fillColor('#0f172a').text(inlinePlain(block.text), left, doc.y, {
        width,
        align: 'left',
        paragraphGap: 8,
        lineGap: 3,
      })
    }
    doc.end()
    stream.on('finish', () => resolve(dest))
    stream.on('error', reject)
  })
}

const DOWNLOAD_NAME = {
  md: '碳足迹总结报告.md',
  markdown: '碳足迹总结报告.md',
  word: '碳足迹总结报告.docx',
  docx: '碳足迹总结报告.docx',
  pdf: '碳足迹总结报告.pdf',
}

async function exportReport(reportId, format, userId) {
  const report = await getReport(reportId, userId)
  assertExportable(report)
  ensureDir(REPORTS_DIR)
  const fmt = String(format || 'pdf').toLowerCase()
  let dest
  let mime
  if (fmt === 'md' || fmt === 'markdown') {
    dest = await exportMarkdown(report)
    mime = 'text/markdown; charset=utf-8'
  } else if (fmt === 'word' || fmt === 'docx') {
    dest = await exportWord(report)
    mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  } else if (fmt === 'pdf') {
    dest = await exportPdf(report)
    mime = 'application/pdf'
  } else {
    throw fail('AI_ERROR', '不支持的导出格式', 400)
  }
  const filename = DOWNLOAD_NAME[fmt] || path.basename(dest)
  report.exportedFileUrl = `/api/report/${reportId}/export?format=${fmt}`
  await upsertReport(report)
  return { dest, mime, filename }
}

module.exports = { exportReport }
