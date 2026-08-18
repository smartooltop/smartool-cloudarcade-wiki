# 用 FrankenPHP 部署 CloudArcade CMS(与 Ghost、GameMonetize 共存)

本指南详述如何复用已部署好 GameMonetize Arcade CMS 的 `ghost-docker` + FrankenPHP 容器,在**同一个容器里再追加一个 CloudArcade CMS 站点**,实现 Ghost、GameMonetize、CloudArcade 三站共存、共用一个 Caddy、共用一个 MySQL,互不干扰。

> 本文路径约定:`ghost-docker/xxx` 指 ghost-docker 项目下的文件;`cloudarcade-cms/xxx` 指 CloudArcade CMS 源码目录下的文件。

## 架构概览

```
浏览器 → FrankenPHP 容器(原 caddy 服务)
          ├─ {DOMAIN}             → reverse_proxy ghost:2368   (Ghost,Node.js)
          ├─ {ARCADE_DOMAIN}      → /app/arcade                 (GameMonetize,PHP 8.5 / mysqli)
          └─ {CLOUDARCADE_DOMAIN} → /app/cloudarcade            (CloudArcade,PHP 8.5 / PDO)  ← 本次新增
                                       ↓
                                    MySQL 容器(db 服务)
                                    ├─ ghost          (Ghost)
                                    ├─ activitypub    (ActivityPub,可选)
                                    ├─ arcade         (GameMonetize)
                                    └─ cloudarcade_db (CloudArcade,本次新增)
```

| 站点 | 容器 | 域名(示例) | 技术栈 | 数据库驱动 | 源码挂载点 |
|---|---|---|---|---|---|
| Ghost | ghost 服务(反代) | `example.com` | Node.js | knex(mysql) | `/var/lib/ghost/content` |
| GameMonetize Arcade CMS | caddy 服务(FrankenPHP) | `games.example.com` | PHP 8.5 | **mysqli** | `/app/arcade` |
| CloudArcade CMS | caddy 服务(FrankenPHP) | `cloudarcade.example.com` | PHP 8.5 | **PDO(pdo_mysql)** | `/app/cloudarcade` |

三个站点共享同一个 `db`(MySQL 8.0.44)容器,各自用独立数据库;GameMonetize 与 CloudArcade 共享同一个 FrankenPHP 容器(Caddy + PHP 8.5),通过不同域名 + 不同 `root` 目录区分。

## 兼容性分析

### PHP 8.5 兼容性

CloudArcade CMS 2.1.3 源码清晰可读(非混淆),明确检查 `PHP 7.0+`,在 FrankenPHP 1.12.7 内置的 PHP 8.5 下兼容性良好:

| 检查项 | 结果 | 说明 |
|---|---|---|
| PHP 版本检查 | ✅ 通过 | 源码检查 `PHP_VERSION >= 7.0`,8.5 满足 |
| 数据库接口 | ✅ PDO | 全程使用 PDO(`pdo_mysql`),不依赖已移除的 `mysql_*` 函数 |
| 密码哈希 | ✅ `password_hash(PASSWORD_DEFAULT)` | PHP 8.5 原生支持 |
| CSRF token | ✅ `bin2hex(random_bytes(32))` | CSPRNG,无兼容问题 |
| 图片处理 | ✅ GD 库 | `imagecreatefromjpeg/png/gif`、`imagewebp`,需 `gd` 扩展 |
| HTTPS 判定 | ✅ Cloudflare 兼容 | `is_https()` 同时检查 `$_SERVER['HTTPS']` 与 `HTTP_X_FORWARDED_PROTO` |
| 取 IP | ✅ Cloudflare 兼容 | `getIpAddr()` 支持 `HTTP_CF_CONNECTING_IP` |
| 会话/多语言 | ✅ 正常 | `locales/` 目录,URL 中带语言代码(`/en/game`) |

### 扩展需求对照

| 扩展 | CloudArcade 是否需要 | FrankenPHP 镜像是否内置 | 处理方式 |
|---|---|---|---|
| `pdo_mysql` | ✅ **必须**(PDO 驱动) | ❌ 默认不含 | Dockerfile 显式安装 |
| `gd` | ✅ 必须(图片缩略图/WebP) | ❌ 默认不含 | Dockerfile 显式安装 |
| `zip` | ✅ 必须(更新/备份) | ❌ 默认不含 | Dockerfile 显式安装 |
| `curl` | ✅ 必须(远程抓取) | ✅ 内置 | 无需处理 |
| `openssl` | ✅ 必须(CSRF/加密) | ✅ 内置 | 无需处理 |
| `mbstring` | ✅ 必须(多字节字符串) | ✅ 内置 | 无需处理 |

### 与 GameMonetize 的关键差异

| 维度 | GameMonetize Arcade CMS | CloudArcade CMS |
|---|---|---|
| 数据库驱动 | `mysqli`(面向对象) | `PDO`(`pdo_mysql`) |
| 配置文件 | `assets/includes/config.php`(`$dbGM[...]` 数组) | `connect.php`(`DB_DSN`/`DB_USERNAME`/`DB_PASSWORD` 常量) |
| 配置生成方式 | 手写或 bind-mount 覆盖 | `install.php` 从 `connect-sample.php` 自动生成 |
| `.htaccess` | ~70 条重写规则 | **仅 1 条**通配重写规则 |
| 源码形态 | 混淆(`eval`/`gzinflate`) | 清晰可读 |
| vendor 依赖 | 已打包(无需 composer) | 已打包 HTMLPurifier、MobileDetect(无需 composer) |
| 连接保活 | 无 | 有(`SELECT 1` 探测,失败重连,PDO `ATTR_TIMEOUT` 5 秒) |

