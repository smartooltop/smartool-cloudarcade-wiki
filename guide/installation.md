# 安装部署

CloudArcade 的安装过程由 `install.php` 驱动，核心流程：填写数据库信息 → 创建 `connect.php` → 导入 `db/tables.sql` 建表 → 写入默认设置 → 清理安装文件。

## 环境要求

| 组件 | 要求 |
| --- | --- |
| PHP | 7.0+，需启用 `pdo_mysql`、`curl`、`gd`（图片处理）、`zip`（更新与备份）扩展 |
| MySQL | 5.7+，需支持 **UTF-8** 与 `utf8mb4` 字符集 |
| Web 服务器 | Apache（推荐，使用 `.htaccess`）或 Nginx（需手动配置重写规则） |
| 目录权限 | `db/`、`content/`、`images/` 等目录需可写 |

## 安装步骤

### 1. 上传源码

将源码上传到服务器根目录或子目录（`SUB_FOLDER` 配置见下文）。

### 2. 访问安装页面

浏览器访问站点根目录，`config.php` 检测到不存在 `connect.php` 时会自动跳转到 `install.php`：

```php
// config.php 中的检测逻辑
if (!file_exists(__DIR__ . "/connect.php")) {
    if (file_exists("install.php")) {
        header('Location: install.php');
    }
    exit('CloudArcade not installed yet.');
}
```

### 3. 填写数据库信息

安装表单提交 `db_name` 等字段后，`install.php` 执行以下操作：

1. 校验数据库连接（使用 **PDO**）
2. 将 `connect-sample.php` 中的占位符替换为实际信息，生成 `connect.php`：

```php
define( "DB_DSN", "mysql:host=db_host;dbname=db_name" );
define( "DB_USERNAME", 'db_user' );
define( "DB_PASSWORD", 'db_password' );
```

3. 执行 `db/tables.sql` 创建全部数据表：

```php
function create_tables($conn) {
    // 读取 SQL 文件
    $query = file_get_contents("db/tables.sql");
    // 使用 exec() 执行多条语句
    $conn->exec($query);
}
```

4. 将 `db/settings.json` 中的默认设置逐条写入 `settings` 表：

```php
function _insert_to_setting($conn, $name, $type, $category, $label, $tooltip, $value) {
    // 先查询是否已存在，不存在才插入
    $sql = "SELECT id FROM settings WHERE name = :name";
    ...
    if (!$row) {
        $sql = "INSERT INTO settings (name, type, category, label, tooltip, value, description) ...";
    }
}
```

5. 补建 `content/plugins` 目录（若缺失）：

```php
if (!file_exists("content/plugins")) {
    mkdir('content/plugins', 0755, true);
}
```

### 4. 完成安装

安装完成后访问站点即可。若 `db/tables.sql` 缺失，安装页会提示从安装包中恢复该文件。

## 子目录部署

站点可部署在域名子目录中（如 `example.com/games/`）。需要在后台设置 `SUB_FOLDER` 为子目录名，`index.php` 解析 URL 时会自动去除前缀：

```php
if (SUB_FOLDER != "") {
    $fname = str_replace("/", "", SUB_FOLDER);
    if (isset($url_params[0]) && $url_params[0] == $fname) {
        array_shift($url_params);
    }
}
```

## Nginx 重写规则

不使用 Apache 时，需要手动配置重写规则以启用 **PRETTY URL**。Nginx 对应配置示例：

```nginx
location / {
    try_files $uri $uri/ /index.php?viewpage=$1&$args;
}
```

## 常见问题

| 问题 | 排查方向 |
| --- | --- |
| 跳转循环到 install.php | 检查 `connect.php` 是否存在且内容正确 |
| 建表失败 | 检查数据库账号是否有 `CREATE` 权限 |
| 中文乱码 | 确认数据库与表使用 `utf8mb4` 字符集、`utf8mb4_unicode_ci` 排序规则 |
| 静态资源 404 | 确认 `.htaccess` 已生效（`AllowOverride All`） |

::: warning
安装完成后建议删除 `install.php`，并妥善保管 `connect.php`（包含数据库凭据，切勿提交到公开仓库）。
:::
