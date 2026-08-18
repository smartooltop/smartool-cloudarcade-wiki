# Page 页面类

`Page` 类（`classes/Page.php`）管理自定义静态页面（如「关于我们」「联系我们」），对应 `pages` 表。

## 类概览

```php
class Page
{
    public function __construct($data = array())
    public function storeFormValues($params)

    // 静态查询
    public static function getById($id)
    public static function getBySlug($slug)
    public static function getList($numRows = 1000000)
    public static function getList2($amount = 1000, $sort = 'id DESC', $page = 0, $count = true)

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
| title | title | 页面标题 |
| slug | slug | URL 别名（如 about） |
| content | content | 页面正文（富文本） |
| nl2br | nl2br | 是否将换行转换为 `<br>`（`TINYINT` 布尔） |
| createddate | createddate | 创建日期 |
| fields / extra_fields | fields / extra_fields | 自定义字段 |

## 核心方法

### 查询

```php
public static function getBySlug($slug)
// SELECT * FROM pages WHERE slug = :slug LIMIT 1

public static function getList($numRows = 1000000)
// 获取全部页面，常用于导航/页脚链接

public static function getList2($amount = 1000, $sort = 'id DESC', $page = 0, $count = true)
// 分页获取页面列表（后台页面管理列表使用）
```

### 写入

- `insert()`：插入页面，支持 `nl2br` 标志
- `update()`：更新页面
- `delete()`：删除页面

前台通过 `includes/page-page.php` 根据 `slug` 调用 `Page::getBySlug()` 渲染页面内容；`nl2br` 决定正文换行是否转为 `<br>` 标签：

```php
if ($page->nl2br) {
    echo nl2br($page->content);
} else {
    echo $page->content;
}
```

## 与 posts 的区别

| 类型 | 表 | 说明 |
| --- | --- | --- |
| 自定义页面 | `pages` | 静态内容，如关于/帮助页 |
| 文章 | `posts` | 带作者、摘要、状态（published/draft）、归档日期，可做博客 |

`Page` 类管理前者；`posts` 表的模型逻辑集中在 `includes/page-post.php` 与相关查询中。