> **核心结论**:CloudArcade 用 PDO,所以**必须装 `pdo_mysql`**;`.htaccess` 极简,Caddyfile 迁移只需 1 条规则;配置走安装向导生成 `connect.php`,**不要**像 GameMonetize 那样 bind-mount 覆盖配置文件。

## 前置条件

1. 已按 GameMonetize 部署文档完成 `ghost-docker` + FrankenPHP 部署,Ghost 与 GameMonetize 站点可正常访问
2. 当前 `ghost-docker/caddy/Dockerfile` 已包含 `pdo_mysql`(GameMonetize 部署时已加,见第一步说明)
3. `ghost-docker` 项目可正常运行(`docker compose ps` 显示 caddy、ghost、db 均为 healthy/running)
4. 已获取 CloudArcade CMS 2.1.3 源码
5. 准备一个**新域名**用于 CloudArcade(如 `cloudarcade.example.com`),与 `DOMAIN`、`ARCADE_DOMAIN` 都不同,DNS 已指向服务器
6. `.env` 中已配置 `DATABASE_ROOT_PASSWORD`、`DATABASE_USER`、`DATABASE_PASSWORD`(CloudArcade 将复用该数据库账号)

---

## 第一步:修改 Dockerfile(确认已装 pdo_mysql)

CloudArcade 使用 PDO 连接 MySQL,**必须依赖 `pdo_mysql` 扩展**;而 FrankenPHP 镜像默认不含 `pdo_mysql`(也不含 `mysqli`、`zip`),必须显式安装。

> **重要**:如果在部署 GameMonetize 时已按最新 Dockerfile 操作,`pdo_mysql` **已经装好了**(当时为 CloudArcade 预留)。本步主要是**确认**,通常无需改动。

查看 `ghost-docker/caddy/Dockerfile`,确认内容如下:

```dockerfile
# FrankenPHP 自带 Caddy,替代原独立的 caddy:2.10.2-alpine 镜像
# 同时提供 PHP 8.5 运行时给 Arcade CMS
FROM dunglas/frankenphp:1.12.7-php8.5-trixie

# 安装 Arcade CMS 需要的额外扩展:
# - gd:图片缩放/压缩/标签卡片生成(tag-image-generator、tag-card-generator、core.php)
# - mysqli:MySQL 数据库连接(GameMonetize Arcade CMS 全程使用 mysqli 面向对象接口)
# - pdo_mysql:MySQL 数据库连接(CloudArcade CMS 使用 PDO 接口)  ← CloudArcade 必需
# - zip:ZipArchive 压缩/解压(备份、更新、CMS 打包)
#   注意:FrankenPHP 镜像默认不含 mysqli、pdo_mysql 和 zip,必须显式安装!
#   镜像已内置:curl、openssl、mbstring、xml、PDO(pdo_sqlite)等
RUN install-php-extensions gd mysqli pdo_mysql zip
```

**为什么 CloudArcade 需要 `pdo_mysql`?**

CloudArcade 的 `init.php` 中 `open_connection()` 用 PDO 建立连接:

```php
// connect.php(install.php 生成)
define( "DB_DSN", "mysql:host=db_host;dbname=db_name" );
define( "DB_USERNAME", 'db_user' );
define( "DB_PASSWORD", 'db_password' );

// init.php 的 open_connection()
$conn = new PDO( DB_DSN, DB_USERNAME, DB_PASSWORD );
$conn->setAttribute( PDO::ATTR_TIMEOUT, 5 );   // 5 秒超时
```

PDO 的 `mysql:` 驱动由 `pdo_mysql` 扩展提供。若未安装,访问站点会直接报 `could not find driver`。

### 验证扩展是否已加载

```bash
# 在 caddy 容器内列出已加载的 PHP 扩展,grep 确认 pdo_mysql
docker compose exec caddy php -m | grep -E "pdo_mysql|gd|zip"
```

预期输出:

```
gd
pdo_mysql
zip
```

> 若上述命令没有输出 `pdo_mysql`,说明镜像未含该扩展,需要重建(见第五步)。改完 Dockerfile 必须重新构建镜像,`docker compose up -d` **不会**自动重新 build。

---

## 第二步:修改 compose.override.yml(加 cloudarcade 挂载)

在已有的 `ghost-docker/compose.override.yml` 基础上**追加** CloudArcade 的域名环境变量与源码挂载。不要改动已有的 GameMonetize 配置。

修改后的完整 `ghost-docker/compose.override.yml`:

