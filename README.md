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

- 前端：`packages/frontend`（开发端口默认 **5180**）
- 后端：`packages/backend`（端口 **3000**）
- 样例数据：`demo-data/`（五个行业演示 Excel）
- 行业强度对标：`行业碳强度对标_单位工业增加值口径.csv`

## 环境要求

请先确认本机已具备：

| 依赖 | 说明 |
|---|---|
| Node.js 18+ | 终端执行 `node -v`，版本需 ≥ 18 |
| npm | 随 Node 安装；`npm -v` 可查 |
| MySQL 8+ | 服务已启动，并有可登录账号（记住用户名与密码） |
| 阿里云百炼 | API Key，以及三个**已发布**应用的 App Id；其中对话应用须挂载「碳金融知识库」 |

未配置百炼时：上传、核算、图表仍可使用；报告生成、减排建议、知识问答会失败。

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

模板文件：[`packages/backend/.env.example`](packages/backend/.env.example)。

**请复制为 `.env` 后只在本机填写真实值。**

**AI 功能必填（共 4 项）：** `DASHSCOPE_API_KEY` + `DASHSCOPE_APP_ID_CHAT` / `REPORT` / `SUGGESTION`。  
未填写时，上传、核算、图表仍可用；**碳足迹报告、减排建议、知识问答会失败**。  
评委演示用的真实 Key / App Id 见网盘技术文档pdf末尾附页。

```bash
cd packages/backend
copy .env.example .env
```

| 变量 | 含义 |
|---|---|
| `PORT` | 后端端口，默认 `3000` |
| `DASHSCOPE_API_KEY` | 阿里云百炼 API Key（**AI 必填**） |
| `DASHSCOPE_APP_ID_CHAT` | 碳金融问答应用（须挂载知识库，**AI 必填**） |
| `DASHSCOPE_APP_ID_REPORT` | 碳足迹报告应用（**AI 必填**） |
| `DASHSCOPE_APP_ID_SUGGESTION` | 减排建议应用（**AI 必填**） |
| `BAILIAN_TIMEOUT_MS` | 百炼请求超时（毫秒），默认 `300000` |
| `MYSQL_HOST` / `MYSQL_PORT` | 数据库主机与端口 |
| `MYSQL_USER` / `MYSQL_PASSWORD` | 数据库账号密码 |
| `MYSQL_DATABASE` | 库名，默认 `green_credit` |
| `JWT_SECRET` | JWT 签名密钥（请换成自己的随机字符串） |

## 安装与运行（首次部署）

### Windows 评委推荐路径

前置：已安装 **Node.js 18+**、**MySQL 8+**，且 MySQL 服务已启动。

| 脚本 | 何时用 |
|---|---|
| `一键配置.bat` | **首次**：安装依赖、生成/填写 `.env`、初始化数据库 |
| `启动项目.bat` | 配置完成后日常启动前后端并打开浏览器 |
| `关闭项目.bat` | 停止服务 |

推荐步骤：

1. 克隆仓库后双击根目录 **`一键配置.bat`**
2. 按提示填写本机 `MYSQL_PASSWORD`（必填才能建库）
3. **演示 AI 时必须填写** `DASHSCOPE_API_KEY` 与三个 `DASHSCOPE_APP_ID_*`（共 4 项；数值见网盘PDF末尾附页）。若回车跳过：仅可测上传、核算、图表，**报告 / 减排建议 / 知识问答将不可用**
4. 配置成功后按提示启动，或之后再双击 `启动项目.bat`
5. 浏览器打开 **http://localhost:5180**，用演示账号登录，上传 `demo-data/01-纺织业-河南.xlsx`

### 备选：命令行手动部署

适合非 Windows，或不想使用 bat 时。

#### 1. 获取代码并安装依赖

```bash
git clone <本仓库地址>
cd Green_credit_carbon_accounting
npm run install:all
```

#### 2. 配置后端环境变量

