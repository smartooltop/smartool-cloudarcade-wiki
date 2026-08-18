# 主题结构

以内置的 `default` 与 `dark-grid` 主题为例，说明主题目录的文件结构与职责。

## 主题目录结构（default）

```
content/themes/default/
├── info.json            # 主题元数据（名称/版本/作者/兼容版本）
├── functions.php        # 主题函数与小工具注册
├── layout.php           # 整体布局模板
├── home.php             # 首页模板
├── game.php             # 游戏详情页模板
├── category.php         # 分类页模板
├── tag.php              # 标签页模板
├── archive.php          # 归档页模板
├── search.php           # 搜索页模板
├── post.php             # 文章页模板
├── post-list.php        # 文章列表模板
├── page.php             # 自定义页面模板
├── 404.php              # 404 页面模板
├── includes/            # 主题局部模板
│   ├── header.php       # 头部（含 <head>、导航）
│   ├── footer.php       # 页脚
│   ├── grid.php         # 游戏网格
│   └── custom.php       # 自定义区域
├── parts/               # 可复用部件
│   ├── head.php         # <head> 细节
│   ├── navigation-top.php    # 顶部导航
│   ├── navigation-categories.php  # 分类导航
│   ├── sidebar.php      # 侧边栏（小工具区域）
│   ├── footer-widget-1/2/3.php  # 页脚小工具区
│   ├── footer-copyright.php    # 版权信息
│   └── ad-banner-300/728.php   # 广告位
├── js/                  # 主题脚本
│   ├── script.js
│   └── custom.js
├── style/               # 主题样式
│   ├── style.css
│   ├── custom.css
│   └── user.css
└── images/              # 主题图片（占位图、图标等）
```

## 各文件职责

### functions.php

主题入口函数，可包含：

- 注册小工具（`register_widget('Widget_Game_List')`）
- 定义列表渲染函数（`list_games`、`list_categories`）
- 注册钩子与过滤器

```php
function list_categories() { ... }      // 分类列表
function list_games($type, $amount, $count = false) { ... }  // 游戏列表
function wgt_list_games_grid($type, $amount) { ... }         // 网格小工具
function wgt_list_games_vertical($type, $amount) { ... }     // 竖向小工具

register_widget('Widget_Game_List');    // 注册游戏列表小工具
```

### includes/header.php 与 footer.php

页面骨架：

```php
<!-- includes/header.php -->
<!DOCTYPE html>
<html>
<head>
    <title><?php echo apply_filters('site_title', get_page_title()) ?></title>
    <meta name="description" content="<?php echo apply_filters('meta_description', ...) ?>">
    <!-- 主题样式、插件头部注入 load_plugin_headers() -->
</head>
<body>
    <!-- 顶部导航 -->
    <?php render_nav_menu('top_nav') ?>
```

```php
<!-- includes/footer.php -->
    <!-- 页脚小工具区、版权 -->
    <?php load_plugin_footers() ?>   <!-- 插件页脚注入 -->
</body>
</html>
```

### parts/sidebar.php

侧边栏，渲染已配置的小工具：

```php
<?php
// 遍历小工具配置，调用 the_widget() 输出
foreach ($stored_widgets as $widget_name => $instance) {
    the_widget($widget_name, $instance);
}
?>
```

### 页面模板

每个页面模板负责拉取数据并渲染：

```php
<!-- game.php（简化） -->
<?php
$slug = isset($_GET['slug']) ? $_GET['slug'] : '';
$game = Game::getBySlug($slug);       // 获取游戏
?>
<h1><?php echo $game->title ?></h1>
<div class="game-frame">
    <iframe src="<?php echo $game->url ?>" width="<?php echo $game->width ?>"
            height="<?php echo $game->height ?>" allowfullscreen></iframe>
</div>
<?php render_game_comments($game->id) ?>  <!-- 评论 -->
```

## dark-grid 主题差异

`dark-grid` 与 `default` 结构基本一致，差异在于：

- 新增 `includes/grid-masonry.php`（瀑布流布局）
- 无 `layout.php`，改用各自页面模板直接输出
- 使用 `parts/navigation-*.php` 相同的导航结构

## 主题与全局模板的协作

| 职责 | 归属 |
| --- | --- |
| 数据模型与业务逻辑 | `classes/`、`includes/commons.php` |
| 全局主题函数 | `content/themes/theme-functions.php` |
| 页面骨架与样式 | 主题目录（`includes/header.php` 等） |
| 页面分发 | `index.php`（回退 `includes/page-*.php`） |

::: tip
开发主题时优先复用 `theme-functions.php` 中的现成函数（`fetch_games_by_type`、`render_nav_menu` 等），保持与核心解耦，见 [模板函数](/theming/template-functions)。
:::
