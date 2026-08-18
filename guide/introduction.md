# 项目简介

CloudArcade 是一个基于 **PHP** + **MySQL** 的开源 **CMS**（内容管理系统），用于搭建 HTML5 游戏聚合站点。用户可以浏览、搜索、收藏游戏，发表评论、评分、投票；管理员可以在后台管理游戏、分类、页面、主题与插件。

- **当前版本**：2.1.3（见 `includes/version.php`）
- **运行环境**：PHP 7+（使用 **PDO** 访问数据库）、MySQL 5.7+
- **架构风格**：传统的 PHP 单体应用，无 **MVC** 框架依赖，采用 **FRONT CONTROLLER**（前端控制器）模式统一入口

## 核心特性

| 特性 | 说明 |
| --- | --- |
| 游戏聚合 | 支持手动添加、URL 导入、JSON/上传批量导入游戏 |
| 前台页面 | 首页、游戏详情、分类、标签、归档、搜索、合集、用户中心 |
| 用户系统 | 注册、登录、收藏、评论、评分、投票、等级与会员订阅 |
| 多语言 | 基于 JSON 语言包，支持 URL 中的语言代码（如 `/en/`） |
| 主题系统 | 独立目录式主题，默认内置 default 与 dark-grid 两套 |
| 插件系统 | 独立目录式插件，通过 `info.json` 描述并注册钩子 |
| **PRETTY URL** | 通过 `.htaccess` 的 **REWRITE RULE** 实现美化地址 |
| SEO 支持 | **META DESCRIPTION**、**CANONICAL URL**、**OPEN GRAPH**、sitemap 生成 |
| 系统更新 | 内置 `SystemUpdater` 支持自动检查与安装更新 |

## 主要技术栈

| 技术 | 用途 |
| --- | --- |
| PHP + PDO | 服务端逻辑与数据库访问（预处理语句防 **SQL INJECTION**） |
| MySQL | 数据存储，共 27 张表 |
| jQuery + AJAX | 前台交互与异步请求（评论、投票、收藏等） |
| Bootstrap | 主题样式框架 |
| Chart.js | 后台统计图表 |

## 目录速览

```
├── index.php          # 前端控制器（所有前台请求入口）
├── admin.php          # 后台入口
├── install.php        # 安装脚本
├── classes/           # 核心类（Game、User、Category 等）
├── includes/          # 公共函数、页面模板、API、插件钩子
├── content/           # 主题与插件目录
├── db/                # 数据库建表脚本与默认设置
└── js/                # 前端脚本
```

各部分的详细说明请参见 [目录结构](/guide/directory-structure)。

## 请求处理概览

一次典型的访问流程：

1. 服务器将所有请求通过 `.htaccess` 重写到 `index.php`
2. `index.php` 解析 URL 参数与语言代码
3. 加载配置、数据库连接与公共函数
4. 根据 `viewpage` 参数加载对应的页面模板（`includes/page-*.php`）
5. 输出最终 HTML

完整细节见 [请求生命周期](/architecture/request-lifecycle)。

::: tip 提示
本 Wiki 中带有下划虚线的英文单词与技术名词，鼠标悬停即可查看音标与中文解析，帮助阅读。
:::