```yaml
# Docker Compose 会自动合并 compose.yml(主仓库原始文件)与本文件
# 本文件只放"用户本地的自定义修改",这样 git pull 时主文件 compose.yml 不会冲突
# 如果以后想新增自定义挂载、端口、环境变量,都改本文件而不是 compose.yml

services:
  caddy:
    # 用 FrankenPHP 替代独立 caddy 镜像:自带 Caddy + PHP 8.5
    # 重要:同时提供 build 和 image 时,Docker 会用 build 构建并用 image 名字打 tag
    # 主文件 compose.yml 里的 image 带了 digest(caddy:2.10.2-alpine@sha256:...),
    # Docker 不允许 tag 时带 digest,会报错 "build tag cannot contain a digest"
    # 所以必须在 override 里把 image 覆盖为一个不带 digest 的名字
    image: frankenphp-arcade-caddy:latest
    build:
      context: ./caddy
      dockerfile: Dockerfile
    environment:
      # GameMonetize Arcade CMS 站点域名
      ARCADE_DOMAIN: ${ARCADE_DOMAIN:-}
      # CloudArcade CMS 站点域名(须与 DOMAIN、ARCADE_DOMAIN 都不同)
      # 从 .env 读取,未设置则留空(Caddyfile 中会跳过不存在的站点块)
      CLOUDARCADE_DOMAIN: ${CLOUDARCADE_DOMAIN:-}
    volumes:
      # 重要:FrankenPHP 镜像默认读取 /etc/frankenphp/Caddyfile,而不是 /etc/caddy/Caddyfile
      # 主文件 compose.yml 已经把 ./caddy 挂到 /etc/caddy,这里必须额外挂一份到 /etc/frankenphp
      # 否则 FrankenPHP 会读到镜像内置的默认 Caddyfile(只有 localhost),你的配置完全不生效
      - ./caddy:/etc/frankenphp
      # 额外挂载目录(用户自定义静态文件,可选)
      - /your/static/files:/www
      # GameMonetize Arcade CMS 源码挂载到 /app/arcade
      - ${ARCADE_CMS_LOCATION:-/srv/arcade-cms}:/app/arcade
      # GameMonetize 配置覆盖(host=db,非 localhost)
      - ./arcade-config.php:/app/arcade/assets/includes/config.php
      # ===== CloudArcade CMS(本次新增)=====
      # CloudArcade 源码挂载到 /app/cloudarcade,供 FrankenPHP 执行
      # 注意:此处不要 bind-mount 覆盖 connect.php ——
      #       CloudArcade 的 connect.php 由 install.php 向导自动生成,需要写回源码目录
      - ${CLOUDARCADE_CMS_LOCATION:-/srv/cloudarcade-cms}:/app/cloudarcade

  db:
    # 额外暴露 MySQL 端口到宿主机(便于用 Navicat/MySQL Workbench 等工具连进去查看数据)
    # 127.0.0.1 前缀表示仅本机可访问;如需外网访问则改为 "3306:3306"
    ports:
      - "127.0.0.1:3306:3306"
```

**新增内容说明**:

| 新增项 | 作用 |
|---|---|
| `CLOUDARCADE_DOMAIN` 环境变量 | 传入 Caddyfile,作为 `{$CLOUDARCADE_DOMAIN}` 站点块的域名 |
| `${CLOUDARCADE_CMS_LOCATION}:/app/cloudarcade` 挂载 | CloudArcade 源码挂载点,与 GameMonetize 的 `/app/arcade` 并列,互不干扰 |

> **为什么不覆盖 connect.php?** CloudArcade 的 `install.php` 会根据表单填写的内容,从 `connect-sample.php` 生成 `connect.php` 写回源码根目录。如果像 GameMonetize 那样用只读 bind-mount 覆盖 `connect.php`,安装向导将无法写入,会陷入"未安装"循环。源码目录以可读写方式挂载,`connect.php` 直接落在宿主机源码目录里,持久化且便于备份。

### 验证合并结果(可选)

```bash
cd ghost-docker/
# 输出合并后的完整 YAML,检查 caddy 的 volumes 是否新增了 /app/cloudarcade
docker compose config | grep -A 2 cloudarcade
```

---

## 第三步:创建 cloudarcade.caddyfile

新建 `ghost-docker/caddy/Caddyfile.d/cloudarcade.caddyfile`。主 Caddyfile 末尾已有 `import Caddyfile.d/*.caddyfile`,新建的 `.caddyfile` 文件会被自动加载,无需改主 Caddyfile。

### .htaccess → Caddyfile 迁移

CloudArcade 根目录只有 1 个 `.htaccess`,内容极简:

```apache
Options +FollowSymLinks
RewriteEngine On
RewriteCond %{SCRIPT_FILENAME} !-d
RewriteCond %{SCRIPT_FILENAME} !-f
RewriteRule ^(.*)$ ./index.php?viewpage=$1
ErrorDocument 404 /index.php?viewpage=404
```

对应的 Caddyfile 迁移:

| .htaccess 写法 | Caddyfile 写法 | 说明 |
|---|---|---|
| `RewriteCond %{SCRIPT_FILENAME} !-f` | `not file`(matcher 块内) | 排除真实存在的静态文件(CSS/JS/图片) |
| `RewriteRule ^(.*)$ ./index.php?viewpage=$1` | `path_regexp ^/(.*)$` + `rewrite ...?viewpage={re.名.1}` | 捕获路径(去掉前导斜杠)作为 `viewpage` 参数 |
| `ErrorDocument 404 /index.php?viewpage=404` | `handle_errors { @404 ... }` | 404 转交 CloudArcade 的 404 页面 |

> **关于 `!-d`(排除目录)**:Caddy 的 `php_server` 会自动尝试目录索引(`try_files {path} {path}/index.php`),根路径 `/` 会直接命中 `index.php` 执行,无需额外处理。

### cloudarcade.caddyfile 完整内容

