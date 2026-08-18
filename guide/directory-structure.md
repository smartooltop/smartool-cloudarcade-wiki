# 目录结构

CloudArcade 是传统的 PHP 单体应用，目录结构清晰，功能模块化。下面是完整说明。

```
cloudarcade/
├── index.php              # 前台前端控制器（所有前台请求的统一入口）
├── admin.php              # 后台入口，负责加载后台管理界面
├── install.php            # 安装脚本（未安装时自动跳转至此）
├── config.php             # 引导配置：检测安装状态并加载数据库连接
├── init.php               # 初始化：会话、常量、数据库连接、公共函数
├── site-settings.php      # 站点设置：加载 db/settings.json 并定义常量
├── connect-sample.php     # 数据库连接配置示例（安装后为 connect.php）
├── sitemap.php            # 生成 XML sitemap 供搜索引擎抓取
├── .htaccess              # URL 重写规则（PRETTY URL 的实现）
│
├── classes/               # 核心类库（数据模型层）
│   ├── Auth.php           # CA_Auth：令牌认证（记住我登录）
│   ├── Category.php       # 游戏分类
│   ├── Collection.php     # 游戏合集
│   ├── Game.php           # 游戏（最大的数据模型，1127 行）
│   ├── Page.php           # 自定义页面
│   ├── SystemUpdater.php  # 系统更新（检查/下载/安装）
│   ├── User.php           # 用户与会员订阅
│   └── Widget.php         # 小工具抽象与工厂
│
├── includes/              # 公共函数、页面模板与钩子
│   ├── api.php            # 前台 API（提交分数、投票、收藏等 AJAX 接口）

│   ├── commons.php        # 通用函数库（87 个函数）
│   ├── game_list.php      # 游戏列表渲染辅助
│   ├── load-class.php     # 自动加载核心类
│   ├── load-settings.php  # 从 db/settings.json 读取设置
│   ├── plugin.php         # 插件系统（列表、钩子、激活）
│   ├── sessions.php       # 会话与登录用户判定
│   ├── captcha.php        # 验证码生成
│   ├── comment.php        # 评论系统
│   ├── cron.php           # 定时任务
│   ├── fetch.php          # 远程游戏数据抓取
│   ├── statistics.php     # 站点统计
│   ├── user.php           # 用户相关辅助
│   ├── vote.php           # 投票逻辑
│   ├── widgets.php        # 小工具渲染
│   ├── version.php        # 定义 VERSION 常量
│   └── page-*.php         # 各前台页面模板（homepage/game/category/...）
│
├── admin/                 # 后台管理
│   ├── index.php          # 后台首页（仪表盘）
│   ├── request.php        # 后台统一入口与权限校验
│   ├── upload.php         # 文件上传
│   ├── admin-functions.php# 后台公共函数
│   ├── core/              # 各管理页面（游戏/分类/主题/插件/设置等）
│   ├── includes/          # 后台专用包含文件
│   └── style/             # 后台样式与字体
│
├── content/               # 内容目录（主题与插件）
│   ├── themes/            # 主题：default、dark-grid
│   │   ├── theme-functions.php
│   │   └── <主题名>/      # 每个主题独立目录
│   └── plugins/           # 插件目录（每个插件一个子目录）
│
├── db/                    # 数据库相关
│   ├── tables.sql         # 建表脚本（27 张表）
│   └── settings.json      # 默认站点设置
│
├── js/                    # 前端脚本
│   ├── api.js             # 前台 API 封装
│   ├── comment-system.js  # 评论系统
│   ├── script.js          # 全局脚本
│   ├── stats.js           # 统计图表
│   └── vendor/            # jQuery、Chart.js 等第三方库
│
├── images/                # 站点默认图片（logo、头像、等级徽章等）
├── vendor/                # 第三方依赖（Bootstrap 等）
└── locales/               # 多语言 JSON 语言包（若有）
```

## 各目录职责

### classes/ —— 数据模型层

每个类对应一个业务实体，提供静态查询方法（`getById`、`getList`）与实例方法（`insert`、`update`、`delete`），即轻量级 **CRUD**。它们直接使用 `init.php` 中的 `open_connection()` 获取 **PDO** 连接执行 SQL，未使用 **ORM**。

### includes/ —— 共享层

- **commons.php**：最核心的函数库，涵盖 URL 生成（`get_permalink`）、图片处理（缩略图、**WEBP** 转换）、字符串转义（`esc_string`）、语言翻译（`translate`）等。
- **page-\*.php**：前台页面模板，由 `index.php` 根据 `viewpage` 参数加载。

### admin/ —— 后台管理

后台通过 `admin.php` 进入，`admin/request.php` 负责权限校验与页面分发，`admin/core/` 下每个文件对应一个管理页面（游戏、分类、主题、插件、设置等）。

### content/ —— 可扩展内容

主题与插件都采用「独立子目录 + 元数据文件」的结构，便于上传、启用与卸载。

## 关键文件详解

| 文件 | 作用 |
| --- | --- |
| `index.php` | 解析 URL、语言、路由到对应页面模板，见 [请求生命周期](/architecture/request-lifecycle) |
| `.htaccess` | 将所有请求重写为 `index.php?viewpage=$1`，实现 **PRETTY URL** |
| `config.php` | 检查 `connect.php` 是否存在，未安装则跳转 `install.php` |
| `init.php` | 定义常量 `ABSPATH`，开启会话，加载核心类与函数，提供 `open_connection()` |
| `db/settings.json` | 站点设置存储（安装时导入数据库 `settings` 表） |

::: tip
`connect.php` 在安装时由 `connect-sample.php` 复制生成，包含 **DB_DSN**、数据库用户名与密码，属于敏感文件，不应提交到版本控制。
:::
