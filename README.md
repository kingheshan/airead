# 小鹿 AI 拆书工坊

这是“小鹿 AI 拆书”的可部署 MVP：把战略、产品、增长、组织、AI 相关书籍，拆成业务动作、团队共学和认知资产。

这一版已经接入 **微信读书 weread-skills**，支持从微信读书导入书籍信息、目录、阅读进度、我的划线、我的想法/点评，再送入 AI 拆书报告生成器。

## 已实现

- 前端表单：书名、作者、书籍类型、报告深度、阅读目标、业务背景、目录/摘录/笔记。
- 微信读书导入：检查连接、搜索书籍、查看我的笔记本、导入选中书。
- Serverless 后端：
  - `netlify/functions/generate-report.mjs`：调用 OpenAI Responses API 生成拆书报告。
  - `netlify/functions/import-weread.mjs`：通过 weread-skills Agent API Gateway 调用微信读书接口。
  - `netlify/functions/weread-materials.mjs`：保留 JSON/文本材料兼容解析入口。
- 输出结构化 Markdown 拆书报告。
- 前端支持复制、下载 Markdown、保存到本地书卡库。
- 本地演示报告：AI 后端未连接时也能查看产品流程。

## 微信读书导入链路

```text
微信读书 weread-skills
  ↓
Agent API Gateway
  ↓
Netlify Function: import-weread
  ↓
书籍信息 / 目录 / 阅读进度 / 我的划线 / 我的想法
  ↓
材料区
  ↓
AI 拆书报告生成器
```

支持的后端 action：

| action | 用途 |
|---|---|
| `health` | 检查 `WEREAD_API_KEY` 是否已配置 |
| `searchBooks` | 调 `/store/search` 搜索电子书 |
| `listRecent` | 调 `/user/notebooks` 拉取有笔记的书 |
| `importBook` | 导入单本书的详情、目录、进度、划线和想法 |
| `importShelf` | 拉取书架条目，保留给后续版本使用 |

## 本地运行

```bash
npm install
cp .env.example .env
```

在 `.env` 中填入：

```bash
OPENAI_API_KEY=你的 OpenAI API Key
OPENAI_MODEL=gpt-5.5

WEREAD_API_KEY=你的微信读书 Agent API Key
WEREAD_SKILL_VERSION=1.0.3
WEREAD_GATEWAY_URL=https://i.weread.qq.com/api/agent/gateway
```

然后运行：

```bash
npm run dev
```

Netlify Dev 会映射：

```text
/.netlify/functions/generate-report
/.netlify/functions/import-weread
/.netlify/functions/weread-materials
```

## 部署到 Netlify

1. 将本目录上传到 GitHub。
2. Netlify 新建站点，选择该仓库。
3. Build command 可以留空，Publish directory 设置为 `.`。
4. Environment variables 添加：
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL`
   - `WEREAD_API_KEY`
   - `WEREAD_SKILL_VERSION`
   - `WEREAD_GATEWAY_URL`
5. 部署后打开首页即可使用真实 AI 生成和微信读书导入。

## 安全与版权边界

- `OPENAI_API_KEY` 和 `WEREAD_API_KEY` 只能放在服务端环境变量里，不能写进前端页面。
- 不建议上传或传播整本书、大段受版权保护文本。
- 推荐导入：自己的划线、想法、目录线索、阅读进度、少量摘录和业务问题。
- AI 报告应服务个人学习、评论、研究、团队共学和业务迁移，不应替代原书。
- 后端提示词要求模型明确材料边界，不假装读过未提供内容。

## 代码检查

```bash
npm run check
```

## 下一版建议

- 接 Supabase：账号、团队空间、书卡库、模型库、实验看板。
- 把微信读书导入后的书卡拆成结构化数据：书籍、模型、启发、实验、复盘。
- 增加材料分块和引用定位。
- 增加团队共读作业、评论和复盘。
- 增加报告质量评分：事实边界、业务迁移、行动可执行性、反方强度。