```caddyfile
# ============================================================
# CloudArcade CMS 站点配置(CloudArcade CMS 2.1.3)
# 由主 Caddyfile 通过 import Caddyfile.d/*.caddyfile 加载
# 站点域名通过 .env 的 CLOUDARCADE_DOMAIN 配置(须与 DOMAIN、ARCADE_DOMAIN 都不同)
# 源码挂载在 /app/cloudarcade(由 compose.override.yml 的 CLOUDARCADE_CMS_LOCATION 决定)
# ------------------------------------------------------------
# 所有 rewrite 规则从源码根目录 .htaccess 1:1 迁移而来
# CloudArcade 的 .htaccess 极简,只有 1 条通配重写 + 1 条 404
# ============================================================

{$CLOUDARCADE_DOMAIN} {
	# root * /app/cloudarcade:设置站点根目录
	# "*" 表示匹配所有请求;源码由 compose.override.yml 挂载到容器内 /app/cloudarcade
	root * /app/cloudarcade

	# encode zstd br gzip:对响应启用多种压缩算法
	encode zstd br gzip

	# ============================================================
	# 通配重写(对应 .htaccess 的 RewriteRule ^(.*)$ ./index.php?viewpage=$1)
	#
	# @prettyUrl:命名匹配器块,两条 AND 关系条件:
	#   not file           —— 排除真实存在的静态文件(对应 !-f)
	#   path_regexp ^/(.*)$ —— 捕获路径,去掉前导斜杠(对应 $1)
	# rewrite:把非静态请求改写为 /index.php?viewpage=<捕获的路径>
	#   例:/game/super-mario → /index.php?viewpage=game/super-mario
	#   index.php 再按 / 拆分 viewpage,路由到对应页面模板
	# ============================================================
	@prettyUrl {
		not file
		path_regexp prettyUrl ^/(.*)$
	}
	rewrite @prettyUrl /index.php?viewpage={re.prettyUrl.1}

	# ============================================================
	# 404 处理(对应 ErrorDocument 404 /index.php?viewpage=404)
	# handle_errors 捕获 404,改写为 CloudArcade 内置的 404 页面
	# ============================================================
	handle_errors {
		# @404:表达式匹配器,匹配错误状态码为 404
		@404 expression {http.error.status_code} == 404
		handle @404 {
			# 改写为 404 页面,重新进入 PHP 执行链路
			rewrite * /index.php?viewpage=404
			php_server
		}
	}

	# ============================================================
	# PHP 执行 + 静态文件服务
	# php_server 是 FrankenPHP 提供的复合指令,等价于:
	#   try_files {path} {path}/index.php =404;
	#   php_fastcgi 127.0.0.1:9000 (FrankenPHP 内置,不是独立 php-fpm)
	# 先按静态文件找,找不到就交给 PHP。放最末尾,前面的 rewrite 做完后再由它收口
	# ============================================================
	php_server
}
```

> **顺序原则**:CloudArcade 只有一条通配规则,不存在 GameMonetize 那种"具体规则与通配规则争抢顺序"的问题,配置非常简洁。

---

## 第四步:创建数据库

CloudArcade 需要一个独立数据库(示例库名 `cloudarcade_db`)。

> **仅非首次部署需要手动建库**:如果 `ghost-docker` 是全新部署(MySQL 数据目录 `./data/mysql` 为空),可在 `compose.override.yml` 的 `db.environment` 加 `MYSQL_MULTIPLE_DATABASES: activitypub,arcade,cloudarcade_db`,初始化时自动创建。但绝大多数情况 `ghost-docker` 已运行过(MySQL 已有数据),init 脚本不会再次执行,必须手动建库。

### 创建 cloudarcade_db 数据库

```bash
cd ghost-docker/

# ⚠️ 不能直接写 -p"$DATABASE_ROOT_PASSWORD":
#    1. 宿主机 shell 没加载 .env,$DATABASE_ROOT_PASSWORD 为空 → mysql 提示输入密码
#    2. 容器内的变量名是 MYSQL_ROOT_PASSWORD(compose.yml 把 .env 的 DATABASE_ROOT_PASSWORD 传入)
# 正确做法:用 sh -c '...' 让变量在容器内展开(单引号防止宿主机展开)
# SQL 里有单引号,用 heredoc <<'EOF' 传递,无需转义
# 把下面的 ghost 换成你 .env 中实际的 DATABASE_USER(默认 ghost)
docker compose exec -T db sh -c 'mysql -u root -p"$MYSQL_ROOT_PASSWORD"' <<'EOF'
CREATE DATABASE IF NOT EXISTS cloudarcade_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL ON cloudarcade_db.* TO 'ghost'@'%';
FLUSH PRIVILEGES;
EOF
```

**参数说明**:

- `CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`:使用 utf8mb4 字符集(支持 emoji 等 4 字节字符),`utf8mb4_unicode_ci` 排序规则兼容 MySQL 5.7+/8.0
- `'ghost'@'%'`:`ghost` 是 `DATABASE_USER`(默认值,按你 `.env` 实际值替换);`%` 表示允许从任意主机(容器内)连接

### 验证数据库已创建

```bash
# 列出所有数据库,确认 cloudarcade_db 出现在列表里
docker compose exec db sh -c 'mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "SHOW DATABASES;"' 2>/dev/null
```

预期输出包含:

```
cloudarcade_db
```

### 为什么改了环境变量也不会自动创建库?

MySQL 官方镜像的 init 脚本(`/docker-entrypoint-initdb.d/*.sh`)**只在数据目录为空时执行一次**。已运行过的 `ghost-docker`,`./data/mysql` 已有数据,再次 `docker compose up -d` 时 init 脚本被跳过,`MYSQL_MULTIPLE_DATABASES` 改了也不生效。所以**已运行的环境必须手动建库**(就是上面的命令)。

> 详见 GameMonetize 部署文档的"步骤九",机制完全一致。

---

## 第五步:重建并启动容器

由于改了 `compose.override.yml`(加了新挂载和环境变量),需要重建 caddy 容器。如果第一步确认 `pdo_mysql` 已装、Dockerfile 没改动,**不必重新 build 镜像**,直接重建容器即可。

```bash
cd ghost-docker/

# ① 先干运行预览:确认哪些服务会被重建,不会实际改动任何容器
#    特别注意只有 caddy 被标记为 Recreated,db/ghost 应保持不动
docker compose up -d --dry-run
```

预期输出示例:

```
[+] up 3/3
  ✔ Container ghost-db-1     Healthy     0.7s   ← db 不动
  ✔ Container ghost-ghost-1  Healthy     0.5s   ← ghost 不动
  ✔ Container ghost-caddy-1  Recreated   0.2s   ← caddy 配置变了会重建(加了新挂载)
```

