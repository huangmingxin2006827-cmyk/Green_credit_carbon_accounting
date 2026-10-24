# 绿色信贷碳核算平台

面向绿色信贷场景的 Web 应用：企业上传用电明细后，系统完成碳核算与图表展示，并由大模型生成碳足迹报告、减排建议与知识问答，辅助信贷侧理解企业碳表现。

## 团队信息

| 项目 | 内容 |
|---|---|
| 作品名称 | 绿色信贷碳核算平台 |
| 团队名称 | once |
| 团队编号 | 39286 |
| 所属院校 | 河南科技学院 |
| 参赛组别 | B 组 |
| 队员 | 黄铭欣、张青松、黄启圣 |
| 指导老师 | 无 |

## 技术架构

```
浏览器 (Vue 3 + Vite + Pinia + Element Plus + ECharts)
        │  HTTP / SSE
Node.js (Express)
        ├─ 核算 / 图表 / 导出（本地计算）
        ├─ MySQL（用户、报告、对话、任务）
        └─ 阿里云百炼（三个智能体应用）
              ├─ 报告生成
              ├─ 减排建议
              └─ 碳金融问答（挂载知识库）
```

- 前端：`packages/frontend`（开发端口默认 5180）
- 后端：`packages/backend`（端口 3000）
- 样例数据：`demo-data/`
- 行业强度对标：`行业碳强度对标_单位工业增加值口径.csv`

## 环境要求

- Node.js 18+
- MySQL 8+
- 阿里云百炼 API Key，以及三个已发布应用的 App Id

## 依赖清单

根目录执行 `npm run install:all` 会分别安装前后端依赖。主要依赖如下：

### 前端（`packages/frontend`）

| 依赖 | 版本 | 用途 |
|---|---|---|
| vue | ^3.5 | 界面框架 |
| vite | ^6.2 | 构建与开发服务器 |
| pinia | ^3.0 | 状态管理 |
| vue-router | ^4.5 | 路由 |
| element-plus | ^2.9 | UI 组件 |
| echarts | ^5.6 | 图表 |
| marked | ^18.1 | 报告 Markdown 渲染 |

### 后端（`packages/backend`）

| 依赖 | 版本 | 用途 |
|---|---|---|
| express | ^4.21 | HTTP API / SSE |
| mysql2 | ^3.24 | MySQL 访问 |
| jsonwebtoken / bcryptjs | ^9 / ^2.4 | 鉴权与密码哈希 |
| dotenv | ^16.4 | 环境变量 |
| multer / xlsx | ^2.0 / ^0.18 | 上传与 Excel 解析 |
| pdfkit / docx | ^0.16 / ^9.5 | 报告导出 PDF / Word |

完整版本以各目录 `package.json` / `package-lock.json` 为准。

## 环境变量

模板文件：[`packages/backend/.env.example`](packages/backend/.env.example)。复制为 `.env` 后按本机填写（**不要将真实 `.env` 提交到 Git**）。

| 变量 | 含义 |
|---|---|
| `PORT` | 后端端口，默认 `3000` |
| `DASHSCOPE_API_KEY` | 阿里云百炼 API Key |
| `DASHSCOPE_APP_ID_CHAT` | 碳金融问答应用（须挂载知识库） |
| `DASHSCOPE_APP_ID_REPORT` | 碳足迹报告应用 |
| `DASHSCOPE_APP_ID_SUGGESTION` | 减排建议应用 |
| `BAILIAN_TIMEOUT_MS` | 百炼请求超时（毫秒），默认 `300000` |
| `MYSQL_HOST` / `MYSQL_PORT` | 数据库主机与端口 |
| `MYSQL_USER` / `MYSQL_PASSWORD` | 数据库账号密码 |
| `MYSQL_DATABASE` | 库名，默认 `green_credit` |
| `JWT_SECRET` | JWT 签名密钥 |

## 安装与运行

```bash
# 1. 安装依赖
npm run install:all

# 2. 配置后端环境变量
cd packages/backend
copy .env.example .env
```

编辑 `.env`：填写 `DASHSCOPE_API_KEY`、三个 `DASHSCOPE_APP_ID_*`，以及本机 MySQL 账号密码。  
其中对话应用应对应已挂载「碳金融知识库」的碳金融问答助手。

```bash
# 3. 初始化数据库（在 packages/backend 目录）
npm run db:init

# 4. 启动后端
npm run dev

# 5. 另开终端启动前端
cd packages/frontend
npm run dev
```

浏览器打开控制台提示的地址（一般为 `http://localhost:5180`）。  
也可使用仓库根目录的 `启动项目.bat` / `关闭项目.bat`。

## 演示账号

执行 `npm run db:init` 后可使用下列种子用户（密码均为 `123456`），也可自行注册：

| 用户名 | 显示名 | 密码 |
|---|---|---|
| `zhang` | 张经理 | `123456` |
| `li` | 李经理 | `123456` |
| `wang` | 王经理 | `123456` |

## 数据表（MySQL）

库名默认 `green_credit`，业务数据按用户隔离。建表脚本见 [`packages/backend/sql/schema.sql`](packages/backend/sql/schema.sql)。

| 表名 | 用途 |
|---|---|
| `users` | 注册用户与密码哈希 |
| `uploads` | 上传的用电明细及解析结果 |
| `reports` | 碳足迹报告正文、核算与图表 JSON |
| `suggestions` | AI 减排建议及采纳状态 |
| `tasks` | 由建议转化的待办任务 |
| `chat_messages` | 对话历史（登录后可恢复） |

## 主要功能

1. 注册 / 登录（JWT）
2. 上传企业用电 Excel，解析用电结构并计算排放
3. 四类图表：趋势、对比、构成占比、单位增加值碳强度对标
4. SSE 流式生成碳足迹报告；可编辑并导出 Markdown / Word / PDF
5. 报告就绪后并行生成三条减排建议；采纳后进入待办任务
6. 碳知识问答与报告追问（对话应用 + 知识库检索）

## 目录说明

```
packages/frontend   前端
packages/backend    后端 API、Agent、核算与导出
demo-data           样例 Excel
```

密钥与真实 `.env` 不要提交到 Git。
