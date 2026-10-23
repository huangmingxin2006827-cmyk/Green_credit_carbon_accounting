模拟上传测试用 Excel

推荐上传（含年工业增加值，第四张图可对标行业强度）：
- 企业用电明细-含增加值.xlsx
- sample-electricity-2025.xlsx（内容相同）

若本机打开了「企业用电明细.xlsx」，该文件可能仍是旧版（无增加值列），请改用上面两个，
或关闭 Excel 后运行：node packages/backend/scripts/make-sample-excel.js

内容：河南「纺织业」，年工业增加值 250 万元，2025 年 12 个月用电分项。
行业强度基准：根目录 CSV 中「印染/纺织」= 3.46 tCO2e/万元增加值。
