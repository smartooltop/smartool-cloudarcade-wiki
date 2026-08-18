# Category 分类类

`Category` 类（`classes/Category.php`）封装游戏分类的查询与增删改（**CRUD**），对应 `categories` 与 `cat_links` 两张表。

## 类概览

```php
class Category
{
    public function __construct($data = array())
    public function storeFormValues($params)

    // 静态查询
    public static function getById($id)
    public static function getBySlug($slug)
    public static function getByName($name)
    public static function getIdByName($name)
    public static function getIdBySlug($slug)
    public static function getList($numRows = 1000)
    public static function getCategoryCount($id)
    public static function getListByCategory($id, $amount, $page = 0)
    public static function getListByCategories($ids, $amount, $page = 0, $random = true)

    // 关联与判断
    public function addToCategory($gameID, $catID)
    public function isCategoryExist($name)

    // 自定义字段
    public function getExtraField($key)
    public function get_fields()
    public function get_field($key)

    // 写入
    public function insert()
    public function update()
    public function delete()
}
```

## 主要属性

| 属性 | 对应字段 | 说明 |
| --- | --- | --- |
| id | id | 主键 |
| name | name | 分类名称 |
| slug | slug | URL 别名，用于分类页地址 |
| description | description | 分类描述 |
| meta_description | meta_description | **META DESCRIPTION** |
| priority | priority | 排序优先级 |
| fields / extra_fields | fields / extra_fields | 自定义字段 |

## 查询方法详解

### 基础查询

```php
public static function getBySlug($slug)
{
    // SELECT * FROM categories WHERE slug = :slug LIMIT 1
    // 返回 Category 对象或 null
}
```

`getById`、`getByName` 同理，分别按主键、名称查询。`getIdByName` / `getIdBySlug` 只返回 id。

### 列表查询

```php
public static function getList($numRows = 1000)
// 获取全部分类，按 priority 排序，常用于导航栏与分类列表页
```

### 分类下的游戏

```php
public static function getListByCategory($id, int $amount, int $page = 0)
// 通过 cat_links 关联表，分页获取某分类下的游戏

public static function getListByCategories($ids, int $amount, int $page = 0, $random = true)
// 获取多个分类下的游戏，$random 为 true 时随机排序（用于推荐/首页）
```

`getCategoryCount($id)` 统计某分类下的游戏数量。

### 关联操作

```php
public function addToCategory($gameID, $catID)
// INSERT INTO cat_links (gameid, categoryid) VALUES (:gameID, :catID)
```

`isCategoryExist($name)` 判断分类名是否已存在（后台添加前查重）。

## 写入操作

`insert()` 使用 **PDO** 预处理语句插入分类并返回新 id；`update()` 更新分类信息（同时刷新 slug）；`delete()` 删除分类及其在 `cat_links` 中的关联记录。

```php
public function delete()
{
    // DELETE FROM categories WHERE id = :id
    // DELETE FROM cat_links WHERE categoryid = :id
}
```

删除分类不会删除游戏本身，仅解除关联。

## 使用场景

| 场景 | 调用 |
| --- | --- |
| 前台分类页 | `Category::getBySlug($slug)` + `getListByCategory($id, $amount, $page)` |
| 顶部导航分类菜单 | `Category::getList()` |
| 首页推荐 | `getListByCategories($ids, $amount, $random = true)` |
| 后台分类管理 | `insert()` / `update()` / `delete()` |
