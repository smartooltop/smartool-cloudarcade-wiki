# Game 游戏类

`Game` 类是 CloudArcade 最核心的数据模型（`classes/Game.php`，约 1100 行），封装了游戏实体的属性、查询、增删改（**CRUD**）、标签/分类关联与游戏目录管理。

## 类概览

```php
class Game
{
    // 公共属性：id、title、description、instructions、category、source、
    // game_type、thumb_1/2、thumb_small、url、width、height、tags、views、
    // upvote、downvote、slug、data、is_mobile、is_premium、published 等

    public function __construct($data = array())
    public function storeFormValues($params)
    // ... 大量静态查询方法与实例操作方法
}
```

## 构造与赋值

```php
public function __construct($data = array())
```

从数据库行或表单数组构造对象，逐个赋值属性。`storeFormValues($params)` 则用 `$_POST` 等参数重新构造，常用于后台表单提交。

## 静态查询方法（按 slug / id / 条件）

| 方法 | 说明 |
| --- | --- |
| `getById($id)` | 按主键查询单个游戏 |
| `getByTitle($title)` | 按标题查询 |
| `getBySlug($slug)` | 按 **SLUG** 查询（前台详情页使用） |
| `getList($amount, $sort, $page, $count)` | 分页获取游戏列表，支持排序 |
| `getListByType($game_type, ...)` | 按游戏类型（html5 等）筛选 |
| `getDraftList(...)` | 获取草稿列表（`published = 0`） |
| `getSimilarGames($amount)` | 获取相似游戏（同分类推荐） |
| `getTotalGames()` | 游戏总数 |
| `searchGame($keyword, ...)` | 关键字搜索 |
| `searchGameMultilingual($keyword, ...)` | 多语言搜索（查询 `translations` 表） |
| `getListBySource($source, ...)` | 按来源筛选（url/json/upload 等） |
| `getListByTag($tag, ...)` | 按标签获取游戏（JOIN `tag_links`） |

### 典型实现：getBySlug

```php
public static function getBySlug($slug)
{
    $conn = open_connection();
    $sql = 'SELECT * FROM games WHERE slug = :slug LIMIT 1';
    $st = $conn->prepare($sql);
    $st->bindValue(":slug", $slug, PDO::PARAM_STR);
    $st->execute();
    $row = $st->fetch();
    if ($row) {
        return new Game($row);
    }
    return null;
}
```

统一使用 **PDO** 预处理语句防 **SQL INJECTION**；查询结果包装为 `Game` 对象返回。

## 互动与统计

| 方法 | 作用 |
| --- | --- |
| `update_views($slug)` | 增加浏览量（同步更新 `trends` 每日趋势） |
| `upvote($id)` / `downvote($id)` | 投票数增减（防重复由 `votelogs` 表 + IP 控制） |

```php
public static function update_views($slug)
{
    // UPDATE games SET views = views + 1 WHERE slug = :slug
    // 同时更新 trends 表的当日浏览量
}
```

## 分类与标签

| 方法 | 作用 |
| --- | --- |
| `getCategoryList()` | 获取游戏的分类列表 |
| `get_categories()` | 获取分类关联（`cat_links`） |
| `update_category($category)` | 更新分类关联 |
| `get_tags()` | 获取标签列表 |
| `update_tags($tags)` | 同步 `tags` / `tag_links` 表（先删后插，维护计数） |

`update_tags` 的实现要点：将逗号分隔的标签拆分为数组，逐条写入 `tags` 表（不存在则新建，`usage_count` 递增），再重建 `tag_links` 关联。

## 会员相关

| 方法 | 作用 |
| --- | --- |
| `isPremium()` | 是否会员专属游戏（`is_premium = 1`） |
| `setPremium($val)` | 设置会员属性，更新数据库 |

## 自定义字段

| 方法 | 作用 |
| --- | --- |
| `getExtraField($key)` | 读取 `extra_fields` 中的自定义字段 |
| `get_fields()` / `get_field($key)` | 读取 `fields` 字段（JSON） |

自定义字段由 `extra_fields` 表定义，支持在后台为游戏扩展属性。

## 写入操作：insert / update / delete

### insert —— 事务化插入

```php
public function insert()
{
    apply_admin_filters('pre_game_insert', $this);   // 插件钩子

    $conn = open_connection();
    $conn->beginTransaction();  // 开启事务保证原子性
    try {
        $sql = 'INSERT INTO games (createdDate, title, ...) VALUES (:createdDate, :title, ...)';
        $st = $conn->prepare($sql);
        $st->bindValue(":slug", esc_slug($this->slug), PDO::PARAM_STR);
        // ... 绑定全部字段
        $st->execute();
        $game_id = $conn->lastInsertId();
        $this->id = $game_id;

        if (!is_null($this->tags) && $this->tags != '') {
            $this->update_tags($this->tags);   // 同步标签
        }
        $conn->commit();

        apply_admin_filters('after_game_insert', $this);
        if (function_exists('log_action')) {
            log_action('create', 'game', $this->id, $this->title);  // 审计日志
        }
    } catch (Exception $e) {
        $conn->rollBack();
        throw $e;
    }
}
```

特点：

- **事务（TRANSACTION）**保证「游戏主记录 + 标签关联」要么全部成功，要么全部回滚
- 插入前/后触发插件钩子（`apply_admin_filters`）
- 自动写入 `action_logs` 审计日志
- `slug` 经 `esc_slug()` 净化

### update / delete

`update()` 更新游戏记录与标签关联；`delete()` 删除游戏，并通过 `remove_game_folder()` 清理上传的游戏目录（`content/games/` 或上传目录），同时清理关联数据。

```php
public function remove_game_folder()
{
    // 删除游戏上传目录，避免残留文件
}
```

## 使用场景

| 场景 | 调用 |
| --- | --- |
| 前台游戏详情页 | `Game::getBySlug($slug)` + `update_views($slug)` |
| 首页/列表页 | `Game::getList($amount, $sort, $page)` |
| 搜索页 | `Game::searchGame($keyword)` |
| 分类页 | `Category::getListByCategory(...)` 或 `Game::getListByCategory` |
| 后台添加游戏 | 构造对象 → `storeFormValues($_POST)` → `insert()` |

## 小结

`Game` 类承担了游戏业务的主要逻辑：查询封装、防注入的写入、标签分类同步、会员标记、统计更新与目录清理，是理解整个站点数据流的关键入口。
