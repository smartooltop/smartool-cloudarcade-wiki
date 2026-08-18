# smartool-cloudarcade-wiki

CloudArcade 2.1.3 CMS 源码解析文档站，基于 [VitePress](https://vitepress.dev/) 构建。

## 技术栈

- 构建工具：VitePress 1.6
- 包管理：pnpm
- 语言：简体中文
- 特色功能：**术语悬停词典** — 正文中的英文专业术语带下划虚线，鼠标悬停即显示音标（IPA）与中文解析

## 本地运行

```bash
# 安装依赖
pnpm install

# 开发模式（热重载）
pnpm dev

# 生产构建
pnpm build

# 本地预览构建产物
pnpm preview
```

开发模式默认端口：`http://localhost:5173`

## 部署子路径（base 配置）

默认 `base = /`（根路径），即部署到 `https://smartool.top/`。
通过环境变量 `BASE` 覆盖（**必须以 `/` 开头并以 `/` 结尾**）：

| 场景 | `BASE` 值 | 最终访问地址 |
|---|---|---|
| 根域名部署（默认） | `/` 或不设置 | `https://smartool.top/` |
| 子路径 `/cloudarcade/` | `/cloudarcade/` | `https://smartool.top/cloudarcade/` |
| 其他子路径 | `/docs/` | `https://smartool.top/docs/` |

### 各操作系统设置环境变量

**Windows - PowerShell**（推荐）：

```powershell
$env:BASE = "/cloudarcade/"
pnpm build
```

**Windows - CMD**：

```cmd
set BASE=/cloudarcade/
pnpm build
```

**Windows - Git Bash**：

```bash
BASE=/cloudarcade/ pnpm build
```

**Linux / macOS / WSL**（Bash / Zsh）：

```bash
BASE=/cloudarcade/ pnpm build
```

也可 `export` 后多次使用：

```bash
export BASE=/cloudarcade/
pnpm build
pnpm preview
```

**CI / Docker**：

```yaml
# GitHub Actions
env:
  BASE: /cloudarcade/
run: pnpm build
```

```dockerfile
# Dockerfile
ENV BASE=/cloudarcade/
RUN pnpm build
```

```yaml
# docker-compose.yml
environment:
  - BASE=/cloudarcade/
```

### 注意事项

- 本地 `pnpm dev` 同样应用 `base`，访问地址变为 `http://localhost:5173/cloudarcade/`
- `cleanUrls: true` 在子路径下仍然有效
- 若部署平台（Cloudflare Pages、Vercel、Netlify）自身有 base 配置项，请保持与环境变量 `BASE` 一致，避免资源 404

## 文档目录

```
.
├── index.md                  # 首页（Hero + 6 个模块入口 + 术语表链接）
├── glossary.md               # 术语表（可悬停的所有词条汇总）
├── guide/                    # 指南
│   ├── introduction.md       # 项目简介与技术栈
│   ├── directory-structure.md # CloudArcade 源码目录结构
│   ├── installation.md       # 安装部署
│   └── configuration.md      # 配置说明
├── architecture/             # 架构
│   ├── request-lifecycle.md  # 请求生命周期（index.php 路由）
│   ├── database.md           # 数据库设计（27 张表）
│   └── security.md           # 安全机制
├── classes/                  # 核心类（8 个）
│   ├── game.md               # Game 游戏类
│   ├── category.md           # Category 分类类
│   ├── collection.md         # Collection 合集类
│   ├── page.md               # Page 页面类
│   ├── user.md               # User 用户类
│   ├── auth.md               # CA_Auth 认证类
│   ├── widget.md             # Widget 小工具类
│   └── system-updater.md     # SystemUpdater 更新类
├── api/                      # 接口
│   ├── public-api.md         # 前台 API（分数 / 排行 / 广告）
│   └── admin-ajax.md         # 后台 AJAX
├── admin/                    # 后台管理
│   ├── overview.md           # 后台总览
│   ├── games.md              # 游戏管理
│   ├── content.md            # 内容管理
│   ├── appearance.md         # 外观与主题
│   └── plugins.md            # 插件管理
├── theming/                  # 主题
│   ├── overview.md           # 主题系统
│   ├── theme-structure.md    # 主题结构
│   └── template-functions.md # 模板函数
├── plugins/                  # 插件
│   └── plugin-system.md      # 插件机制
├── devops/                   # 运维部署
│   ├── deploy-frankenphp.md  # FrankenPHP + Ghost 共存容器部署
│   └── subpath-deploy.md     # 子路径部署（/arcade/ 前缀）
└── .vitepress/
    ├── config.mts            # VitePress 配置（导航 / 侧边栏 / 搜索 / 术语插件）
    ├── data/glossary.ts      # 术语词典数据
    ├── plugins/glossary.ts   # markdown-it 插件：术语自动包裹 <span>
    └── theme/                # 自定义主题
        ├── index.ts          # 包覆 DefaultTheme，挂载 GlossaryTooltip
        ├── components/GlossaryTooltip.vue
        └── styles/glossary.css
```

## 特色功能：术语悬停词典

文档中所有英文专业术语会被自动识别并添加虚线样式，鼠标悬停显示音标与中文解析。

### 三层实现

1. **数据层**（`.vitepress/data/glossary.ts`）：词条数组，按类型分「单词类（含 IPA 音标）」和「术语类（技术缩写）」
2. **Markdown 层**（`.vitepress/plugins/glossary.ts`）：在 markdown-it `inline` 规则之后，按长度降序匹配命中文本，包裹为 `<span class="glossary-term" data-term="...">`；自动跳过标题、代码块、行内代码
3. **主题层**（`.vitepress/theme/`）：用 Vue 组件 `GlossaryTooltip` 包覆 DefaultTheme Layout，监听悬停事件并弹出 tooltip

### 词条扩展

在 `.vitepress/data/glossary.ts` 追加对象即可：

```ts
// 单词类（含音标）
{ term: 'render', type: 'word', ipa: '/ˈrendə/', definition: '渲染，模板与数据生成输出' },
// 术语类（技术缩写）
{ term: 'MVC', type: 'term', definition: 'Model-View-Controller，模型-视图-控制器架构模式' }
```

## 配置入口

- 导航栏 / 侧边栏 / 页脚：`.vitepress/config.mts`
- 站点元数据 / SEO keywords：`.vitepress/config.mts` 中 `head` 字段
- 本地搜索：内置 `search.provider = 'local'`，无需额外服务

## 关联源码

CloudArcade CMS 2.1.3 源码位置（示例，按需调整）：

```
../cloudarcade/
├── index.php          # 前台入口
├── admin.php          # 后台入口
├── classes/           # 8 个核心类
├── includes/          # 公共函数与页面模板
├── admin/             # 后台管理
├── content/themes/    # default / dark-grid 主题
├── db/tables.sql      # 27 张表建表脚本
└── includes/sub-folder.php # 子路径开关
```
