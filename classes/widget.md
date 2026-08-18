# Widget 小工具类

`Widget` 类（`classes/Widget.php`）实现小工具（如侧边栏的「最新游戏」「热门游戏」等模块）的抽象、注册与渲染机制，设计参考了 WordPress 的 Widget API。

## 类概览

```php
class Widget {
    public $name;
    public $id_base;
    public $description = '';

    public function __construct() { }
    public function widget($instance, $args) { }   // 输出小工具内容
    public function form($instance) { }            // 后台表单
    public function update($new_instance, $old_instance) { return $new_instance; }
}

class Widget_Factory {
    public $widgets = array();
    public function register($widget) { }          // 注册
    public function unregister($widget) { }        // 注销
}

// 全局工厂实例
$widget_factory = new Widget_Factory();

function register_widget($widget)  // 注册小工具
function the_widget($widget, $instance, $args)  // 输出小工具
function get_widget($widget, $instance, $args)  // 获取小工具 HTML
function widget_exists($widget)     // 判断是否已注册
```

## 核心概念

### Widget 基类

自定义小工具继承 `Widget`，实现三个生命周期方法：

| 方法 | 作用 |
| --- | --- |
| `widget($instance, $args)` | 在前台输出小工具内容 |
| `form($instance)` | 在后台渲染配置表单 |
| `update($new_instance, $old_instance)` | 保存表单数据（默认直接返回新值） |

```php
class MyWidget extends Widget {
    public function widget($instance, $args) {
        // 输出小工具 HTML
        echo $args['before_widget'];
        echo '<h3>' . $this->name . '</h3>';
        // ... 渲染内容
        echo $args['after_widget'];
    }
}
```

### Widget_Factory 工厂

管理已注册小工具的容器：

```php
$widget_factory->register($widget);
// 接受实例或类名字符串：
// 实例 → 以 spl_object_hash 为键存储
// 类名 → 自动 new $widget()

$widget_factory->unregister($widget);
// 注销对应小工具
```

### 全局函数

```php
function register_widget($widget) {
    global $widget_factory;
    $widget_factory->register($widget);
}

function the_widget($widget, $instance = array(), $args = array()) {
    global $widget_factory;
    if (!isset($widget_factory->widgets[$widget])) {
        return;   // 未注册则跳过
    }
    // 调用该小工具的 widget() 方法输出
}

function get_widget($widget, $instance = array(), $args = array())
// 返回小工具输出的 HTML 字符串

function widget_exists($widget)
// 判断小工具是否已注册
```

## 使用方式

### 1. 定义并注册

```php
// 主题 functions.php 或插件中
class PopularGamesWidget extends Widget {
    public function __construct() {
        $this->name = '热门游戏';
        $this->id_base = 'popular_games';
    }
    public function widget($instance, $args) {
        $games = Game::getList(5, 'views DESC');
        // 输出游戏列表
    }
}
register_widget('PopularGamesWidget');
```

### 2. 在模板中输出

```php
// 侧边栏模板中
the_widget('PopularGamesWidget', ['limit' => 10]);
```

## 后台管理

后台「外观 → 小工具」（`admin/core/widgets.php`）界面：

- 列出所有已注册小工具（`widget_exists` 判断）
- 拖拽配置各小工具的 `instance` 参数
- 配置保存后写入 `prefs` 表（`name = 'widgets'`，JSON 格式）

前台加载时从 `prefs` 读取配置：

```php
$_wgts = get_pref('widgets');       // 读取 JSON
$_wgts = ($_wgts) ? json_decode($_wgts, true) : [];
$stored_widgets = $_wgts;
```

`includes/widgets.php` 负责按配置渲染各小工具。

## 内置小工具示例

| 小工具 | 说明 |
| --- | --- |
| 最新游戏 | 按时间排序展示最新游戏列表 |
| 热门游戏 | 按浏览量（views）排序 |
| 标签云 | 展示标签列表 |
| 社交链接 | 社交平台图标链接 |

具体内置小工具由主题的 `includes/` 或 `includes/widgets.php` 定义。

## 小结

`Widget` 机制把侧边栏等区域的独立功能块抽象为可注册、可配置、可渲染的组件，配合后台配置存储（`prefs` 表）实现前台模块的灵活组合，是主题与插件扩展站点的常用入口。
