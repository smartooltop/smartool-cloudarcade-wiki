# 子路径部署（/arcade/ 前缀）

将 CloudArcade CMS 部署在主域名的子路径下（如 `https://smartool.top/arcade/`），与主站点（如 Ghost 博客）共享同一个域名，通过 URL 前缀区分站点。

> 本文以 **`https://smartool.top/arcade/`** 为示例路径。若你的子路径不同（如 `/games/`），把文中的 `arcade` 全局替换即可。

## 适用场景

- **单域名多站点**：主域名 `smartool.top` 跑 Ghost 博客，子路径 `/arcade/` 跑 CloudArcade
- **SEO 聚权**：所有内容集中在一个根域名下，避免子域名分散权重
- **共享 HTTPS 证书**：无需为每个子站点单独申请证书
- **简化 DNS**：无需配置额外的 A/CNAME 记录

## 核心概念

### DOMAIN 常量

CloudArcade 在 `includes/load-settings.php` 中定义 `DOMAIN` 常量：

```php
// includes/load-settings.php:84
define( "DOMAIN", URL_PROTOCOL . $www . $_SERVER['SERVER_NAME'] . get_domain_port() . '/' . SUB_FOLDER );
```

`DOMAIN` 由 5 部分拼接而成：

| 部分 | 含义 | 示例值 |
|---|---|---|
| `URL_PROTOCOL` | 协议（http/https） | `https://` |
| `$www` | 可选 www 前缀 | `''` |
| `$_SERVER['SERVER_NAME']` | 主机名 | `smartool.top` |
| `get_domain_port()` | 端口（仅 8080 时返回） | `''` |
| `SUB_FOLDER` | **子路径目录名** | `arcade/` |

### SUB_FOLDER 常量

子路径开关，定义在 `includes/sub-folder.php`：

```php
// includes/sub-folder.php
// 根域名部署（默认）
define( "SUB_FOLDER", "");

// 子路径部署（在 /arcade/ 下）
define( "SUB_FOLDER", "arcade/");
```

> ⚠️ **必须以 `/` 结尾**，否则拼接出的 URL 会缺少分隔符。

### DOMAIN 在不同部署模式下的取值

| 部署模式 | `SUB_FOLDER` | `DOMAIN` 最终值 |
|---|---|---|
| 根域名 | `""` | `https://smartool.top/` |
| 子路径 | `"arcade/"` | `https://smartool.top/arcade/` |

## 子路径部署的两大难题

### 难题 1：前端 JS 硬编码绝对路径

**问题**：CloudArcade 源码中，前端 JS 文件里写死了一批绝对路径：

```javascript
// js/stats.js（修复前）
xhr.open('POST', '/includes/statistics.php', true);

// js/api.js（修复前）
xhr.open('POST', '/includes/api.php', true);

// content/themes/default/js/script.js（修复前）
url: '/includes/vote.php'
```

子路径部署时，浏览器请求 `/includes/statistics.php` 会丢失 `/arcade/` 前缀，请求落到根域名（如 Ghost 反代）上，Ghost 不接受 POST 到陌生路径，返回 **405 Method Not Allowed**。

**修复**：注入全局变量 `window.CLOUDARCADE_BASE`，JS 中所有硬编码路径改为动态拼接。

### 难题 2：PHP 中 REQUEST_URI 与 DOMAIN 拼接的双重前缀

**问题**：PHP 处理 trailing slash（尾斜杠）重定向时，把 `DOMAIN` 与 `$_SERVER['REQUEST_URI']` 直接拼接：

```php
// 修复前（index.php）
$cur_url = $_SERVER['REQUEST_URI'];  // "/arcade/login/"
header('Location: '.substr(DOMAIN, 0, -1).substr($cur_url, 0, -1), true, 301);
// 拼接结果 = "https://smartool.top/arcade" + "/arcade/login"
//          = "https://smartool.top/arcade/arcade/login"  ← 双重前缀！
```

访问 `https://smartool.top/arcade/login/`（带尾斜杠）会被重定向到 `https://smartool.top/arcade/arcade/login`（双重前缀），返回 404。

**修复**：拼接前先剥离 `SUB_FOLDER` 前缀。

## 完整修复方案

### 第 1 步：配置 SUB_FOLDER

