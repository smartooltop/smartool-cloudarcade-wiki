# 安全机制

CloudArcade 在多个层面构建安全防护：数据库访问、用户认证、输入处理、文件上传与后台权限。本文基于源码梳理其安全设计与注意点。

## 1. 数据库安全：预处理语句防注入

所有 SQL 操作统一通过 **PDO** 的**预处理语句（PREPARED STATEMENT）**与绑定参数执行，从根源上防止 **SQL INJECTION**：

```php
$conn = open_connection();
$sql = 'SELECT * FROM games WHERE slug = :slug LIMIT 1';
$st = $conn->prepare($sql);
$st->bindValue(":slug", $slug, PDO::PARAM_STR);
$st->execute();
$row = $st->fetch();
```

- 全程不使用字符串拼接 SQL
- 参数按类型绑定（`PDO::PARAM_INT` / `PDO::PARAM_STR`）
- 连接启用异常模式（`ERRMODE_EXCEPTION`），SQL 错误会抛出异常而非静默失败

## 2. 用户认证与会话

### 密码存储：bcrypt

注册/修改密码时使用 `password_hash` 生成 **bcrypt** 哈希，验证时用 `password_verify`：

```php
// 注册
$login_user->password = password_hash($_POST['new_password'], PASSWORD_DEFAULT);

// 登录校验
if (password_verify($pass, $this->password) || USER_ADMIN) { ... }
```

明文密码不会入库，即使数据库泄露也无法直接逆推。

### 「记住我」令牌

`CA_Auth` 类实现令牌认证：

```php
public static function generate_token($length = 10, $hash = true) {
    $chars = '1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZabcefghijklmnopqrstuvwxyz';
    $str = substr(str_shuffle($chars), 0, $length);
    if ($hash) {
        return password_hash($str, PASSWORD_DEFAULT);
    } else {
        return $str;
    }
}
```

- 随机原始令牌写入 Cookie（`ca_auth`，有效期 3 个月）
- 数据库中只保存令牌的 `password_hash` 哈希
- 即使 `sessions` 表泄露，攻击者也无法还原 Cookie 令牌

### 会话失效

用户被删除或登录态异常时，`sessions.php` 会调用 `CA_Auth::delete()` 清除令牌并 `unset($_SESSION['username'])`：

```php
if ($login_user) {
    ...
} else {
    // 用户已不存在（如被管理员删除），关闭会话
    CA_Auth::delete();
    unset($_SESSION['username']);
}
```

## 3. 输入处理与输出净化

### 输入转义

`commons.php` 提供一套转义函数：

```php
function esc_string($str)      // 转义字符串（HTML 实体）
function esc_int($int)         // 强制转为整数
function esc_url($str)         // 过滤 URL
function esc_slug($str)        // 生成安全 slug
function html_purify($html_content)  // HTML 内容净化（富文本）
```

- 所有来自 `$_GET` / `$_POST` / Cookie 的外部输入，在写入数据库或输出前都应经过转义
- `esc_int` 强制类型转换，杜绝数字注入

### 投票 / 评分校验

`includes/api.php` 提交分数时做了多层校验：

```php
$score = base64_decode($score);   // 先解码
$score = $score * 1.33;           // 混淆换算
if (strpos($score, '.')) {
    // 含小数点视为非法
} else {
    // 仅允许登录用户、仅当分数更高时更新
}
```

## 4. 验证码（CAPTCHA）

`includes/captcha.php` 生成验证码图片，用于登录、注册、评论等表单，防止机器人批量提交。

## 5. 后台权限控制

### 管理员判定

`includes/sessions.php` 根据用户角色定义常量：

```php
if ($login_user->role === 'admin') {
    define('USER_ADMIN', true);
} else {
    define('USER_ADMIN', false);
}
```

### 页面级权限

`User::hasAccess()` 结合 `user_permissions` 表控制用户对特定后台页面/对象的访问：

```php
public function hasAccess($target_page, $target_slug = null) { ... }
public function grantAccess($page, $slug = null) { ... }
public function revokeAccess($page, $slug = null) { ... }
```

- 管理员默认拥有全部权限
- 普通用户可通过 `grantAccess` 被授予特定页面权限

### 后台入口校验

`admin/request.php` 是后台的统一入口，先校验登录与管理员身份，再分发到 `admin/core/*` 页面；未授权访问会被拒绝。

## 6. 文件上传安全

`admin/upload.php` 处理文件上传（图片、主题、插件包），需要注意：

- 上传目录应在 Web 可写但不可执行的位置
- 图片上传应校验 MIME 类型与扩展名白名单
- 主题/插件包（zip）解压前应校验包内文件，防止上传恶意 PHP 文件

::: warning
源码未在 `upload.php` 中强制校验 MIME，生产环境务必在服务器层面（如禁止 `content/` 目录执行 PHP）加固。
:::

## 7. 其他安全相关实现

| 机制 | 位置 | 说明 |
| --- | --- | --- |
| 登录尝试记录 | `loginlogs`、`login_history` 表 | 记录登录 IP 与时间，可做防暴力破解分析 |
| IP 处理 | `getIpAddr()` | 获取客户端 IP，需注意代理头伪造风险 |
| URL 规范化 | index.php | 301 重定向避免重复内容 |
| 插件目录前缀 `_` | `plugin.php` | 目录名以下划线开头视为停用插件 |
| 图片水印/防盗链 | commons.php 等 | 可配置保护图片资源 |

## 8. 安全注意事项（基于源码分析）

1. `config.php` 设置了 `display_errors = 1` 并输出异常详情（`handleException` 直接 `echo($exception)`），生产环境应关闭错误显示，避免泄露路径与 SQL 信息。
2. `connect.php` 包含数据库凭据，切勿提交到公开仓库。
3. 安装完成后删除 `install.php`。
4. 后台路径固定为 `admin`，建议通过服务器配置（Basic Auth / IP 白名单）二次保护。
5. 富文本（`html_purify`）的白名单需定期审查，防止 XSS 变体绕过。

::: tip
本项目未引入第三方安全框架，防护以 PDO 预处理、bcrypt 与转义函数为主。二次开发时应始终遵循「外部输入不可信」原则。
:::
