# 插件机制

插件（**PLUGIN**）以独立目录形式扩展站点功能，位于 `content/plugins/`。核心逻辑在 `includes/plugin.php`，通过约定文件与钩子（**HOOK**）接入前台和后台。

## 插件目录约定

```
content/plugins/
├── my-plugin/
│   ├── info.json        # 插件元数据（必需）
│   ├── public.php       # 前台入口（main.php 已废弃）
│   ├── header.php       # 注入前台 <head>
│   ├── footer.php       # 注入前台页脚
│   ├── admin-hook.php   # 注入后台
│   └── ...其他文件
└── _disabled-plugin/    # 下划线前缀 = 停用
```

| 文件 | 作用 |
| --- | --- |
| `info.json` | 元数据，必需字段校验 |
| `public.php` | 前台加载入口（`load_plugins('index')` 时执行） |
| `header.php` | 前台头部注入（`load_plugin_headers()`） |
| `footer.php` | 前台页脚注入（`load_plugin_footers()`） |
| `admin-hook.php` | 后台注入（`load_admin_hooks()`） |

目录名以 `_` 开头表示**停用**，不会加载任何文件。

## 元数据（info.json）

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "author": "...",
  "description": "...",
  "require_version": "2.0.0",
  "tested_version": "2.1.3",
  "type": "plugin",
  "target": "index"
}
```

必需字段：`name`、`version`、`author`、`description`、`require_version`、`tested_version`、`type`、`target`。缺任一项即视为无效插件。

## 插件加载流程

### 1. 收集插件列表

```php
function get_plugin_list() {
    $dirs = scan_folder(PLUGIN_PATH);      // 扫描插件目录
    foreach ($dirs as $dir) {
        $info = get_plugin_info($dir);     // 读取并校验 info.json
        if ($info) {
            array_push($list, $info);
            // 启用的插件（非 _ 前缀）收集 header/footer/admin-hook 文件
        }
    }
    return $list;
}

function get_active_plugin_list() {
    // 过滤掉 _ 前缀的停用插件
}
```

### 2. 按 target 加载前台入口

```php
function load_plugins($type) {
    global $plugin_list;
    foreach ($plugin_list as $plugin) {
        if ($plugin['target'] == $type) {           // target 匹配（如 'index'）
            if (substr($plugin['dir_name'], 0, 1) != '_') {   // 未停用
                if (file_exists($plugin['path'] . '/public.php')) {
                    require_once($plugin['path'] . '/public.php');
                } else if (file_exists($plugin['path'] . '/main.php')) {
                    // v1.7.8 起 main.php 废弃，向后兼容
                    require_once($plugin['path'] . '/main.php');
                }
            }
        }
    }
}
```

前台 `index.php` 调用 `load_plugins('index')`，插件即通过 `public.php` 注册钩子、短代码或输出内容。

### 3. 头部/页脚注入

主题模板中调用：

```php
// 主题 includes/header.php
load_plugin_headers();   // 引入所有启用插件的 header.php

// 主题 includes/footer.php
load_plugin_footers();   // 引入所有启用插件的 footer.php
```

```php
function load_plugin_headers() {
    global $plugin_header;
    if (count($plugin_header)) {
        foreach ($plugin_header as $hd) {
            include_once $hd;   // 输出插件的 <link>/<script>
        }
    }
}
```

### 4. 后台注入

后台加载插件管理钩子：

```php
function load_admin_hooks() {
    global $plugin_admin_hooks;
    if (count($plugin_admin_hooks)) {
        foreach ($plugin_admin_hooks as $hook_file) {
            require_once $hook_file;   // 插件扩展后台页面
        }
    }
}

function has_admin_hooks($plugin_dir_name)
// 判断插件是否注册了后台钩子（后台插件列表显示标记）
```

## 插件与钩子的接入点

| 接入点 | 方式 |
| --- | --- |
| 前台脚本/样式 | `header.php` / `footer.php` 输出 |
| 前台逻辑 | `public.php` 注册过滤器、短代码、动作钩子 |
| 后台逻辑 | `admin-hook.php` 注册 `add_admin_hook` / `add_admin_filter` |
| 后台管理界面 | 通过钩子向页面注入表单/区块 |
| 数据变更 | `apply_admin_filters('pre_game_insert', ...)` 等过滤器 |

```php
// public.php 示例：注册过滤器
add_filter('site_title', function ($title) {
    return $title . ' - 我的插件';
});
```

## 插件安装与更新

| 方式 | 位置 | 说明 |
| --- | --- | --- |
| 上传安装 | `admin/plugin-upload.php` | 上传 zip 解压到插件目录 |
| 仓库安装 | `admin/plugin-repository.php` | 从仓库一键安装 |
| 付费安装 | `admin/plugin-install-premium.php` | `install_product($email, $code, 'plugin')` |
| 更新 | `admin/includes/ajax-actions.php` | `update_plugin` / `update_premium_plugin` |

## 开发一个插件

1. 在 `content/plugins/` 下建目录 `my-plugin/`
2. 编写 `info.json`（8 个必需字段）
3. 编写 `public.php`：注册钩子/过滤器/短代码
4. 需要注入样式时写 `header.php`；需要后台扩展时写 `admin-hook.php`
5. 上传或直接放入目录，后台启用（去掉 `_` 前缀）

::: tip
插件机制与主题类似：目录即插即用、`_` 前缀停用、`info.json` 描述。开发插件时应只依赖公共 API（`commons.php`、`theme-functions.php`、钩子函数），避免直接修改核心文件，以便随系统升级兼容。
:::
