const path = require('path')

const ROOT = path.join(__dirname, '..')
const DATA = path.join(ROOT, 'data')

module.exports = {
  DATA,
  BENCHMARKS: path.join(DATA, 'benchmarks.json'),
  REPORTS_DIR: path.join(DATA, 'reports'),
  TASKS_DIR: path.join(DATA, 'tasks'),
  CACHE_DIR: path.join(DATA, 'cache'),
  UPLOADS_DIR: path.join(DATA, 'uploads'),
  REPORT_INDEX: path.join(DATA, 'reports', 'index.json'),
  SUGGESTION_INDEX: path.join(DATA, 'cache', 'suggestions.json'),
  CHART_CACHE: path.join(DATA, 'cache', 'charts.json'),
  TASK_INDEX: path.join(DATA, 'tasks', 'index.json'),
}
