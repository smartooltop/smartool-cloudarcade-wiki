# 数据库设计

CloudArcade 使用 MySQL 存储全部数据，建表脚本位于 `db/tables.sql`，共 **27 张表**，字符集统一采用 **UTF-8**（`utf8mb4`）+ `utf8mb4_unicode_ci` 排序规则（**COLLATION**）。安装时由 `install.php` 一次性执行建表。

## 数据表总览

| 分组 | 表名 | 作用 |
| --- | --- | --- |
| 用户 | `users` | 用户账号、资料、等级 |
| 认证 | `sessions` | 登录令牌（记住我） |
| 登录安全 | `loginlogs`、`login_history` | 登录尝试记录与历史 |
| 游戏 | `games` | 游戏主体信息 |
| 分类 | `categories`、`cat_links` | 分类与游戏关联 |
| 标签 | `tags`、`tag_links` | 标签与游戏关联 |
| 合集 | `collections` | 游戏合集 |
| 互动 | `favorites`、`comments`、`scores`、`votelogs` | 收藏/评论/分数/投票 |
| 内容 | `pages`、`posts` | 自定义页面与文章 |
| 菜单 | `menus` | 导航菜单 |
| 趋势 | `trends` | 每日浏览量趋势 |
| 统计 | `statistics`、`stats_ip_address` | 站点统计 |
| 设置 | `settings`、`prefs` | 站点设置与偏好 |
| 多语言 | `translations` | 内容翻译 |
| 扩展 | `extra_fields` | 自定义字段定义 |
| 权限 | `user_permissions` | 用户页面权限 |
| 订阅 | `user_subscriptions` | 会员订阅 |
| 审计 | `action_logs` | 后台操作日志 |

## 核心表详解

### users —— 用户表

```sql
CREATE TABLE users (
  id SMALLINT UNSIGNED NOT NULL auto_increment,
  username VARCHAR(255) ... NOT NULL,
  password VARCHAR(255) ... NOT NULL,   -- password_hash 结果，bcrypt
  role VARCHAR(255) ... NOT NULL,       -- 'admin' / 其他角色
  join_date DATE NULL,
  birth_date DATE NULL,
  gender VARCHAR(255) NULL,
  data VARCHAR(1000) NULL,              -- JSON：likes 等
  email VARCHAR(255) NULL,
  bio VARCHAR(1000) NULL,
  xp VARCHAR(180) NULL DEFAULT '0',     -- 经验值
  avatar VARCHAR(180) NULL DEFAULT '0',
  PRIMARY KEY (id)
);
```

要点：

- `password` 使用 `password_hash($str, PASSWORD_DEFAULT)`（**bcrypt**）存储，验证用 `password_verify`
- `data` 为 **JSON** 文本，存放用户收藏等附加数据
- `xp` 决定用户等级（`rank`），等级映射来自 `includes/rank.json`

### games —— 游戏表

```sql
CREATE TABLE games (
  id SMALLINT UNSIGNED NOT NULL auto_increment,
  createddate DATE NOT NULL,
  title VARCHAR(255) ... NOT NULL,
  description TEXT ... NOT NULL,
  instructions TEXT ... NOT NULL,
  category VARCHAR(255) ... NOT NULL,
  source VARCHAR(255) NOT NULL,        -- 游戏来源（url/upload/json...）
  game_type VARCHAR(225) ... DEFAULT 'html5',
  thumb_1 / thumb_2 / thumb_small VARCHAR(255),  -- 缩略图
  url VARCHAR(500) NOT NULL,           -- 游戏地址
  width / height VARCHAR(50),          -- iframe 尺寸
  tags VARCHAR(255) NOT NULL,
  views INT NOT NULL,                  -- 浏览量
  upvote / downvote INT NOT NULL,      -- 投票
  slug VARCHAR(255) NOT NULL,          -- URL 别名
  data TEXT NULL,
  is_mobile TINYINT(1) DEFAULT '1',
  is_premium TINYINT(1) DEFAULT '0',   -- 会员专属
  published TINYINT(1) DEFAULT '1',    -- 发布状态
  editor_type VARCHAR(100) DEFAULT 'default',
  PRIMARY KEY (id)
);
```

