# 主题系统

主题（**THEME**）是 CloudArcade 的模板层，控制站点前台的外观与布局。主题以独立目录形式存放在 `content/themes/` 下，内置 `default` 与 `dark-grid` 两套。

## 主题是什么

主题 = 「模板文件 + 样式 + 函数」的集合，与核心代码（classes/includes）完全解耦：

```
content/themes/
├── theme-functions.php    # 全局主题函数（全主题共享）
├── default/               # 默认主题
└── dark-grid/             # 暗色网格主题
```

- 每个主题目录包含 `info.json`（元数据）与页面模板（`home.php`、`game.php` 等）
- 前台入口 `index.php` 根据 `THEME_NAME` 设置确定使用哪个主题
- 更换主题只需修改设置 `theme_name`，无需改动业务代码

## 主题加载机制

`site-settings.php` 定义主题常量：

```php
define("THEME_NAME", $options['theme_name']);
define("TEMPLATE_PATH", "content/themes/" . THEME_NAME);
```

前台请求流程（见 [请求生命周期](/architecture/request-lifecycle)）中：

```php
require_once(ABSPATH . 'content/themes/theme-functions.php');  // 全局主题函数
load_plugins('index');                                          // 插件钩子
require_once(TEMPLATE_PATH . '/functions.php');                 // 当前主题函数
```

页面分发时优先使用主题模板，主题中没有的页面再回退到 `includes/page-*.php`：

```php
if (file_exists('includes/page-' . $base_taxonomy . '.php')) {
    require('includes/page-' . $base_taxonomy . '.php');
} else if (file_exists(TEMPLATE_PATH . '/page-' . $page_name . '.php')) {
    require(TEMPLATE_PATH . '/page-' . $page_name . '.php');  // 主题自定义页面
} else {
    require('includes/page-404.php');
}
```

## 主题与前台页面的协作

| 前台页面 | 模板来源 |
| --- | --- |
| 首页 | `home.php`（主题）或 `includes/page-homepage.php` |
| 游戏详情 | `game.php`（主题） |
| 分类/标签/归档 | `category.php` / `tag.php` / `archive.php` |
| 搜索 | `search.php` |
| 文章/页面 | `post.php` / `page.php` |
| 404 | `404.php` |

主题模板调用 `theme-functions.php` 与 `commons.php` 提供的函数获取数据（见 [模板函数](/theming/template-functions)）。

## 主题元数据（info.json）

```json
{
  "name": "Default",
  "version": "1.2.2",
  "author": "CloudArcade",
  "description": "Default Theme",
  "website": "https://cloudarcade.net",
  "release_date": "05/04/2025",
  "changelog": "Implement better Blog structure, apply multilanguage search...",
  "type": "theme",
  "html": "",
  "target_version": "2.0.9"
}
```

后台主题列表读取该文件展示；`target_version` 用于兼容性检查；`changelog` 记录版本变更。

## 主题钩子（全局）

`theme-functions.php` 提供全局钩子机制，主题模板与插件均可使用：

```php
// 注册钩子
function add_to_hook($hook_name, $callback) { ... }
// 触发钩子
function run_hook($hook_name) { ... }

// 过滤器
function add_filter($tag, $function_to_add) { ... }
function apply_filters($tag, $value) { ... }

// 短代码
function add_shortcode($tag, $callback) { ... }
function run_shortcode($text) { ... }
```

典型用法（主题 `header.php`）：

```php
<title><?php echo apply_filters('site_title', get_page_title()) ?></title>
<meta name="description" content="<?php echo apply_filters('meta_description', substr($meta_description, 0, 360)) ?>">
```

## 主题选项

主题可在 `functions.php` 注册选项，后台「外观 → 主题选项」页配置，保存到 `prefs` 表（详见 [外观与主题](/admin/appearance)）。

## 开发一套新主题

1. 在 `content/themes/` 下新建目录，如 `my-theme/`
2. 编写 `info.json`（必需字段齐全）
3. 编写页面模板：`home.php`、`game.php`、`category.php`、`search.php`、`404.php` 等
4. 编写 `functions.php` 注册小工具、选项与钩子
5. 在后台启用该主题

::: tip
主题不修改核心文件，升级系统不会覆盖主题；同样地，主题开发应只依赖 `theme-functions.php` 与 `commons.php` 提供的公共 API。
:::