编辑源码根目录的 `includes/sub-folder.php`：

```php
<?php
define( "SUB_FOLDER", "arcade/");
```

### 第 2 步：在所有页面 Header 注入 CLOUDARCADE_BASE

CloudArcade 前端 JS 需要一个全局变量来获取应用基础路径。在以下 7 个 Header 文件的 `<head>` 中注入：

| 文件 | 用途 |
|---|---|
| `content/themes/default/includes/header.php` | 默认主题 |
| `content/themes/dark-grid/includes/header.php` | Dark-Grid 主题 |
| `includes/page-login.php` | 登录页 |
| `includes/page-register.php` | 注册页 |
| `includes/page-full.php` | 游戏全屏页 |
| `includes/page-splash.php` | 游戏启动页 |
| `admin/dashboard.php` | 后台管理 |

注入代码（放在 `<head>` 内的 PHP 块）：

```php
<?php
    $cloudarcade_base = rtrim( DOMAIN, '/') . '/';
?>
<script>window.CLOUDARCADE_BASE = "<?php echo $cloudarcade_base ?>";</script>
```

后台 `admin/dashboard.php` 略有不同（需注入两个变量）：

```php
<?php
    $_admin_base = rtrim(DOMAIN, '/') . '/admin/';
?>
<script>window.CLOUDARCADE_BASE = "<?php echo rtrim(DOMAIN, '/') . '/' ?>";</script>
```

### 第 3 步：修改 JS 中所有硬编码绝对路径

把所有 `/includes/xxx.php`、`/admin/xxx.php`、`/admin/style/xxx.css` 改为 `(window.CLOUDARCADE_BASE || '/') + 'includes/xxx.php'` 形式。

**完整修改清单（共 19 处）**：

| 文件 | 路径 | 处数 |
|---|---|---|
| `js/api.js` | `/includes/api.php` | 2 处 |
| `js/api.js` | `/admin/style/api.css` | 1 处 |
| `js/stats.js` | `/includes/statistics.php` | 1 处 |
| `js/comment-system.js` | `/includes/comment.php` | 3 处 |
| `js/script.js` | `/admin/includes/ajax-actions.php` | 1 处 |
| `content/themes/default/js/script.js` | `/includes/fetch.php`、`/includes/api.php`、`/includes/vote.php`（×3）、`/includes/comment.php` | 6 处 |
| `content/themes/dark-grid/js/script.js` | 同上 | 6 处 |

**修改示例**：

```javascript
// 修复前
xhr.open('POST', '/includes/statistics.php', true);

// 修复后
xhr.open('POST', (window.CLOUDARCADE_BASE || '/') + 'includes/statistics.php', true);
```

**为什么用 `(window.CLOUDARCADE_BASE || '/')`？**

- 正常情况：`window.CLOUDARCADE_BASE` 已在 Header 注入，值为 `https://smartool.top/arcade/`
- 兜底情况：若变量注入失败（如静态缓存页面），回退到根路径 `/`，保持根域名部署兼容性

### 第 4 步：修复 PHP 中的双重前缀问题

修改 `index.php` 与 `content/themes/theme-functions.php` 中所有 `DOMAIN + $_SERVER['REQUEST_URI']` 拼接处。

**修改清单（共 3 处）**：

| 文件 | 行号 | 场景 |
|---|---|---|
| `index.php` | ~125-160 | trailing slash 添加/移除重定向 |
| `index.php` | ~79-90 | 多语言 URL 重定向（`?lang=en`） |
| `content/themes/theme-functions.php` | ~106-117 | hreflang alternate 标签 |

**统一修复模式**（剥离 SUB_FOLDER 前缀后再拼接）：

```php
// 修复后（index.php trailing slash 处理）
$cur_url = $_SERVER['REQUEST_URI'];
if(SUB_FOLDER != ""){
    $_sub_prefix = '/' . trim(SUB_FOLDER, '/');
    if(substr($cur_url, 0, strlen($_sub_prefix)) === $_sub_prefix){
        $cur_url = substr($cur_url, strlen($_sub_prefix));
    }
}
if(substr($cur_url, -1) == '/' && !strpos($cur_url, '?')){
    header('Location: '.substr(DOMAIN, 0, -1).substr($cur_url, 0, -1), true, 301);
    exit();
}
```

