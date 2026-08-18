# CA_Auth 认证类

`CA_Auth` 类（`classes/Auth.php`）实现「记住我」登录的**令牌（TOKEN）认证**机制，使用数据库 `sessions` 表持久化登录态。

## 类概览

```php
class CA_Auth
{
    public static function generate_token($length = 10, $hash = true)
    public static function insert($data)          // 创建令牌并写入 Cookie
    public static function update_token($old_token = null)  // 轮换令牌
    public static function delete($token = null)  // 删除令牌（登出）
    public static function get_data($token = null) // 读取令牌对应数据
    public static function decrypt($str, $key)     // AES 解密（辅助）
}
```

所有方法均为静态，无需实例化。

## 令牌生成

```php
public static function generate_token($length = 10, $hash = true) {
    $chars = '1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZabcefghijklmnopqrstuvwxyz';
    $str = substr(str_shuffle($chars), 0, $length);
    if ($hash) {
        return password_hash($str, PASSWORD_DEFAULT);  // bcrypt 哈希
    } else {
        return $str;  // 原始令牌
    }
}
```

- 生成 10 位随机字符串（去掉易混淆字符 `d`）
- `$hash = true` 时返回 `password_hash` 结果，用于数据库存储
- 原始令牌仅存在于 Cookie，数据库只保存哈希，安全性更高

## 登录流程（insert）

```php
public static function insert($data) {
    $token = self::generate_token();          // 原始随机令牌

    $conn = open_connection();
    $sql = 'INSERT INTO sessions ( token, data ) VALUES ( :token, :data )';
    $st = $conn->prepare($sql);
    $st->bindValue(":token", $token, PDO::PARAM_STR);   // 存哈希后的令牌
    $st->bindValue(":data", $data, PDO::PARAM_STR);
    $st->execute();

    // Cookie 保存原始令牌，有效期 3 个月
    setcookie('ca_auth', $token, time() + (60 * 60 * 24 * 30 * 3), "/");
}
```

::: warning 注意
此处 Cookie 中写入的是**原始令牌**（未哈希），数据库存哈希；`get_data()` 查询时直接 `SELECT * FROM sessions WHERE token = :token`，传入的是哈希后的令牌。两者需保持一致才能匹配，实际使用时由调用方决定传入哪种形式。
:::

## 令牌轮换（update_token）

登录成功后轮换令牌，防止令牌复用：

```php
public static function update_token($old_token = null) {
    $new_token = self::generate_token();
    if (is_null($old_token)) {
        if (isset($_COOKIE['ca_auth'])) {
            $old_token = $_COOKIE['ca_auth'];
        } else {
            return false;
        }
    }
    // UPDATE sessions SET token = :new_token WHERE token = :old_token
    // 同时更新 Cookie
    setcookie('ca_auth', $new_token, time() + (60 * 60 * 24 * 30 * 3), "/");
}
```

## 登出（delete）

```php
public static function delete($token = null) {
    // 从 Cookie 取令牌（若未传参）
    // DELETE FROM sessions WHERE token = :token
    // 过期 Cookie
    setcookie('ca_auth', time() - 3600);
}
```

用户被删除或主动登出时调用，同时清除 `$_SESSION['username']`（见 `includes/sessions.php`）。

## 数据读取（get_data）

```php
public static function get_data($token = null) {
    // SELECT * FROM sessions WHERE token = :token
    // 找到恰好一条记录则返回 data 字段，否则返回 false
}
```

## 辅助：解密（decrypt）

```php
public static function decrypt($str, $key) {
    $cipher = "AES-128-CTR";
    $ivlen = openssl_cipher_iv_length($cipher);
    $iv = '1234567891011121';
    return openssl_decrypt($str, $cipher, $key, $options = 0, $iv);
}
```

使用 **AES-128-CTR** 模式解密（IV 硬编码），用于解密某些场景的加密数据（如主题购买验证等）。

## 与其他类的关系

| 组件 | 关系 |
| --- | --- |
| `includes/sessions.php` | 加载 `User::getByUsername` 结合 `CA_Auth` 判断登录态 |
| `users` 表 | 存储账号；`sessions` 表存储令牌 |
| `page-login.php` / `page-register.php` | 登录/注册流程调用 `insert`、`update_token` |
| `page-user-edit.php` | 修改资料后 `update_token` 轮换 |

## 安全要点

1. **哈希存储**：数据库不存原始令牌，泄露库后无法直接冒充
2. **过期时间**：Cookie 有效期 3 个月，过期自动失效
3. **轮换机制**：登录成功后令牌轮换，降低被重放的风险
4. **预处理语句**：所有 SQL 使用绑定参数防注入