预览没问题后,正式启动:

```bash
# ② 实际重建并启动(-d 后台运行)
#    由于只改了 compose.override.yml(未改 Dockerfile),不需要 --build
docker compose up -d
```

### 如果第一步发现 pdo_mysql 没装(改了 Dockerfile)

```bash
# 必须重新 build 镜像,up -d 不会自动 rebuild
docker compose build caddy --no-cache

# 用新镜像重建容器
docker compose up -d

# 验证扩展
docker compose exec caddy php -m | grep -E "pdo_mysql|gd|zip"
```

### 校验 Caddyfile 语法(可选)

```bash
# ⚠️ FrankenPHP 镜像里没有 caddy 命令,二进制叫 frankenphp
#    配置路径是 /etc/frankenphp/Caddyfile(不是 /etc/caddy/)
docker compose exec caddy frankenphp validate --config /etc/frankenphp/Caddyfile
```

预期输出:`valid configuration` 之类,无报错。

### 确认 cloudarcade 站点已被加载

```bash
# 看 caddy 启动日志,确认加载了 CLOUDARCADE_DOMAIN 站点
docker compose logs --tail 30 caddy | grep -i cloudarcade
```

如果 `CLOUDARCADE_DOMAIN` 已在 `.env` 配置,日志里应能看到该域名被启用自动证书管理;若留空则该站点块被跳过(正常)。

---

## 第六步:运行安装向导

CloudArcade 的 `install.php` 会自动检测:若根目录不存在 `connect.php`,会跳转到安装向导。

### 6.1 先配置 .env

编辑 `ghost-docker/.env`,在末尾追加 CloudArcade 相关变量:

```bash
# ============================================================
# CloudArcade CMS(CloudArcade CMS 2.1.3)
# 由 FrankenPHP(与 GameMonetize 共用同一容器)提供 PHP 运行时
# ============================================================

# CloudArcade 站点域名(须与 DOMAIN、ARCADE_DOMAIN 都不同)
CLOUDARCADE_DOMAIN=cloudarcade.example.com

# CloudArcade 源码位置(相对 ghost-docker 根目录,或绝对路径)
# 把 CloudArcade 源码目录内容放在此路径
CLOUDARCADE_CMS_LOCATION=./cloudarcade-cms
```

改完 `.env` 需要让容器重新读取(因为 `CLOUDARCADE_DOMAIN` 是通过 environment 传入 caddy 容器):

```bash
docker compose up -d
```

### 6.2 放置源码

把 CloudArcade CMS 2.1.3 源码目录内容复制到 `ghost-docker/cloudarcade-cms/`:

```bash
# 在 ghost-docker 项目根目录下执行
mkdir -p cloudarcade-cms
cp -r /path/to/cloudarcade-source/* cloudarcade-cms/
```

放置后目录结构示例:

```
ghost-docker/cloudarcade-cms/
├── index.php              # 前台入口
├── admin.php              # 后台入口
├── install.php            # 安装向导
├── config.php             # 引导配置(检测 connect.php 是否存在)
├── init.php               # 初始化 + open_connection()
├── connect-sample.php     ← install.php 据此生成 connect.php
├── .htaccess              # 唯一的重写规则
├── classes/               # 核心类库
├── includes/              # 公共函数
├── admin/                 # 后台
├── content/
│   ├── themes/            # 主题
│   └── plugins/           # 插件
├── db/
│   ├── tables.sql         # 建表脚本(27 张表)
│   └── settings.json      # 默认站点设置
├── images/                # 站点默认图片
├── vendor/                # 已打包 HTMLPurifier、MobileDetect,无需 composer install
└── locales/               # 多语言包
```

> `vendor/` 已随源码打包,**不需要**执行 `composer install`。

### 6.3 运行安装向导

浏览器访问安装脚本:

```
https://cloudarcade.example.com/install.php
```

> 如果直接访问根目录 `https://cloudarcade.example.com/`,`config.php` 检测到不存在 `connect.php` 时会自动跳转到 `install.php`。

按向导表单填写数据库信息:

| 表单字段 | 填写值 | 说明 |
|---|---|---|
| **Database Host** | `db` | MySQL 容器服务名(Docker 内部网络);不要填 `localhost`(会走 socket) |
| **Database Name** | `cloudarcade_db` | 第四步创建的库名 |
| **Database User** | `ghost` | 与 `.env` 的 `DATABASE_USER` 一致(默认 ghost,按实际填) |
| **Database Password** | `Str0ngP@ssw0rd!2026` | 与 `.env` 的 `DATABASE_PASSWORD` 一致(填你的实际密码) |

向导执行流程:

1. 用 PDO 校验数据库连接(`mysql:host=db;dbname=cloudarcade_db`)
2. 从 `connect-sample.php` 生成 `connect.php`,写入源码根目录(内容见下)
3. 执行 `db/tables.sql` 创建 27 张表
4. 把 `db/settings.json` 的默认设置逐条写入 `settings` 表
5. 补建 `content/plugins` 目录(若缺失)
6. 填写管理员账号,完成安装

生成的 `connect.php` 内容示例:

```php
define( "DB_DSN", "mysql:host=db;dbname=cloudarcade_db" );
define( "DB_USERNAME", 'ghost' );
define( "DB_PASSWORD", 'Str0ngP@ssw0rd!2026' );
```

> **PDO DSN 格式说明**:PDO 的 mysql 驱动用 `host=主机名;port=端口;dbname=库名` 语法,**不是** `host:port`。默认端口 3306 可省略 `port`;若需显式指定,写 `mysql:host=db;port=3306;dbname=cloudarcade_db`。

