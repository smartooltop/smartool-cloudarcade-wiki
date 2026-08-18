# 插件管理

插件管理位于 `admin/core/plugins.php` 及 `plugin-*.php`，支持插件列表、启用/停用、上传安装、仓库安装与更新。插件系统机制详见 [插件机制](/plugins/plugin-system)。

## 相关文件

| 文件 | 作用 |
| --- | --- |
| `plugins.php` | 插件列表与管理 |
| `plugin-repository.php` | 插件仓库浏览 |
| `plugin-upload.php` | 上传插件包 |
| `plugin-install-premium.php` | 安装付费插件 |
| `plugin.php`（includes） | 插件加载与钩子 |

## 插件列表（plugins.php）

遍历 `content/plugins/` 目录，读取每个插件的 `info.json`：

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

### 启停约定

- 目录名以 `_` 开头 → **停用**（如 `_my-plugin`）
- 正常目录名 → 启用，自动加载其 `header.php`、`footer.php`、`admin-hook.php`

```php
function get_plugin_list() {
    $dirs = scan_folder(PLUGIN_PATH);
    foreach ($dirs as $dir) {
        $info = get_plugin_info($dir);
        if ($info) {
            array_push($list, $info);
            // 目录名不以 _ 开头 → 收集 header/footer/admin-hook 文件
            if (substr($info['dir_name'], 0, 1) != '_') {
                // $plugin_footer[] / $plugin_header[] / $plugin_admin_hooks[]
            }
        }
    }
    return $list;
}
```

### 操作

| 操作 | 实现 |
| --- | --- |
| 启用/停用 | 重命名目录前缀 `_`（`plugin_action()`） |
| 删除 | 删除插件目录 |
| 更新 | 见下文 |

## 上传安装（plugin-upload.php）

上传 zip 插件包 → 解压到 `content/plugins/<name>/` → 校验 `info.json` 完整性：

```php
function get_plugin_info($name) {
    $json_path = $plugin_dir . '/info.json';
    if (file_exists($json_path)) {
        $array = json_decode(file_get_contents($json_path), true);
        // 校验必需字段：name/version/author/description/
        // require_version/tested_version/type/target
        if (所有必需字段齐全) {
            return $array;
        }
    }
    return false;
}
```

必需字段缺失的插件会被拒绝。

## 仓库安装（plugin-repository.php）

后台浏览官方/第三方插件仓库，一键安装：

```php
function add_plugin_from_repository($plugin_slug) {
    // 从仓库 API 获取插件包下载地址
    // 下载 → 校验 → 解压到 content/plugins/
    // 返回安装结果
}
```

## 付费插件安装（plugin-install-premium.php）

`install_product($email, $purchaseCode, 'plugin')` 处理付费插件安装：

```php
function install_product($email, $purchaseCode, $type = 'plugin') {
    // 向官方 API 提交邮箱与购买码
    // 验证通过后返回下载链接
    // 下载并解压安装
}
```

## 插件更新

`admin/includes/ajax-actions.php` 提供更新接口：

| action | 说明 |
| --- | --- |
| `get_plugin_updates_data` | 批量检查插件更新 |
| `update_plugin` | 更新普通插件 |
| `update_premium_plugin` | 更新付费插件（校验购买码） |
| `set_plugin_updates_notification` | 设置插件更新通知 |
| `get_plugin_repo_list` | 获取仓库插件列表 |

更新流程：检查 `info.json` 版本 → 对比源版本 → 下载新包 → 备份旧版 → 覆盖安装。

## 插件与钩子

插件通过钩子接入站点：

| 钩子位置 | 用途 |
| --- | --- |
| `header.php` | 前台 `<head>` 注入（样式/脚本） |
| `footer.php` | 前台页脚注入 |
| `admin-hook.php` | 后台注入（管理页面扩展） |
| `add_admin_hook` / `add_admin_filter` | 代码级钩子 |

详见 [插件机制](/plugins/plugin-system)。

::: tip
`content/plugins/` 目录必须以 `_` 前缀临时停用插件，删除目录即彻底卸载；更新前建议先备份插件目录。
:::
