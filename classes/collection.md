# Collection 合集类

`Collection` 类（`classes/Collection.php`）管理「游戏合集」，即将一批游戏打包为一个集合，例如「本周热门」「编辑推荐」。对应 `collections` 表。

## 类概览

```php
class Collection
{
    public function __construct($data = array())
    public function storeFormValues($params)

    // 静态查询
    public static function getById($id)
    public static function getByName($name)
    public static function getBySlug($slug)
    public static function getIdByName($name)
    public static function getList($numRows = 1000000)
    public static function getListByCollection($name, $amount = 12, $page = 0)

    // 判断
    public function isCollectionExist($name)

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
| name | name | 合集名称 |
| slug | slug | URL 别名 |
| data | data | 游戏 id 列表（JSON 格式） |
| description | description | 合集描述 |
| allow_dedicated_page | allow_dedicated_page | 是否允许独立页面展示（BOOLEAN） |

## 核心方法

### getListByCollection —— 获取合集内游戏

```php
public static function getListByCollection($name, $amount = 12, $page = 0)
```

1. 按名称找到合集
2. 解析 `data` 字段中的游戏 id 列表（JSON 数组）
3. 使用 `Game::getList(...)` 或按 id 批量查询，分页返回游戏对象

这是前台合集页与首页合集模块的核心查询。

### data 字段结构

合集内游戏以 JSON 数组形式存储在 `data` 列中：

```json
[12, 34, 56, 78]
```

即一组游戏主键 id，读取时按此列表取游戏。该设计避免了额外的关联表，结构简单；缺点是游戏 id 变更时需要同步更新。

### isCollectionExist

判断同名合集是否已存在，供后台表单查重：

```php
public function isCollectionExist($name)
{
    // SELECT COUNT(*) FROM collections WHERE name = :name
}
```

## 写入操作

- `insert()`：插入合集，`data` 序列化为 JSON
- `update()`：更新合集信息与游戏列表
- `delete()`：删除合集记录（不影响游戏本身）

全部使用 **PDO** 预处理语句防注入。

## 使用场景

| 场景 | 调用 |
| --- | --- |
| 前台合集页 | `Collection::getBySlug($slug)` + `getListByCollection($name, $amount, $page)` |
| 首页合集模块 | `Collection::getList()` 遍历各合集 |
| 后台合集管理 | `insert()` / `update()` / `delete()` |