**为什么 `get_cur_url()` 不需要修改？**

`includes/commons.php:457-463` 的 `get_cur_url()` 已正确处理：

```php
function get_cur_url(){
    if(SUB_FOLDER && SUB_FOLDER != ''){
        return DOMAIN . substr(str_replace(SUB_FOLDER, '', $_SERVER['REQUEST_URI']), 1);
    } else {
        return DOMAIN . substr($_SERVER['REQUEST_URI'], 1);
    }
}
```

**为什么 `DOMAIN.'admin/dashboard.php'` 不需要修改？**

`page-login.php`、`page-register.php`、`user.php`、`ajax-actions.php` 中都是 `DOMAIN + 固定字符串` 拼接：

```php
// page-login.php:6
header('Location: '.DOMAIN.'admin/dashboard.php');
// 结果 = "https://smartool.top/arcade/" + "admin/dashboard.php"
//      = "https://smartool.top/arcade/admin/dashboard.php"  ✅ 正确
```

`DOMAIN` 已含 `/arcade/` 前缀，拼接固定字符串（不含前缀）不会双重叠加，无需修改。

### 第 5 步：Caddy 配置（子路径路由）

在主 Caddyfile 中添加 `handle_path /arcade/*` 块：

```caddyfile
{$DOMAIN} {
    # ... Ghost 站点其他配置 ...

    # CloudArcade CMS 子路径
    handle_path /arcade/* {
        # handle_path 会自动剥离 /arcade 前缀
        # 例：/arcade/login → 内部重写为 /login → 命中 root 下的 index.php
        root * /app/cloudarcade
        encode zstd br gzip

        # 通配重写（对应 .htaccess 的 RewriteRule）
        @prettyUrl {
            not file
            path_regexp prettyUrl ^/(.*)$
        }
        rewrite @prettyUrl /index.php?viewpage={re.prettyUrl.1}

        # 404 处理
        route {
            php_server
            handle_errors {
                @404 expression {http.error.status_code} == 404
                handle @404 {
                    rewrite * /index.php?viewpage=404
                    php_server
                }
            }
        }
    }

    # 默认代理到 Ghost
    handle {
        reverse_proxy ghost:2368
    }
}
```

**为什么用 `handle_path` 而不是 `handle`？**

- `handle_path /arcade/*`：自动剥离 `/arcade` 前缀，内部 rewrite 基于剥离后的路径
- `handle /arcade/*`：不剥离前缀，rewrite 时需手动处理

## 验证修复

### 1. 首页正常加载

```
https://smartool.top/arcade/
```

打开浏览器开发者工具 → Network 面板，确认：

- ✅ 所有 JS 请求路径都是 `/arcade/js/xxx.js`（带前缀）
- ✅ POST 请求 `https://smartool.top/arcade/includes/statistics.php` 返回 200
- ✅ 控制台无 405 错误

### 2. 登录页正常工作

```
https://smartool.top/arcade/login
https://smartool.top/arcade/login/  ← 带尾斜杠也能正确重定向
```

- ✅ 访问带尾斜杠 URL，301 重定向到不带尾斜杠版本（不出现双重 `/arcade/arcade/`）
- ✅ 表单 POST 提交到 `https://smartool.top/arcade/login`，路径正确
- ✅ 输入正确账号密码后能跳转到 `https://smartool.top/arcade/admin/dashboard.php`

### 3. 控制台验证 CLOUDARCADE_BASE

在浏览器控制台执行：

```javascript
console.log(window.CLOUDARCADE_BASE);
// 预期输出："https://smartool.top/arcade/"
```

### 4. 查看页面源码确认注入

查看页面 HTML，`<head>` 中应有：

```html
<script>window.CLOUDARCADE_BASE = "https://smartool.top/arcade/";</script>
```

## 修改文件汇总

### PHP 文件（9 处修改）

