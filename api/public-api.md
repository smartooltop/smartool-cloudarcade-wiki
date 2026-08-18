# 前台 API

前台 API 位于 `includes/api.php`，由 `js/api.js` 通过 **AJAX** 调用，处理游戏分数提交、排行榜查询、广告加载、会员访问校验等交互功能。所有请求使用 **POST** 方法，通过 `action` 参数分发。

## 请求方式

```javascript
// js/api.js 中的封装
send(action, val = 0, ref = '', conf = null) {
    let params = 'action=' + action + '&value=' + val + '&ref=' + ref;
    // ... fetch / ajax 请求 includes/api.php
}
```

统一入口：

```php
if (session_status() == PHP_SESSION_NONE) {
    session_start();
}
require('../config.php');
require('../init.php');

if (isset($_POST['action'])) {
    // 按 action 分发
}
```

## 接口清单

| action | 说明 | 需要登录 |
| --- | --- | --- |
| `submit` | 提交游戏分数 | ✅ |
| `get_current_user` | 获取当前用户信息 | ✅ |
| `get_user_score` | 获取当前用户在某游戏的分数 | ✅ |
| `get_score_rank` | 获取用户在某游戏的分数排名 | ✅ |
| `get_scoreboard` | 获取排行榜（支持全部/单游戏 × 日/周/月/全部） | ❌ |
| `load_ad` | 加载广告配置（Ads Manager 插件） | ❌ |
| `ad_clicked` | 广告点击统计 | ❌ |
| `get_ad_config` | 获取广告配置状态 | ❌ |
| `verify_game_access` | 校验会员游戏访问权限 | ❌ |

## 核心接口详解

### submit —— 提交分数

```php
if ($_POST['action'] === 'submit') {
    if ($login_user) {   // 仅登录用户
        $user_id = $login_user->id;
        if (isset($_POST['value']) && isset($_POST['ref'])) {
            $score = $_POST['value'];
            $score = base64_decode($score);   // 先解码
            $score = $score * 1.33;           // 混淆换算
            if (strpos($score, '.')) {
                // 含小数点视为非法，忽略
            } else {
                $game = Game::getBySlug($_POST['ref']);
                if ($game) {
                    $game_id = $game->id;
                    // 查询是否已有记录
                    // 已有 → 分数更高才更新
                    // 没有 → 插入新记录
                    ...
                    $login_user->xp += 10;      // 奖励经验
                    $login_user->update_xp();
                    echo 'ok';
                }
            }
        } else {
            die('x');
        }
    }
}
```

要点：

- **仅登录用户**可提交分数
- 分数经 `base64_decode` 解码并乘以 `1.33` 换算，用于防简单的客户端篡改
- 已有分数时只更新更高分（取最优成绩）
- 提交成功奖励 10 点经验（`xp`）

### get_scoreboard —— 排行榜

通过 `conf`（JSON）参数指定排行类型：

```php
$config = json_decode($_POST['conf'], true);
$type = $config['type'];         // top-all / top / top-day / top-week / top-month ...
$amount = $config['amount'] ?? 10;

// 按类型拼接 SQL（使用预处理语句）
if ($type === 'top-all') {
    $sql = "SELECT * FROM scores ORDER by score DESC LIMIT " . $amount;
} elseif ($type === 'top-all-day') {
    $sql = "SELECT * FROM scores WHERE created_date > DATE_SUB(NOW(), INTERVAL 1 DAY) ORDER by score DESC LIMIT " . $amount;
} elseif ($type === 'top') {
    $sql = "SELECT * FROM scores WHERE game_id = " . $game_id . " ORDER by score DESC LIMIT " . $amount;
}
...
```

支持的类型：

| type | 范围 |
| --- | --- |
| `top-all` / `top-all-day` / `top-all-week` / `top-all-month` | 全站排行榜（全部/日/周/月） |
| `top` / `top-day` / `top-week` / `top-month` | 单游戏排行榜（全部/日/周/月） |

结果会补充 `game_title` 与 `username` 后以 **JSON** 数组返回：

```php
$row = $st->fetchAll(PDO::FETCH_ASSOC);
$list = [];
foreach ($row as $item) {
    $item['game_title'] = Game::getById($item['game_id'])->title;
    $item['username'] = User::getById($item['user_id'])->username;
    array_push($list, $item);
}
echo json_encode($list);
```

### get_score_rank —— 排名

查询该游戏分数最高的前 5000 条，找到当前用户的序号即为排名：

```php
$sql = "SELECT * FROM scores WHERE game_id = :game_id ORDER by score DESC LIMIT 5000";
...
foreach ($row as $item) {
    $i++;
    if ($item['user_id'] == $user_id) {
        echo $i;   // 返回排名（从 1 开始）
        return;
    }
}
echo 0;   // 未上榜
```

### verify_game_access —— 会员游戏校验

判断游戏是否为 **PREMIUM**（会员专属），以及当前用户是否有权访问：

```php
if (isset($_POST['game_slug'])) {
    $path = ABSPATH . 'content/plugins';
    // 检测是否安装了 subscription 插件
    if (file_exists($path . '/subscription-lite') || file_exists($path . '/subscription-pro')) {
        $game = Game::getBySlug(esc_string($_POST['game_slug']));
        if ($game && $game->isPremium()) {
            if (isset($login_user) && $login_user->isSubscriber()) {
                echo 'ok';   // 订阅用户放行
                return;
            } else {
                // 非订阅用户：返回订阅引导模板
                echo file_get_contents($path . '/subscription-pro/template.html');
                return;
            }
        }
    }
    echo 'ok';
}
```

## 广告相关接口

依赖 Ads Manager 插件（`ads-manager` 偏好配置）：

| action | 行为 |
| --- | --- |
| `load_ad` | 按广告位 tag 返回广告配置；支持随机轮播 banner，并累计展示次数（`ads-manager-stats`） |
| `ad_clicked` | 累计广告点击次数 |
| `get_ad_config` | 返回广告状态与 `h5_client_id`（供广告 SDK 使用） |

```php
// load_ad 中记录展示统计
$ad_stats[$picked_banner['name']]['views']++;
update_option('ads-manager-stats', json_encode($ad_stats));
```

## 安全要点

1. **登录校验**：涉及用户数据的接口（分数、用户信息）均要求 `$login_user`
2. **预处理语句**：所有 SQL 使用 **PDO** 绑定参数
3. **输入净化**：`game_slug` 经 `esc_string()` 净化；分数做格式校验
4. **返回简单标记**：多数接口返回 `ok` 或空，失败不输出敏感信息

::: warning
`submit` 的分数混淆（base64 + 乘 1.33）仅防简单篡改，无法完全阻止作弊；生产环境如需严谨排行，建议增加服务端分数验证。
:::