```bash
cd packages/backend
copy .env.example .env
```

用编辑器打开 `.env`，填入：

- 本机 MySQL 的 `MYSQL_USER` / `MYSQL_PASSWORD`
- **AI 必填：** `DASHSCOPE_API_KEY` 与三个 `DASHSCOPE_APP_ID_*`（缺一则报告/建议/问答不可用；取值见网盘私密说明）
- 自定义 `JWT_SECRET`

#### 3. 初始化数据库

确认 MySQL 服务已启动，然后在 `packages/backend` 目录执行：

```bash
npm run db:init
```

会创建库表并写入演示账号（见下文）。

#### 4. 启动服务

**方式 A：两个终端**

```bash
# 终端 1 — 项目根目录
npm run dev:backend

# 终端 2 — 项目根目录
npm run dev:frontend
```

**方式 B：Windows（需已完成上面 1～3 步或已跑过一键配置）**

双击 `启动项目.bat`；停止时运行 `关闭项目.bat`。

#### 5. 打开页面

浏览器访问：**http://localhost:5180**

- 前端开发服务器：`5180`
- 后端 API：`3000`（前端已代理 `/api`）

## 演示账号

执行 `npm run db:init` 后可使用下列种子用户（密码均为 `123456`），也可自行注册：

| 用户名 | 显示名 | 密码 |
|---|---|---|
| `admin` | 管理员 | `123456` |
| `zhang` | 张经理 | `123456` |
| `wang` | 王经理 | `123456` |

## 演示数据（上传 Excel）

目录：[`demo-data/`](demo-data/)。登录后上传下列**任意一个**即可走通核算 → 图表 → 报告流程。

| 文件 | 适合演示 |
|---|---|
| `01-纺织业-河南.xlsx` | **推荐主演示**；强度对标印染/纺织 |
| `02-钢铁-河北.xlsx` | 高碳强度对比 |
| `03-化工-山东.xlsx` | 中等强度 |
| `04-造纸-浙江.xlsx` | 偏高制造业 |
| `05-建材-河南.xlsx` | 常见信贷相关行业 |

五个文件均含「年工业增加值」，可展示第四张「单位增加值碳强度对标」图。更多说明见 [`demo-data/README.txt`](demo-data/README.txt)。

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

1. 注册 / 登录（JWT）；支持修改密码
2. 上传企业用电 Excel，解析用电结构并计算排放
3. 四类图表：趋势、对比、构成占比、单位增加值碳强度对标
4. SSE 流式生成碳足迹报告；可编辑并导出 Markdown / Word / PDF
5. 报告就绪后并行生成三条减排建议；采纳后进入待办任务
6. 碳知识问答与报告追问（对话应用 + 知识库检索）

## 常见问题

| 现象 | 可能原因 |
|---|---|
| 后端一启动就退出 | MySQL 未启动，或 `.env` 中账号密码 / 库名不正确 |
| 报告 / 建议 / 对话报错 | 未填写或填错百炼 `DASHSCOPE_API_KEY` / App Id |
| 没有第四张强度对标图 | 上传的 Excel 缺少「年工业增加值」类列；请用 `demo-data` 中五个样例 |
| `启动项目.bat` 打不开页面 | 请先运行 `一键配置.bat`（或完成依赖 / `.env` / `db:init`），并确认 5180 端口未被占用 |
| `一键配置.bat` 在 db:init 失败 | MySQL 未启动，或 `.env` 中密码与本机 root 密码不一致 |
| 改密失败提示原密码错误 | 请确认当前登录密码；演示账号初始密码为 `123456` |

## 目录说明

```
packages/frontend   前端
packages/backend    后端 API、Agent、核算与导出
demo-data           五个行业演示 Excel
一键配置.bat        Windows 首次部署（装依赖 / 配 .env / 建库）
启动项目.bat / 关闭项目.bat   Windows 日常启停
```