### 6.4 安装后清理(可选)

安装完成后建议删除 `install.php` 防止被再次访问:

```bash
rm ghost-docker/cloudarcade-cms/install.php
```

> `connect.php` 含数据库凭据,**不要提交到公开仓库**。建议在 `ghost-docker/.gitignore` 追加:

```gitignore
# CloudArcade 源码目录与敏感配置(不进 git)
cloudarcade-cms/
```

---

## 第七步:文件与目录权限

### 需要写入的目录

CloudArcade 运行时由 `www-data`(UID 33)写入以下目录:

| 目录 | 用途 |
|---|---|
| 源码根目录 | 安装向导生成 `connect.php`(已在前一步完成,但运行时若开启静态生成也需写入) |
| `content/` | 主题、插件上传与启用 |
| `content/themes/` | 主题文件 |
| `content/plugins/` | 插件文件 |
| `images/` | 站点图片、用户上传 |
| `db/` | 缓存/设置文件 |

### 修复权限

通过 bind mount 挂载源码时,宿主机文件的 UID(如 1001)原样传到容器,而 PHP 以 `www-data`(33)运行,需要 chown:

```bash
cd ghost-docker/

# ① 安装向导需要在根目录生成 connect.php(若尚未完成安装,先改根目录属主)
#    只改目录本身(不递归),让能新建 connect.php
docker compose exec caddy chown www-data:www-data /app/cloudarcade

# ② 需要递归写入的目录(主题/插件/上传图片/数据库缓存)
docker compose exec caddy chown -R www-data:www-data \
  /app/cloudarcade/content \
  /app/cloudarcade/images \
  /app/cloudarcade/db
```

### 验证权限

```bash
# 查看属主,确认 content/images/db 变成了 www-data
docker compose exec caddy ls -la /app/cloudarcade/ | grep -E "content|images|db"
# 预期:drwxr-xr-x ... www-data www-data ... content/
```

```bash
# 看 www-data 的 UID/GID
docker compose exec caddy id www-data
# 预期:uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

> ⚠️ **重新部署后需重新执行**:如果以后从宿主机重新拷贝/更新源码,属主又会变回宿主机 UID,需要重新执行上面的 chown 命令。建议把它加到部署脚本里。

### `www-data` 是什么

`www-data` 是 Debian/Ubuntu 系 Linux 的默认 Web 服务器用户。FrankenPHP 镜像基于 Debian trixie,PHP worker 进程以 `www-data`(UID 33)身份运行(不是 root):

```
容器内进程:
  root (PID 1) ── Caddy 主进程(监听 80/443,负责 TLS、路由)
       │
       └── www-data (UID 33) ── PHP worker(实际执行 CloudArcade 的 PHP 代码)
```

> FrankenPHP 是**按需启动** PHP worker 的,空闲时没有 PHP 进程。`ps aux | grep php` 在没有请求时看不到进程是正常的,不代表 PHP 没在工作。

---

## 验证部署

### 1. 访问前台首页

```
https://cloudarcade.example.com/
```

预期:CloudArcade 默认主题首页正常加载,游戏列表、分类导航、静态资源(CSS/JS/图片)均 200。

### 2. 访问后台

```
https://cloudarcade.example.com/admin.php
```

预期:跳转到后台登录页,用安装时填写的管理员账号登录成功。

### 3. 测试漂亮 URL(PRETTY URL)

访问一个游戏详情页(示例):

```
https://cloudarcade.example.com/game/some-game-slug
```

预期:正常显示游戏详情(说明 `.htaccess → Caddyfile` 的通配重写生效,`viewpage` 参数被正确解析)。

### 4. 测试 404 页面

访问一个不存在的路径:

```
https://cloudarcade.example.com/this-page-does-not-exist
```

预期:显示 CloudArcade 内置的 404 页面(说明 `handle_errors` + `viewpage=404` 生效)。

### 5. 验证数据库连接

```bash
# 查看 CloudArcade 的 27 张表是否都已创建
docker compose exec db sh -c 'mysql -u root -p"$MYSQL_ROOT_PASSWORD" cloudarcade_db -e "SHOW TABLES;"' 2>/dev/null | head -20
```

预期:列出 `settings`、`games`、`categories`、`users` 等表。

### 6. 验证 PDO 驱动

```bash
# 从容器内用 PHP 测试 PDO 连接(把密码换成实际值)
docker compose exec caddy php -r '
$pdo = new PDO("mysql:host=db;dbname=cloudarcade_db", "ghost", "Str0ngP@ssw0rd!2026");
echo "PDO connect OK, server version: " . $pdo->getAttribute(PDO::ATTR_SERVER_VERSION) . "\n";
'
```

预期输出:

```
PDO connect OK, server version: 8.0.44
```

若报 `could not find driver`,说明 `pdo_mysql` 未装(见第一步)。

---

## 常见问题

### Q1:访问站点报 `could not find driver` / `Class "PDO" not found`

**原因**:FrankenPHP 镜像默认**不含 `pdo_mysql`**(也不含 `mysqli`、`zip`)。CloudArcade 用 PDO 连接数据库,必须显式安装 `pdo_mysql`。

**修复方法**:在 `ghost-docker/caddy/Dockerfile` 确认包含 `pdo_mysql`,然后重建镜像:

```dockerfile
FROM dunglas/frankenphp:1.12.7-php8.5-trixie
RUN install-php-extensions gd mysqli pdo_mysql zip
```

```bash
docker compose build caddy --no-cache
docker compose up -d

