# 外观与主题

外观管理涉及主题的安装、启用与选项配置，位于 `admin/core/themes.php` 与 `theme-options.php`。主题系统详见 [主题系统](/theming/overview)。

## 相关文件

| 文件 | 作用 |
| --- | --- |
| `themes.php` | 主题列表、启用、删除 |
| `theme-options.php` | 当前主题的选项配置 |
| `widgets.php` | 小工具（外观模块） |
| `menus.php` | 导航菜单 |

## 主题管理（themes.php）

后台展示 `content/themes/` 下的全部主题，读取每个主题的 `info.json` 元数据：

```json
{
  "name": "default",
  "version": "1.0.0",
  "author": "CloudArcade",
  "description": "默认主题",
  ...
}
```

### 操作

| 操作 | 实现 |
| --- | --- |
| 列表 | `scan_folder('content/themes')` + 读取 info.json |
| 启用 | 更新设置 `theme_name` 为所选主题 |
| 删除 | 删除主题目录（当前启用主题不可删） |

启用主题：

```php
// admin-functions.php 或 settings 处理
update_setting('theme_name', $themeName);
// 前台 TEMPLATE_PATH 立即指向新主题
define("TEMPLATE_PATH", "content/themes/" . THEME_NAME);
```

### 上传主题

通过后台或 `install_product($email, $purchaseCode, 'theme')` 安装主题包（zip），解压到 `content/themes/`。

## 主题选项（theme-options.php）

每个主题可以在 `functions.php` 中注册自己的选项（如配色、布局、Logo、广告位），后台以表单呈现：

```php
// 主题 functions.php 中注册选项
// $options = [ 'option_name' => ['label' => ..., 'type' => ..., 'default' => ...] ]
```

保存时写入 `prefs` 表：

```php
// 读取
$option = get_pref('theme-option-name');
// 保存
update_option('theme-option-name', $value);
```

`site-settings.php` 中部分选项映射为常量：

```php
define("THEME_NAME", $options['theme_name']);
define("TEMPLATE_PATH", "content/themes/" . THEME_NAME);
```

## 主题更新

后台通过 `check_theme_updates` AJAX 检查主题是否有新版本：

```php
if ($action == 'check_theme_updates') {
    // 读取主题 info.json 的版本
    // 对比官方源/仓库的版本
    // 返回 status: current / update
}
```

## 站点 Logo 与图标

后台「设置」页面上传站点资源：

| 上传项 | 处理函数 |
| --- | --- |
| 站点 Logo | `upload_logo()` |
| 登录页 Logo | `upload_login_logo()` |
| 站点图标（favicon） | `upload_icon()` |

```php
function upload_logo() {
    // 处理 $_FILES 上传
    // 保存到 images/ 目录
    // 更新 site_logo 设置
}
```

## 外观相关设置

| 设置 | 类别 | 作用 |
| --- | --- | --- |
| theme_name | appearance | 当前主题 |
| site_logo | general | 站点 Logo |
| logo 尺寸 | appearance | 头部 Logo 尺寸 |
| 主题选项 | prefs | 各主题自定义项 |

::: tip
主题开发者可通过钩子（`add_admin_hook('theme_options', ...)`）向主题选项页注入自定义字段。
:::
