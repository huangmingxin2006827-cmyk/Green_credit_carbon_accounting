const xlsx = require('xlsx')
const path = require('path')
const fs = require('fs')

const months = [
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

// 河南纺织：排放因子 0.5897；增加值取 250 万元，便于与行业基准 3.46 对比
const rows = months.map(([month, kwh, eq, ac, light, office]) => ({
  企业名称: '示例纺织有限公司',
  行业: '纺织业',
  地区: '河南',
  年工业增加值万元: 250,
  月份: month,
  用电量kWh: kwh,
  生产设备: eq,
  空调: ac,
  照明: light,
  办公: office,
}))

const wb = xlsx.utils.book_new()
xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(rows), '用电明细')
const destDir = path.join(__dirname, '..', '..', '..', 'demo-data')
fs.mkdirSync(destDir, { recursive: true })
const names = ['企业用电明细.xlsx', 'sample-electricity-2025.xlsx', '企业用电明细-含增加值.xlsx']
for (const name of names) {
  const dest = path.join(destDir, name)
  try {
    xlsx.writeFile(wb, dest)
    console.log('wrote', dest)
  } catch (err) {
    if (err.code === 'EBUSY') {
      console.warn('skip locked file:', dest)
      continue
    }
    throw err
  }
}
