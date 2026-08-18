# User 用户类

`User` 类（`classes/User.php`，约 735 行）封装用户账号、资料、等级、权限与会员订阅，对应 `users` 表，并关联 `user_permissions`、`user_subscriptions`、`action_logs` 等表。

## 类概览

```php
class User
{
    // 公共属性
    public $id, $username, $password, $email, $birth_date, $join_date;
    public $gender, $role, $data, $avatar, $bio, $xp, $rank, $level;
    // 私有属性（订阅相关，懒加载）
    private $is_subscriber, $subscription_end_date, $subscription_type;

    public function __construct($data = array())
    public function storeFormValues($params)

    // 静态查询
    public static function getById($id)
    public static function getByUsername($username)
    public static function getByEmail($email)
    public static function getList($amount = 30, $sort = 'desc', $offset = 0)
    public static function getListByRole($role, $sort = 'desc', $amount = null, $offset = 0)
    public static function getTotalUsers()

    // 权限
    public function hasAccess($target_page, $target_slug = null)
    public function grantAccess($page, $slug = null)
    public function revokeAccess($page, $slug = null)
    public function getUserPermissions()

    // 收藏
    public function favoriteGames()
    public function array_id_exist($id)

    // 订阅
    public function isSubscriber()
    public function getSubscriptionDetails()
    public function subscribe($plan_type, $duration = 1, $duration_unit = 'month')
    public function cancelSubscription()
    public function renewSubscription($duration_months = 1)
}
```

## 构造与等级计算

`__construct` 将数据库行映射为属性，并完成两件重要计算：

### 1. data 字段解析

```php
if (isset($data['data'])) $this->data = json_decode($data['data'], true);
if (!$this->data) {
    $this->data = array();
    $this->data['likes'] = [];   // 收藏点赞列表
}
```

`users.data` 为 **JSON** 文本，存放用户附加数据（如点赞的游戏列表）。

### 2. 等级（rank）计算

根据 `includes/rank.json` 中的阈值，由 `xp`（经验值）推导出等级：

```php
if (file_exists(ABSPATH . 'includes/rank.json')) {
    $rank = json_decode(file_get_contents(ABSPATH . 'includes/rank.json'), true);
    $index = 0;
    foreach ($rank as $name => $value) {
        if ($this->xp >= $value) {
            $index++;
            $this->level = $index;
            $this->rank = $name;
        }
    }
}
```

`rank.json` 形如 `{"新手上路": 0, "青铜": 100, "白银": 500, ...}`，`xp` 越高等级越高。

## 登录校验

登录时通过 `password_verify` 验证 bcrypt 密码：

```php
if (password_verify($pass, $this->password) || USER_ADMIN) { ... }
```

- 密码在注册/修改时用 `password_hash(..., PASSWORD_DEFAULT)` 加密
- 管理员（`USER_ADMIN`）登录校验走内部逻辑

## 权限控制

基于 `user_permissions` 表（字段：user_id、page、slug）实现页面级权限：

```php
public function hasAccess($target_page, $target_slug = null)
{
    // 管理员默认拥有全部权限
    if ($this->role === 'admin') return true;
    // 查询 user_permissions 是否授予该页面（可选精确到 slug）
}

public function grantAccess($page, $slug = null)
// INSERT INTO user_permissions ...

public function revokeAccess($page, $slug = null)
// DELETE FROM user_permissions ...

public function getUserPermissions()
// 获取用户全部权限列表
```

典型场景：后台允许普通用户管理特定游戏或页面（如内容编辑角色）。

## 收藏

```php
public function favoriteGames()
// 查询 favorites 表中该用户的游戏列表，返回 Game 对象数组

public function array_id_exist($id)
// 判断某游戏是否已在收藏列表中
```

`favorites` 表通过 `user_id + game_id` 记录收藏关系。

## 会员订阅

订阅数据懒加载（`is_subscriber` 初始为 null，首次调用时才查询）：

```php
public function isSubscriber()
// 查询 user_subscriptions，判断 status='active' 且 end_date > now

public function subscribe($plan_type, $duration = 1, $duration_unit = 'month')
// 创建订阅记录（status='active' 或 'pending'），计算 end_date

public function cancelSubscription()
// 将订阅状态置为 'cancelled'

public function renewSubscription($duration_months = 1)
// 延长 end_date 并恢复 active
```

对应 `user_subscriptions` 表（含 `ENUM` 状态：active / expired / cancelled / pending）。订阅用户可访问 `is_premium` 游戏。

## 使用场景

| 场景 | 调用 |
| --- | --- |
| 登录判定 | `User::getByUsername($username)`（见 sessions.php） |
| 用户资料页 | `User::getByUsername($slug)` + `favoriteGames()` |
| 后台用户管理 | `User::getList()`、`getListByRole('admin')` |
| 会员游戏访问控制 | `isSubscriber()` + `Game::isPremium()` |
| 内容编辑授权 | `grantAccess` / `revokeAccess` / `hasAccess` |