要点：

- 分类与标签字段中冗余存储名称，同时通过 `cat_links`、`tag_links` 关联表维护多对多关系
- 多语言内容存于 `translations` 表（`content_type='game'`）

### 多对多关系

```sql
CREATE TABLE cat_links (
  id SMALLINT UNSIGNED NOT NULL auto_increment,
  gameid SMALLINT UNSIGNED NOT NULL,
  categoryid SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE tag_links (
  game_id SMALLINT(11) UNSIGNED NOT NULL,
  tag_id SMALLINT(11) UNSIGNED NOT NULL,
  PRIMARY KEY (game_id, tag_id)
);
```

- `cat_links`：游戏 ↔ 分类
- `tag_links`：游戏 ↔ 标签（复合主键）

### sessions —— 登录令牌表

```sql
CREATE TABLE sessions (
  token VARCHAR(400) NOT NULL,   -- password_hash 后的令牌
  data TEXT NOT NULL             -- 序列化的登录数据
);
```

用于「记住我」登录：令牌经 `password_hash` 存储，Cookie 中保存原始令牌，查询时无法直接逆推（详见 [认证类](/classes/auth)）。

### user_subscriptions —— 会员订阅

```sql
CREATE TABLE user_subscriptions (
  user_id SMALLINT UNSIGNED NOT NULL,
  subscription_type VARCHAR(50) NOT NULL,
  status ENUM('active','expired','cancelled','pending') NOT NULL,
  start_date / end_date DATETIME NOT NULL,
  ...
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

唯一使用 **FOREIGN KEY**（外键）的表，通过 `ENUM` 状态管理订阅生命周期。

### action_logs —— 操作审计

记录后台管理动作（增删改），包含操作者、动作类型、对象类型与详情，便于追溯：

```sql
CREATE TABLE action_logs (
  user_id SMALLINT UNSIGNED NOT NULL,
  username VARCHAR(255) ... NOT NULL,
  user_role VARCHAR(50) ... NOT NULL,
  action_type VARCHAR(50) NOT NULL,   -- insert/update/delete
  object_type VARCHAR(50) NOT NULL,   -- game/category/user...
  object_id SMALLINT UNSIGNED NULL,
  object_name VARCHAR(255) NULL,
  details TEXT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  ...
);
```

## 设计约定

1. **主键**统一为 `id` 自增（`AUTO_INCREMENT`），少量关联表使用复合主键
2. **时间字段**：日期用 `DATE`，日期时间用 `DATETIME` 或 `TIMESTAMP`
3. **布尔值**使用 `TINYINT(1)`（0/1）
4. **IP 存储**：`votelogs` 用 `VARBINARY(16)`（IPv6 友好），`stats_ip_address` 用 `VARCHAR`
5. **文本字段**：短文本 `VARCHAR`、长文本 `TEXT`
6. 表间关系多为应用层维护（通过查询 `cat_links`/`tag_links`），仅 `user_subscriptions` 使用数据库级外键

## 数据访问方式

核心类（`Game`、`User`、`Category` 等）通过 `init.php` 的 `open_connection()` 获取 **PDO** 连接，统一使用**预处理语句（PREPARED STATEMENT）**与绑定参数执行 SQL，防止 **SQL INJECTION**：

```php
$conn = open_connection();
$sql = 'SELECT * FROM games WHERE slug = :slug LIMIT 1';
$st = $conn->prepare($sql);
$st->bindValue(":slug", $slug, PDO::PARAM_STR);
$st->execute();
$row = $st->fetch();
```

各表对应的数据模型类见 [核心类](/classes/game) 章节。
