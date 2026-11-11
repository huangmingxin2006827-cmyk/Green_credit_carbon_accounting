const xlsx = require('xlsx')
const path = require('path')
const fs = require('fs')

/** Shared 12-month shape: [month, totalKwh, equipment, ac, light, office] */
function scaleMonths(factor) {
  const base = [
    ['2025-01', 105000, 58000, 22000, 15000, 10000],
    ['2025-02', 98000, 54000, 21000, 14000, 9000],
    ['2025-03', 115000, 64000, 24000, 16000, 11000],
    ['2025-04', 118000, 66000, 24000, 16000, 12000],
    ['2025-05', 125000, 70000, 26000, 17000, 12000],
    ['2025-06', 135000, 76000, 28000, 18000, 13000],
    ['2025-07', 148000, 82000, 32000, 20000, 14000],
    ['2025-08', 145000, 80000, 31000, 20000, 14000],
    ['2025-09', 130000, 72000, 27000, 18000, 13000],
    ['2025-10', 122000, 68000, 25000, 17000, 12000],
    ['2025-11', 112000, 62000, 23000, 16000, 11000],
    ['2025-12', 107000, 59000, 22000, 15000, 11000],
  ]
  return base.map(([month, kwh, eq, ac, light, office]) => [
    month,
    Math.round(kwh * factor),
    Math.round(eq * factor),
    Math.round(ac * factor),
    Math.round(light * factor),
    Math.round(office * factor),
  ])
}

const demos = [
  {
    file: '01-纺织业-河南.xlsx',
    name: '示例纺织有限公司',
    industry: '纺织业',
    region: '河南',
    valueAdded: 250,
    factor: 1,
  },
  {
    file: '02-钢铁-河北.xlsx',
    name: '示例钢铁股份有限公司',
    industry: '钢铁',
    region: '河北',
    valueAdded: 800,
    factor: 4.2,
  },
  {
    file: '03-化工-山东.xlsx',
    name: '示例化工集团有限公司',
    industry: '化工',
    region: '山东',
    valueAdded: 420,
    factor: 1.8,
  },
  {
    file: '04-造纸-浙江.xlsx',
    name: '示例造纸有限公司',
    industry: '造纸',
    region: '浙江',
    valueAdded: 360,
    factor: 2.4,
  },
  {
    file: '05-建材-河南.xlsx',
    name: '示例建材有限公司',
    industry: '建材',
    region: '河南',
    valueAdded: 300,
    factor: 1.6,
  },
]

const destDir = path.join(__dirname, '..', '..', '..', 'demo-data')
fs.mkdirSync(destDir, { recursive: true })

const keep = new Set(['README.txt', ...demos.map((d) => d.file)])
for (const name of fs.readdirSync(destDir)) {
  if (!keep.has(name)) {
    const p = path.join(destDir, name)
    if (fs.statSync(p).isFile()) {
      fs.unlinkSync(p)
      console.log('removed', name)
    }
  }
}

for (const demo of demos) {
  const rows = scaleMonths(demo.factor).map(([month, kwh, eq, ac, light, office]) => ({
    企业名称: demo.name,
    行业: demo.industry,
    地区: demo.region,
    年工业增加值万元: demo.valueAdded,
    月份: month,
    用电量kWh: kwh,
    生产设备: eq,
    空调: ac,
    照明: light,
    办公: office,
  }))
  const wb = xlsx.utils.book_new()
  xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(rows), '用电明细')
  const dest = path.join(destDir, demo.file)
  xlsx.writeFile(wb, dest)
  console.log('wrote', demo.file)
}
