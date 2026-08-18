# 模板函数

主题开发的核心 API 集中在 `content/themes/theme-functions.php`（全局，所有主题共享）与 `includes/commons.php`（通用函数库）。本文按用途分类介绍常用模板函数。

## 数据获取

### 游戏列表

```php
function fetch_games_by_type($type, $amount = 12, $page = 0, $count = true)
// 按类型获取游戏（latest / popular / random 等），返回数组或 Game 对象

function fetch_games_by_category($cat_name, $amount, $page = 0)
// 获取某分类下的游戏

function fetch_games_by_tag($tag_name, $amount, $offset = 0, $count = false)
// 获取某标签下的游戏

function fetch_similar_games($game, $amount, $page = 0, $random = true)
// 获取相似游戏（同分类推荐）

function fetch_collection($name, $amount = 12)
// 获取合集内游戏
```

### 分类与标签

```php
function fetch_all_categories($show_hidden_category = false, $show_empty_category = false)
// 获取全部分类（导航/分类列表用）

function fetch_all_tags($sort = 'random', $limit = 100)
// 获取标签（标签云用）
```

### 当前页面判断

```php
function is_home()        // 是否首页
function is_game()        // 是否游戏详情页
function is_category()    // 是否分类页
function is_tag()         // 是否标签页
function is_search()      // 是否搜索页
function is_page()        // 是否自定义页面
function is_post()        // 是否文章页
```

## URL 与链接

```php
function home_url($path = '')
// 站点首页地址（可拼路径）

function get_permalink($type, $slug = '', $arrs = [], $lang = null)
// 生成站内链接（commons.php），如 get_permalink('game', 'my-game')

function get_game_url($game)
// 生成游戏详情链接

function get_canonical_url()
// 当前页面的规范 URL（SEO）

function the_canonical_link()
// 输出 <link rel="canonical" href="...">
```

```php
// 模板中生成游戏链接
<a href="<?php echo get_permalink('game', $game->slug) ?>"><?php echo $game->title ?></a>
```

## 导航渲染

```php
function render_nav_menu($name = 'top_nav', $args = array())
// 渲染菜单（menus 表），$name 为菜单位置名

function render_nav_children($array_menu, $args)
// 渲染菜单子项（多级菜单内部函数）
```

## 页面标题与 SEO

```php
function get_page_title($title_template = 'default')
// 生成 <title>，支持模板变量（%site_name%、%game_title% 等）

function the_html_attrs()
// 输出 <html> 属性（语言等）

function get_site_info($type)
// 获取站点信息（标题、描述、Logo 等）
```

```php
<title><?php echo apply_filters('site_title', get_page_title()) ?></title>
```

## 钩子与过滤器（主题模板中）

```php
// 注册钩子（functions.php 或插件中）
function add_to_hook($hook_name, $callback) { ... }
function run_hook($hook_name) { ... }               // 模板中触发

// 过滤器
function add_filter($tag, $function_to_add) { ... }
function apply_filters($tag, $value) { ... }        // 模板中应用

// 短代码
function add_shortcode($tag, $callback) { ... }
function run_shortcode($text) { ... }
```

典型用法：

```php
<!-- header.php -->
<title><?php echo apply_filters('site_title', get_page_title()) ?></title>
<meta name="description" content="<?php echo apply_filters('meta_description', substr($meta_description, 0, 360)) ?>">
```

## 页面组成

```php
function get_theme_header()   // 引入主题 includes/header.php
function get_theme_footer()   // 引入主题 includes/footer.php
function get_theme_sidebar()  // 引入侧边栏
```

## 交互组件

```php
function render_game_comments($game_id)
// 渲染游戏评论区（jquery-comments 系统）

function can_show_leaderboard()
// 判断是否显示排行榜（分数系统启用时）

function render_pagination($total_page, $cur_page, $display_limit, $pageType, $slug, $htmlOptions)
// 渲染分页器
```

## 用户与翻译

```php
function get_current_user_data()
// 获取当前登录用户数据（JSON）

function get_content_title_translation($content_type, $content_id, $original_title)
// 获取内容标题的多语言翻译

function get_slug_translation($slug)
// 获取 slug 的翻译版本

function the_lang_input()
// 输出语言切换表单
```

## 通用函数（commons.php 精选）

主题模板可直接使用 `includes/commons.php` 的通用函数：

```php
get_all_categories()          // 分类（含游戏数）
get_small_thumb($game)        // 小缩略图地址
get_rating($type, $game)      // 评分/投票数据
translate($str, $val1, $val2) // 多语言翻译
_t($str) / _e($str)           // 翻译/输出翻译
get_user_avatar($username)    // 用户头像
```

## 小工具类函数

主题通过小工具 API 渲染侧边栏模块（见 [Widget 小工具类](/classes/widget)）：

```php
register_widget('Widget_Game_List')   // 注册
the_widget('Widget_Game_List', $instance)  // 输出
```

## 小结

| 类别 | 代表函数 |
| --- | --- |
| 数据获取 | `fetch_games_by_type`、`fetch_games_by_category`、`fetch_collection` |
| 页面判断 | `is_game`、`is_category`、`is_home` |
| URL | `get_permalink`、`get_game_url`、`home_url` |
| SEO | `get_page_title`、`the_canonical_link` |
| 导航 | `render_nav_menu` |
| 钩子 | `apply_filters`、`add_to_hook`、`run_shortcode` |
| 组件 | `render_game_comments`、`render_pagination` |
