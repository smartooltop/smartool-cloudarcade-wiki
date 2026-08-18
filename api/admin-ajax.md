# 后台 AJAX 接口

后台 AJAX 接口位于 `admin/includes/ajax-actions.php`，是后台管理界面的动态动作处理入口（小工具排序、主题更新、插件管理、系统更新等）。通过 `admin.php` → `admin/request.php` 加载，并使用 `has_admin_access()` 校验权限。

## 请求流程

```php
<?php
require('../../config.php');       // 加载配置
require('../../init.php');         // 初始化（会话、数据库、公共函数）
require('../admin-functions.php'); // 后台公共函数

if (isset($_POST['action'])) {
    $action = $_POST['action'];

    $super_user = false;
    if (has_admin_access()) {      // 管理员权限校验
        $super_user = true;
    }

    // 按 action 分发处理
    if ($action == 'upload_image') { ... }
    elseif ($action == 'save_widgets_position') { ... }
    ...
}
```

权限校验通过 `admin-functions.php` 的 `has_admin_access()`，未授权请求不会进入处理逻辑。

## 接口清单

| action | 说明 |
| --- | --- |
| `upload_image` | 上传图片（编辑器/封面） |
| `delete_image` | 删除图片 |
| `save_widgets_position` | 保存小工具拖拽排序 |
| `update_widget` / `delete_widget` | 更新/删除小工具配置 |
| `check_theme_updates` | 检查主题更新 |
| `check_cms_update` | 检查系统（CMS）更新 |
| `update_alert` / `unset_update_alert` | 设置/取消更新提醒 |
| `get_plugin_list` | 获取插件列表 |
| `get_plugin_updates_data` | 获取插件更新数据 |
| `set_plugin_updates_notification` | 设置插件更新通知 |
| `get_plugin_repo_list` | 获取插件仓库列表 |
| `update_plugin` / `update_premium_plugin` | 更新普通/付费插件 |
| `get_quote` | 获取报价（授权相关） |
| `generate_token_wp` | 生成令牌（WordPress 兼容场景） |
| `change_admin_theme` | 切换后台主题 |
| `fetch_games_by_type` | 按类型拉取游戏 |
| `submit_support_request` | 提交支持请求 |
| `get_premium_product_updates` | 获取付费产品更新 |
| `system_update` | 执行系统更新 |
| `get_recent_games_for_picker` | 游戏选择器：最近游戏 |
| `search_games_for_picker` | 游戏选择器：搜索游戏 |
| `get_games_by_ids` | 按 ID 批量获取游戏 |

## 核心接口详解

### 小工具管理

```php
if ($action == 'save_widgets_position') {
    $data = $_POST['data'];
    $has_access = $login_user->hasAccess('layout', 'widgets');  // 权限检查
    // 保存各小工具的位置与顺序到 prefs 表
}

elseif ($action == 'update_widget') {
    // 更新小工具配置（instance 参数）
}

elseif ($action == 'delete_widget') {
    // 移除小工具
}
```

注意：小工具操作通过 `$login_user->hasAccess('layout', 'widgets')` 检查页面级权限（见 [User 类](/classes/user)）。

### 更新检查与提醒

```php
if ($action == 'check_theme_updates') {
    // 调用主题信息接口，检查主题是否有新版本
}

elseif ($action == 'check_cms_update') {
    // 实例化 SystemUpdater，调用 checkUpdate()
    // 返回 status: current / update / error
}

elseif ($action == 'update_alert') {
    // 记录"有更新"提醒，后台顶部显示通知
}

elseif ($action == 'unset_update_alert') {
    // 清除更新提醒
}
```

### 插件管理

```php
if ($action == 'get_plugin_list') {
    // 返回已安装插件列表（名称、版本、状态）
}

elseif ($action == 'get_plugin_updates_data') {
    // 批量检查插件更新
}

elseif ($action == 'update_plugin') {
    // 下载并安装插件新版本
    // 需要插件仓库或官方源支持
}

elseif ($action == 'update_premium_plugin') {
    // 付费插件更新（校验购买码）
}

elseif ($action == 'get_plugin_repo_list') {
    // 获取可安装的插件仓库列表
}
```

### 系统更新

```php
elseif ($action == 'system_update') {
    // 调用 SystemUpdater::performUpdate()
    // 包含：下载更新包 → 备份 → 校验 → 解压安装 → 数据库更新
}
```

完整流程见 [SystemUpdater 系统更新类](/classes/system-updater)。

### 游戏选择器

后台在编辑游戏、设置合集时用于挑选游戏：

```php
elseif ($action == 'get_recent_games_for_picker') {
    // 返回最近添加的游戏列表（id + title）
}

elseif ($action == 'search_games_for_picker') {
    // 按关键字搜索游戏（用于游戏选择器）
}

elseif ($action == 'get_games_by_ids') {
    // 根据 id 数组批量返回游戏信息
}
```

### 图片处理

```php
if ($action == 'upload_image') {
    // 处理 $_FILES 上传，保存到上传目录
    // 生成缩略图（imgResize / image_to_webp）
    // 返回图片 URL
}

elseif ($action == 'delete_image') {
    // 删除指定图片文件（校验路径安全）
}
```

## 安全要点

1. **权限校验**：入口通过 `has_admin_access()` 校验管理员身份
2. **页面级权限**：部分操作（如小工具）进一步用 `hasAccess()` 校验
3. **预处理语句**：数据库操作统一使用 **PDO** 绑定参数
4. **文件处理**：上传/删除图片时校验路径，防止目录穿越

::: warning
后台 AJAX 接口涉及敏感操作（系统更新、插件更新、文件上传），务必保证服务器环境安全，并限制后台访问（如 IP 白名单）。
:::