# 验证扩展已加载
docker compose exec caddy php -m | grep pdo_mysql
```

### Q2:安装向导循环跳转 install.php / 提示未安装

**原因**:`connect.php` 没有生成,或生成了但 `www-data` 没有读权限。`config.php` 检测到 `connect.php` 不存在就跳转 `install.php`。

**排查**:

```bash
# 1. 确认 connect.php 是否生成在源码根目录
docker compose exec caddy ls -la /app/cloudarcade/connect.php

# 2. 确认 www-data 能读
docker compose exec caddy sudo -u www-data cat /app/cloudarcade/connect.php
```

**修复**:

- 若 `connect.php` 不存在:检查根目录是否可写(见第七步权限),重新运行安装向导
- 若存在但读不了:`docker compose exec caddy chown www-data:www-data /app/cloudarcade/connect.php`
- 若你**误把** `connect.php` 用只读 bind-mount 覆盖了:删掉 `compose.override.yml` 里对 `connect.php` 的挂载行,CloudArcade 的配置由安装向导生成,**不要**覆盖

### Q3:首页正常,但子页面(如 /game/xxx)404

**原因**:`cloudarcade.caddyfile` 的通配重写没生效。最常见的是**改了 `Caddyfile.d/` 里的文件后没重启 caddy**。

**修复**:

```bash
# Caddy 不会自动监控 import 导入的子配置文件变化,改完必须重启
docker compose restart caddy

# 确认站点块已加载
docker compose logs --tail 20 caddy | grep -i cloudarcade
```

### Q4:所有网站都访问不了(连 Ghost、GameMonetize 也打不开)

**最高频问题**。原因是 **FrankenPHP 镜像默认读取的 Caddyfile 路径与原 caddy 镜像不同**:

| 镜像 | 默认读取路径 |
|---|---|
| `caddy:2.10.2-alpine`(ghost-docker 原配) | `/etc/caddy/Caddyfile` |
| `dunglas/frankenphp`(本方案) | `/etc/frankenphp/Caddyfile` |

`compose.yml` 把 `./caddy` 挂到 `/etc/caddy`,FrankenPHP 不读这里,而读镜像内置的默认 Caddyfile(只配 localhost),导致所有自定义配置失效。

**诊断**:看 caddy 日志,若出现以下行就是这个问题:

```
"msg":"using config from file","file":"/etc/frankenphp/Caddyfile"   ← 用了镜像内置的
"msg":"No files matching import glob pattern","pattern":"Caddyfile.d/*.caddyfile"
```

**修复**:在 `compose.override.yml` 的 caddy volumes 里确保有这一行(把 `./caddy` 额外挂到 `/etc/frankenphp`):

```yaml
services:
  caddy:
    volumes:
      - ./caddy:/etc/frankenphp   # 关键修复
```

主文件的 `./caddy:/etc/caddy` 保留不动,同一目录同时挂到两个容器路径,内容一致。

### Q5:FrankenPHP 镜像里执行 `caddy validate` 报 command not found

**原因**:FrankenPHP 镜像里**没有 `caddy` 命令**,二进制叫 `frankenphp`。

**修复**:所有需要 `caddy xxx` 的命令都改成 `frankenphp xxx`:

```bash
# 校验配置(注意路径是 /etc/frankenphp/)
docker compose exec caddy frankenphp validate --config /etc/frankenphp/Caddyfile

# 适配(把 Caddyfile 转成 JSON 看实际生效配置)
docker compose exec caddy frankenphp adapt --config /etc/frankenphp/Caddyfile
```

### Q6:CLOUDARCADE_DOMAIN 走 Cloudflare Proxy(橙色云朵)时证书申请失败

**症状**:caddy 日志反复报 `challenge failed` / `authorization failed`:

```
"msg":"challenge failed","identifier":"cloudarcade.example.com",
"challenge_type":"http-01",
"problem":{"detail":"...: 403"}
```

**原因**:Let's Encrypt 从外部访问域名时,DNS 解析到的是 Cloudflare 的 IP(不是服务器真实 IP),Cloudflare 返回 403,挑战失败。

**三种解决方案**:

| 方案 | 操作 | 适用场景 |
|---|---|---|
| **A. DNS Only(推荐,最快)** | Cloudflare 面板把该域名改成**灰色云朵**,解析直连服务器,Caddy 自己申请 LE 证书 | 不需要 Cloudflare 缓存/WAF |
| **B. 走 Cloudflare Proxy** | 保持**橙色云朵**,`cloudarcade.caddyfile` 把 `{$CLOUDARCADE_DOMAIN}` 改成 `http://{$CLOUDARCADE_DOMAIN}`,Caddy 不再申请证书,由 Cloudflare 负责 HTTPS。Cloudflare SSL/TLS 模式设为 **Full**(不是 strict) | 需要 Cloudflare 保护 |
| **C. DNS-01** | 安装 `caddy-dns/cloudflare` 插件 + API Token,通过 TXT 记录完成挑战 | 最复杂,同时要 Proxy + 非 CF 证书 |

```bash
# 判断当前是否走 Cloudflare Proxy
dig +short cloudarcade.example.com
# 输出 104.x / 172.66.x → Cloudflare Proxy(橙色云朵)
# 输出服务器真实公网 IP  → DNS Only(灰色云朵)
```

### Q7:bind mount 导致 UID 不一致,上传图片/保存设置失败

**原因**:源码用宿主机普通用户(UID 1001)上传,bind mount 后容器里属主是 `1001`,而 PHP 以 `www-data`(33)运行,只有读权限。

**症状**:后台保存设置报错、上传图片失败、`content/` 目录写不进去。