| 文件 | 修改内容 |
|---|---|
| `includes/sub-folder.php` | 配置 `SUB_FOLDER = "arcade/"` |
| `content/themes/default/includes/header.php` | 注入 `CLOUDARCADE_BASE` |
| `content/themes/dark-grid/includes/header.php` | 注入 `CLOUDARCADE_BASE` |
| `includes/page-login.php` | 注入 `CLOUDARCADE_BASE` |
| `includes/page-register.php` | 注入 `CLOUDARCADE_BASE` |
| `includes/page-full.php` | 注入 `CLOUDARCADE_BASE` |
| `includes/page-splash.php` | 注入 `CLOUDARCADE_BASE` |
| `admin/dashboard.php` | 注入 `CLOUDARCADE_BASE` + `$_admin_base` |
| `index.php` | 修复 trailing slash 与多语言重定向的双重前缀（2 处） |
| `content/themes/theme-functions.php` | 修复 hreflang 标签的双重前缀 |

### JS 文件（19 处修改）

| 文件 | 修改处数 |
|---|---|
| `js/api.js` | 3 处（2 处 api.php + 1 处 api.css） |
| `js/stats.js` | 1 处 |
| `js/comment-system.js` | 3 处 |
| `js/script.js` | 1 处 |
| `content/themes/default/js/script.js` | 6 处 |
| `content/themes/dark-grid/js/script.js` | 6 处 |

## 常见问题

### Q1：修改后页面仍然报 405 错误

**原因**：浏览器缓存了旧版 JS 文件。

**修复**：

1. 浏览器硬刷新：`Ctrl+Shift+R`（Windows）或 `Cmd+Shift+R`（Mac）
2. 开无痕窗口重试
3. 给 JS 文件加版本号：`<script src="/arcade/js/stats.js?v=2"></script>`

### Q2：首页登录按钮点击后跳转到 404 页面

**原因**：访问 `https://smartool.top/arcade/login/`（带尾斜杠）时，PHP 的 trailing slash 重定向生成了双重前缀 URL。

**诊断**：浏览器地址栏看跳转后的 URL 是否出现 `/arcade/arcade/login`。

**修复**：见 [第 4 步：修复 PHP 中的双重前缀问题](#第-4-步-修复-php-中的双重前缀问题)。

### Q3：相对路径 `../includes/statistics.php` 需要修改吗？

**不需要**。

这两处只在 `admin/dashboard.php` 中被加载（后台页面），相对路径解析是相对于**页面 URL**，不是 JS 文件路径：

| 场景 | 页面 URL | `../includes/statistics.php` 解析结果 |
|---|---|---|
| 根路径部署 | `https://smartool.top/admin/dashboard.php` | `https://smartool.top/includes/statistics.php` ✅ |
| 子路径部署 | `https://smartool.top/arcade/admin/dashboard.php` | `https://smartool.top/arcade/includes/statistics.php` ✅ |

相对路径 `../` 会自动退一层目录，天然适配子路径。

### Q4：修改后后台管理页面（admin/dashboard.php）打不开

**原因**：后台 dashboard.php 也注入了 `CLOUDARCADE_BASE`，但后台 JS 用相对路径 `../` 加载，与前端 JS 路径逻辑不同。

**修复**：

1. 确认 `admin/dashboard.php` 在 `<head>` 中注入了 `CLOUDARCADE_BASE`
2. 检查后台 JS 中是否有 `/admin/` 开头的绝对路径（应改为 `(window.CLOUDARCADE_BASE || '/') + 'admin/xxx'`）
3. 浏览器硬刷新清除缓存

### Q5：子路径部署会影响 SEO 吗？

**略有影响，但可控**。

- **URL 结构变化**：从 `https://example.com/game/mario` 变为 `https://example.com/arcade/game/mario`
- **canonical 标签**：CloudArcade 的 `get_canonical_url()` 已正确处理 `SUB_FOLDER`（见 `includes/commons.php:457`）
- **sitemap**：需确认 sitemap 生成时使用 `DOMAIN` 常量（已含 `/arcade/` 前缀）

建议：

1. 在 Google Search Console 中重新提交 sitemap
2. 对旧 URL 设置 301 重定向到新 URL（如有历史索引）
3. 关注 Search Console 的覆盖率报告

## 关联阅读

- [FrankenPHP 部署](/devops/deploy-frankenphp)：CloudArcade 与 Ghost、GameMonetize 共存的容器部署方案
- [安装部署](/guide/installation)：CloudArcade 的基础安装流程
- [配置说明](/guide/configuration)：`SUB_FOLDER` 等配置项的详细说明
- [请求生命周期](/architecture/request-lifecycle)：理解 `index.php` 如何路由请求
