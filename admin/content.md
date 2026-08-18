# 内容管理

内容管理涵盖分类、合集、页面、菜单与小工具，位于 `admin/core/` 下，是站点信息架构的组织入口。

## 相关文件

| 文件 | 作用 |
| --- | --- |
| `categories-list.php` / `categories-edit.php` / `categories.php` | 分类管理 |
| `collections-list.php` / `collections-edit.php` / `collections.php` | 合集管理 |
| `pages-edit.php` / `pages.php` | 自定义页面管理 |
| `menus.php` | 导航菜单管理 |
| `widgets.php` | 小工具管理 |
| `categories-edit.php` 中的 extra fields | 自定义字段 |

## 分类管理（categories）

分类用于给游戏分组（动作、益智、策略等），管理页操作：

| 操作 | 对应类方法 |
| --- | --- |
| 列表 | `Category::getList()` |
| 添加 | 构造 `Category` 对象 → `insert()` |
| 编辑 | `Category::getById($id)` → `update()` |
| 删除 | `delete()`（同时清理 `cat_links` 关联） |

分类属性：名称、**SLUG**、描述、**META DESCRIPTION**、优先级（`priority`）、自定义字段。

```php
// 添加分类
$category = new Category();
$category->storeFormValues($_POST);
$category->insert();

// 防重复
if ($category->isCategoryExist($name)) {
    // 提示已存在
}
```

## 合集管理（collections）

合集将游戏打包展示（如「本周精选」），管理页操作：

| 操作 | 对应类方法 |
| --- | --- |
| 列表 | `Collection::getList()` |
| 添加/编辑 | `insert()` / `update()` |
| 删除 | `delete()` |

合集核心是维护 `data` 字段中的游戏 id 列表（JSON 数组），后台通过游戏选择器（`get_recent_games_for_picker` / `search_games_for_picker`）挑选游戏加入合集。

```json
[12, 34, 56, 78]
```

`allow_dedicated_page` 控制该合集是否拥有独立页面。

## 页面管理（pages）

管理自定义静态页面（关于、帮助、联系我们等）：

| 操作 | 对应类方法 |
| --- | --- |
| 列表 | `Page::getList2(...)` |
| 添加/编辑 | `insert()` / `update()` |
| 删除 | `delete()` |

页面属性：标题、**SLUG**、正文（富文本）、`nl2br`（换行转 `<br>`）。

## 菜单管理（menus）

对应 `menus` 表，支持多级菜单（`parent_id`）：

```sql
CREATE TABLE menus (
  id INT(11) UNSIGNED NOT NULL auto_increment,
  label VARCHAR(255) ... NULL,       -- 显示文字
  url VARCHAR(512) ... NULL,         -- 链接地址
  parent_id INT(11) DEFAULT NULL,    -- 父菜单（多级）
  name VARCHAR(255) DEFAULT NULL,    -- 菜单位置名（顶部/页脚等）
  PRIMARY KEY (id)
);
```

管理页支持：增删菜单项、拖拽排序、设置层级（子菜单）、绑定自定义链接或内部页面。

## 小工具管理（widgets）

管理侧边栏等区域的小工具，核心机制见 [Widget 小工具类](/classes/widget)：

- 列出已注册小工具（`widget_exists`）
- 拖拽排序并保存位置（`save_widgets_position` AJAX）
- 配置各小工具参数（`update_widget`）
- 移除小工具（`delete_widget`）

配置保存到 `prefs` 表（`name = 'widgets'`）：

```php
$_wgts = get_pref('widgets');
$_wgts = ($_wgts) ? json_decode($_wgts, true) : [];
$stored_widgets = $_wgts;
```

::: tip 权限提示
小工具相关操作需要页面级权限：`$login_user->hasAccess('layout', 'widgets')`。
:::

## 自定义字段（extra fields）

后台可为游戏/分类/页面/文章定义扩展字段（`extra_fields` 表）：

```php
function get_extra_fields($content_type)   // 获取某类型的字段定义
function get_extra_field_by_key($field_key, $content_type = null)
```

- `allowed_types`：game、category、page、post
- 字段类型：文本、数字、下拉等
- 值保存在对应内容表的 `extra_fields`（JSON）列中，通过 `getExtraField($key)` 读取
