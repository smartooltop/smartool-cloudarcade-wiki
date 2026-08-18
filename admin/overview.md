# 后台总览

后台管理界面是站点运营的核心入口，位于 `admin/` 目录。管理员通过 `/admin.php` 进入，由 `admin/request.php` 统一鉴权与分发。

## 入口流程

```
浏览器访问 /admin.php
        │
        ▼
admin.php ──加载──► admin/request.php
                        ├─ require config.php / init.php
                        ├─ require admin-functions.php（后台函数与钩子）
                        ├─ 鉴权：has_admin_access()
                        └─ 分发到 admin/core/*.php 各管理页面
```

```php
// admin/request.php 头部
require_once("../config.php");
require_once("../init.php");
require_once("admin-functions.php");
require("../includes/plugin.php");
```

## 权限体系

### 管理员判定

`includes/sessions.php` 在初始化时根据 `users.role` 定义 `USER_ADMIN` 常量；`admin-functions.php` 提供 `has_admin_access()` 做统一校验：

```php
function has_admin_access() {
    // 判断 USER_ADMIN 或超级管理员
}
```

### 页面级权限

后台部分页面还使用 `User::hasAccess($page, $slug)` 进行细粒度控制（结合 `user_permissions` 表），例如小工具管理需 `hasAccess('layout', 'widgets')`。

## 目录结构

```
admin/
├── index.php              # 后台首页（重定向到 core/dashboard.php）
├── request.php            # 统一入口与鉴权
├── upload.php             # 文件上传处理
├── admin-functions.php    # 后台函数库 + 钩子系统
├── core/                  # 各管理页面
│   ├── dashboard.php      # 仪表盘（统计图表）
│   ├── gamelist.php / gamelist-list.php / gamelist-edit.php  # 游戏管理
│   ├── addgame*.php       # 添加游戏（fetch/json/remote/upload）
│   ├── categories*.php    # 分类管理
│   ├── collections*.php   # 合集管理
│   ├── pages*.php         # 页面管理
│   ├── menus.php          # 菜单管理
│   ├── widgets.php        # 小工具管理
│   ├── themes.php         # 主题管理
│   ├── theme-options.php  # 主题选项
│   ├── plugins.php        # 插件管理
│   ├── plugin-*.php       # 插件上传/仓库/安装
│   ├── settings.php       # 站点设置
│   ├── update.php         # 系统更新
│   └── support.php        # 支持
├── includes/
│   └── ajax-actions.php   # 后台 AJAX 接口
└── style/                 # 后台样式
```

## 钩子系统（Hooks）

后台实现了轻量级**钩子（HOOK）**机制，供主题与插件扩展：

```php
// 注册动作钩子
function add_admin_hook($hook_name, $callback, $priority = 10) { ... }
function do_admin_hook($hook_name, ...$args) { ... }

// 注册过滤器
function add_admin_filter($tag, $function_to_add, $priority = 10) { ... }
function apply_admin_filters($tag, $value) { ... }
```

典型应用（`Game::insert` 中）：

```php
apply_admin_filters('pre_game_insert', $this);    // 插入前
apply_admin_filters('after_game_insert', $this);  // 插入后
```

## 审计日志

后台管理动作（游戏/分类/页面增删改）通过 `log_action()` 写入 `action_logs` 表：

```php
function log_action($action_type, $object_type, $object_id = null, $object_name = null, $details = null) {
    // INSERT INTO action_logs (user_id, username, user_role, action_type, object_type, ...)
}
```

## 后台函数库要点（admin-functions.php）

| 函数 | 作用 |
| --- | --- |
| `has_admin_access()` | 管理员鉴权 |
| `add_admin_hook` / `do_admin_hook` | 动作钩子 |
| `add_admin_filter` / `apply_admin_filters` | 过滤器 |
| `update_setting($name, $value)` | 更新站点设置 |
| `get_setting_group($category)` | 按分组读取设置 |
| `import_thumbnail($url, $slug)` | 远程抓取缩略图 |
| `save_remote_thumbnail(...)` | 保存远程图片为本地 |
| `backup_cms($root, $type)` | 备份站点（文件+数据库） |
| `install_product($email, $code, $type)` | 安装付费产品（主题/插件） |
| `log_action(...)` | 写审计日志 |
| `add_game()` | 添加游戏（表单方式） |
| `plugin_action()` | 插件启用/停用等动作 |

## 各管理模块

| 模块 | 文章 |
| --- | --- |
| 游戏管理 | [游戏管理](/admin/games) |
| 分类/合集/页面/菜单/小工具 | [内容管理](/admin/content) |
| 主题与外观 | [外观与主题](/admin/appearance) |
| 插件管理 | [插件管理](/admin/plugins) |