**修复**:见 [第七步](#第七步-文件与目录权限),chown 给 `www-data`:

```bash
docker compose exec caddy chown -R www-data:www-data \
  /app/cloudarcade/content \
  /app/cloudarcade/images \
  /app/cloudarcade/db
```

### Q8:容器内执行 MySQL 命令提示输入密码 / 报 Access denied

**原因**:宿主机 shell 没加载 `.env`,`$DATABASE_ROOT_PASSWORD` 为空;且容器内变量名是 `MYSQL_ROOT_PASSWORD`。

**修复**:用 `sh -c '...'` 让变量在容器内展开(单引号防止宿主机展开):

```bash
# ✅ 正确:变量在容器内展开
docker compose exec db sh -c 'mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "SHOW DATABASES;"' 2>/dev/null

# ❌ 错误:宿主机展开变量(为空),mysql 提示输入密码
docker compose exec db mysql -u root -p"$DATABASE_ROOT_PASSWORD" -e "SHOW DATABASES;"
```

### Q9:docker image prune 不支持 --dry-run

`docker image prune` 没有 `--dry-run`(那是 `docker compose` 的功能)。要预览哪些镜像会被删,用脚本手动判断:

```bash
# 列出所有未被容器使用的镜像(会被 prune -a 删除的)
docker images --format '{{.ID}} {{.Repository}}:{{.Tag}} {{.Size}}' | while read id rest; do
  if [ -z "$(docker ps -aq --filter ancestor="$id")" ]; then
    echo "将被删除: $rest"
  fi
done
```

### Q10:首页空白 / viewpage 参数为空时路由异常

**原因**:根路径 `/` 会被通配规则匹配(`path_regexp ^/(.*)$` 捕获为空),改写为 `/index.php?viewpage=`(空值)。若 `index.php` 对空 `viewpage` 处理不当可能异常。

**排查**:正常情况下 `php_server` 会先尝试目录索引,`/` 直接命中 `index.php` 执行(空 `viewpage` 默认显示首页)。若首页空白:

```bash
# 1. 确认 connect.php 存在且可读(见 Q2)
docker compose exec caddy ls -la /app/cloudarcade/connect.php

# 2. 看 PHP 错误日志
docker compose logs caddy --tail 100 | grep -i -E "php|error|fatal"

# 3. 临时开启错误显示调试
#    在 cloudarcade-cms/init.php 顶部加 ini_set('display_errors', 1); error_reporting(E_ALL);
```

### Q11:导入 SQL / 安装时报 `Unknown collation: 'utf8mb4_uca1400_ai_ci'`

**原因**:`utf8mb4_uca1400_ai_ci` 是 MySQL 8.0.31+ 引入的 collation,但 ghost-docker 用的 `mysql:8.0.44` 官方镜像可能默认不带(主要在 8.4/9.0 才作为默认项)。

**修复**:建库时显式指定兼容的排序规则(第四步已用 `utf8mb4_unicode_ci`):

```sql
-- 若已建库,修改默认排序规则
ALTER DATABASE cloudarcade_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

若导入的 SQL 文件含该 collation,用 `sed` 替换:

```bash
sed -i 's/utf8mb4_uca1400_ai_ci/utf8mb4_unicode_ci/g' your_dump.sql
```

### Q12:CloudArcade 与 GameMonetize 共存会冲突吗?

**不会**。两者完全隔离:

| 隔离维度 | GameMonetize | CloudArcade |
|---|---|---|
| 域名 | `ARCADE_DOMAIN` | `CLOUDARCADE_DOMAIN` |
| 源码挂载点 | `/app/arcade` | `/app/cloudarcade` |
| 数据库 | `arcade` | `cloudarcade_db` |
| 数据库驱动 | mysqli | PDO |
| 配置文件 | `arcade-config.php`(bind-mount 覆盖) | `connect.php`(安装向导生成) |

它们只是**共享同一个 FrankenPHP 容器**(Caddy + PHP 8.5)和同一个 MySQL 容器,Caddy 按域名分发到不同 `root` 目录,互不影响。

### Q13:如何只启用部分站点(暂时关停 CloudArcade)

把 `.env` 中的 `CLOUDARCADE_DOMAIN` 留空,`cloudarcade.caddyfile` 中的 `{$CLOUDARCADE_DOMAIN}` 站点块会因域名为空而被 Caddy 跳过。重启 caddy 容器即可:

```bash
docker compose restart caddy
```

### Q14:如何查看 PHP 错误日志

```bash
# 从 caddy 日志过滤 PHP 相关
docker compose logs caddy --tail 200 | grep -i -E "php|fatal|warning|error"

# 进入容器查看 PHP 日志文件(若有)
docker compose exec caddy sh -c 'cat /var/log/php*.log 2>/dev/null || echo "no php log file"'
```

> CloudArcade 源码默认会显示错误。若需临时关闭错误显示(生产环境),在 `init.php` 顶部加 `error_reporting(0); ini_set('display_errors', 0);`。

### Q15:连接保活机制导致日志频繁出现 query 记录

**原因**:CloudArcade 的 `init.php` 的 `open_connection()` 有连接保活机制,会定期执行 `SELECT 1` 探测连接,失败则重连。PDO `ATTR_TIMEOUT` 设为 5 秒。

**影响**:正常行为,不影响功能。若日志噪音过大,可在 `connect.php` 生成后手动调整超时参数,或忽略这类 `SELECT 1` 日志。

---

## 关联阅读

- CloudArcade 安装流程:见 [安装部署](/guide/installation)
- 目录结构:见 [目录结构](/guide/directory-structure)
- 请求生命周期:见 [请求生命周期](/architecture/request-lifecycle)
- 数据库表结构:见 [数据库结构](/architecture/database)
- GameMonetize 部署文档(FrankenPHP 共存机制基础):见 GameMonetize Wiki 的 `devops/deploy-frankenphp.md`
