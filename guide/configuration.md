# 配置说明

CloudArcade 的配置分为两类：**数据库连接配置**（`connect.php`，敏感）与**站点设置**（存储在数据库 `settings` 表，安装时从 `db/settings.json` 导入）。

## 1. 数据库连接（connect.php）

由 `connect-sample.php` 复制生成，定义三个常量：

```php
<?php
define( "DB_DSN", "mysql:host=db_host;dbname=db_name" );
define( "DB_USERNAME", 'db_user' );
define( "DB_PASSWORD", 'db_password' );
?>
```

- **DB_DSN**：PDO 数据源名称，格式为 `mysql:host=主机;dbname=库名`
- **DB_USERNAME / DB_PASSWORD**：数据库账号与密码

`init.php` 中的 `open_connection()` 基于这些常量创建 **PDO** 连接，并启用了异常模式与连接存活检测：

```php
function open_connection(){
    global $conn;
    if(!$conn){
        $conn = new PDO(DB_DSN, DB_USERNAME, DB_PASSWORD);
        $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $conn->setAttribute(PDO::ATTR_TIMEOUT, 5);
    }
    // 连接存活检测，失效则强制重连
    try {
        $conn->query('SELECT 1');
    } catch (PDOException $e) {
        $conn = null;
        $conn = new PDO(DB_DSN, DB_USERNAME, DB_PASSWORD);
        ...
    }
    return $conn;
}
```

## 2. 站点设置（settings 表）

所有站点设置存储在数据库 `settings` 表中，每项包含：

| 字段 | 说明 |
| --- | --- |
| name | 设置名，代码中通过 `SETTINGS['site_title']` 形式访问 |
| type | 类型（text、url、boolean、select 等） |
| category | 分组（general、games、appearance 等） |
| label | 后台表单显示的标签 |
| tooltip | 提示文字 |
| value | 实际值 |

默认值来自 `db/settings.json`，安装时逐条写入。`includes/load-settings.php` 负责读取：

```php
// 读取所有设置并构造成关联数组
// $settings = ... SELECT * FROM settings ...
// 生成 SETTINGS['name'] = ['value' => ..., ...]
```

`site-settings.php` 再基于设置定义常量，供全站使用：

```php
define( "SITE_TITLE", SETTINGS['site_title']['value'] );
define( "SITE_DESCRIPTION", SETTINGS['site_description']['value'] );
define( "THEME_NAME", $options['theme_name'] );
define( "TEMPLATE_PATH", "content/themes/".THEME_NAME );
```

### 常用设置项

| 设置名 | 类别 | 作用 |
| --- | --- | --- |
| site_title | general | 站点标题 |
| site_description | general | 站点描述 |
| meta_description | general | 页面 **META DESCRIPTION** |
| site_logo | general | 站点 Logo |
| theme_name | appearance | 当前启用的主题（对应 `content/themes/` 子目录） |
| custom_slug | games | 是否启用自定义 **SLUG** |
| unicode_slug | games | 是否启用 Unicode slug（中文地址） |
| small_thumb | games | 是否生成小缩略图 |
| import_thumb | games | 导入游戏时是否自动抓取缩略图 |
| language | general | 默认语言代码（如 en） |
| lang_code_in_url | general | URL 中是否携带语言代码（如 `/en/game/...`） |
| trailing_slash | general | URL 末尾是否保留 **TRAILING SLASH** |
| pretty_url | general | 是否启用 **PRETTY URL** |
| sub_folder | general | 子目录部署名（见安装章节） |

## 3. 常量定义汇总

| 常量 | 定义位置 | 说明 |
| --- | --- | --- |
| `ABSPATH` | init.php | 站点根路径 |
| `ADMIN_PATH` | init.php | 后台目录名（admin） |
| `CLASS_PATH` | init.php | 类目录名（classes） |
| `VERSION` | includes/version.php | 系统版本号 2.1.3 |
| `SITE_TITLE` 等 | site-settings.php | 站点设置常量 |
| `THEME_NAME` | site-settings.php | 当前主题名 |
| `TEMPLATE_PATH` | site-settings.php | 主题目录路径 |
| `USER_ADMIN` | includes/sessions.php | 当前用户是否为管理员 |
| `IS_VISITOR_PAGE` | index.php | 是否为前台访问 |

## 4. 修改配置的方式

1. **开发环境**：直接编辑 `db/settings.json`（仅初始值生效）或在数据库中 `UPDATE settings SET value=...`。
2. **生产环境**：推荐通过后台「设置」页面修改，修改后立即生效，无需改代码。

::: warning
`connect.php` 与 `settings` 表中的敏感信息（数据库凭据）应妥善保护；`db/settings.json` 仅为默认值模板，运行时以数据库为准。
:::
