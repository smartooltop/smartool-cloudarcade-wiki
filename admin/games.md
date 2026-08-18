# 游戏管理

后台游戏管理是站点最常用的模块，位于 `admin/core/` 下，包含游戏列表、添加游戏（多种方式）、编辑与删除。

## 相关文件

| 文件 | 作用 |
| --- | --- |
| `gamelist-list.php` | 游戏列表（分页、搜索、筛选） |
| `gamelist-edit.php` | 编辑游戏 |
| `gamelist.php` | 游戏列表入口 |
| `addgame.php` | 添加游戏（表单） |
| `addgame-fetch.php` | 从 URL 抓取游戏数据 |
| `addgame-json.php` | 从 JSON 导入游戏 |
| `addgame-remote.php` | 远程游戏仓库导入 |
| `addgame-upload.php` | 上传游戏包（zip） |

## 游戏列表

`gamelist-list.php` 使用 `Game::getList2(...)` 分页加载游戏，支持：

- 关键字搜索（`searchGame`）
- 按状态筛选（published / draft）
- 排序（时间、浏览量、投票）
- 批量操作

常用查询：

```php
Game::getList($amount, $sort, $page, $count)   // 分页列表
Game::searchGame($keyword, $amount, $page)     // 搜索
Game::getDraftList($amount, $sort, $page)      // 草稿
```

## 添加游戏

### 1. 表单添加（addgame.php / add_game）

`admin-functions.php` 的 `add_game()` 处理表单提交：

```php
function add_game() {
    // 构造 Game 对象
    $game = new Game();
    $game->storeFormValues($_POST);
    // 处理缩略图上传（upload_thumb）
    // 插入数据库
    $game->insert();
    // 跳转到游戏列表
}
```

表单字段与 `games` 表一一对应：标题、描述、操作说明、分类、标签、**SLUG**、游戏 URL、宽高、缩略图、是否移动端、是否发布等。

### 2. URL 抓取（addgame-fetch.php）

输入游戏主页 URL，自动抓取标题、描述、缩略图并生成游戏记录。涉及 `includes/fetch.php` 的远程抓取逻辑。

### 3. JSON 导入（addgame-json.php）

粘贴或上传 JSON 数据批量导入游戏，适合从其他站点迁移数据。

### 4. 远程仓库（addgame-remote.php）

从官方/第三方游戏仓库浏览并一键导入游戏。

### 5. 上传游戏包（addgame-upload.php）

上传 zip 游戏包（含 HTML5 游戏文件），解压到游戏目录并登记入库：

```php
// 处理上传 → 解压到 content/games/<slug>/
// 读取 index.html 生成游戏记录
// 生成缩略图（image_to_webp）
```

## 编辑与删除

`gamelist-edit.php` 加载 `Game::getById($id)` 编辑，保存时：

```php
$game->storeFormValues($_POST);
$game->update();   // 更新记录 + 标签关联
```

删除时：

```php
$game->delete();                 // 删除数据库记录
$game->remove_game_folder();     // 清理游戏目录
```

删除动作会写入 `action_logs` 审计日志（`log_action('delete', 'game', ...)`）。

## 相关联动

| 功能 | 位置 |
| --- | --- |
| 分类管理 | `categories*.php`，见 [内容管理](/admin/content) |
| 合集管理 | `collections*.php` |
| 缩略图处理 | `admin-functions.php` 的 `import_thumbnail` / `save_remote_thumbnail` |
| 多语言翻译 | `update_content_translation()`（translations 表） |
| 重复检测 | 添加时按标题/slug 查重 |

## 建议流程

1. 上传/抓取/导入游戏，审核缩略图与描述
2. 设置分类与标签，完善 **SEO** 信息（描述、slug）
3. 标记发布（published = 1）后前台即可访问
4. 需要会员专属时设置 `is_premium`
