# SystemUpdater 系统更新类

`SystemUpdater` 类（`classes/SystemUpdater.php`）负责系统的版本检查、更新包下载、备份与安装，通过与官方更新服务器（`api.cloudarcade.net`）交互完成整个升级流程。

## 类概览

```php
class SystemUpdater
{
    public function __construct()
    // 初始化：读取购买码（purchase code）、当前版本、临时目录与日志文件

    private function initLogFile()          // 初始化日志文件
    private function writeToLog($message)   // 写日志
    private function logError($message)     // 记录错误

    public function checkUpdate()           // 检查更新（对官方 API）
    public function performUpdate()         // 执行完整更新流程

    private function requestDownloadToken() // 请求下载令牌
    private function handleDatabaseUpdate() // 执行数据库结构更新
    private function downloadUpdate()       // 下载更新包
    private function createBackup()         // 创建备份
    private function verifyAndExtractUpdate($packagePath) // 校验并解压
    private function installUpdate()        // 安装更新
    private function makeApiRequest($url, $params)  // 请求 API
    private function downloadFile($url, $params, $target) // 下载文件
    private function cleanTempFiles()       // 清理临时文件
    private function verifyUpdatePackage()  // 校验更新包完整性
    private function copyDirectory($source, $dest)  // 复制目录
    private function removeDirectory($dir)  // 删除目录
}
```

## 更新检查（checkUpdate）

```php
public function checkUpdate()
{
    try {
        if (!$this->purchaseCode) {
            throw new Exception('Invalid purchase code');
        }

        $params = [
            'action' => 'check',
            'code' => $this->purchaseCode,
            'current_version' => $this->currentVersion
        ];

        $response = $this->makeApiRequest('https://api.cloudarcade.net/cms-update/info.php', $params);

        switch ($response['status']) {
            case 'current':
                return ['status' => 'current', 'current_version' => $response['version'], ...];
            case 'update':
                return ['status' => 'update', 'next_version' => $response['next'],
                        'latest_version' => $response['latest'], 'changes' => ..., ...];
            default:
                throw new Exception($response['message'] ?? 'Unknown error occurred');
        }
    } catch (Exception $e) {
        $this->logError('Update check failed: ' . $e->getMessage());
        return ['status' => 'error', 'message' => $e->getMessage()];
    }
}
```

要点：

- 需要有效的**购买码（purchase code）**，否则直接报错
- 携带当前版本号询问服务器是否有更新
- 返回 `current`（已最新）/ `update`（有新版，含变更说明）/ `error` 三种状态
- 支持 `?test_update=1` 参数用于测试环境

## 完整更新流程（performUpdate）

```
performUpdate()
  ├─ 1. checkUpdate()            检查是否有更新
  ├─ 2. requestDownloadToken()   向服务器请求下载令牌
  ├─ 3. downloadUpdate()         下载更新包（zip）
  ├─ 4. createBackup()           备份当前站点（db/ + 文件）
  ├─ 5. verifyUpdatePackage()    校验更新包
  ├─ 6. verifyAndExtractUpdate() 解压并覆盖文件
  ├─ 7. handleDatabaseUpdate()   执行数据库更新
  ├─ 8. installUpdate()          收尾（版本号更新等）
  └─ 9. cleanTempFiles()         清理临时文件
```

### 备份（createBackup）

更新前自动创建备份（`do_backup` 函数，位于 commons.php）：

```php
private function createBackup()
{
    // 备份数据库（导出 SQL）+ 站点文件（zip）
    // 备份包存储在临时目录，供失败时恢复
}
```

### 数据库更新（handleDatabaseUpdate）

```php
private function handleDatabaseUpdate()
{
    // 对比当前版本与目标版本的数据库差异
    // 执行 ALTER / CREATE 语句升级表结构
    // 例如新增的字段、表（如 user_subscriptions、action_logs）
}
```

### 安装（installUpdate / verifyAndExtractUpdate）

```php
private function verifyAndExtractUpdate($packagePath)
{
    // 校验 zip 包签名/完整性
    // 解压并逐文件覆盖到站点目录
    // 更新 VERSION 常量
}

private function installUpdate()
{
    // 调用 verifyAndExtractUpdate
    // 清理临时文件，记录日志
}
```

## 辅助方法

### makeApiRequest / downloadFile

与官方服务器通信的统一封装：

```php
private function makeApiRequest($url, $params)
// POST/GET 请求 API，解析 JSON 响应

private function downloadFile($url, $params, $target)
// 下载文件到指定路径（流式写入，支持大文件）
```

### 文件操作

```php
private function copyDirectory($source, $dest)
// 递归复制目录（用于备份还原/文件部署）

private function removeDirectory($dir)
// 递归删除目录（清理临时文件）
```

## 使用场景

| 场景 | 调用 |
| --- | --- |
| 后台「系统更新」页面 | 展示 `checkUpdate()` 结果 |
| 点击「立即更新」 | `performUpdate()` |
| 更新日志 | `writeToLog` 写入的日志文件 |

## 安全与注意事项

1. **购买码校验**：无有效购买码无法检查/安装更新
2. **自动备份**：更新前强制备份，失败可恢复
3. **校验机制**：更新包下载后校验完整性，防止损坏包导致站点崩溃
4. **日志记录**：全流程写日志，便于排查
5. 依赖服务器环境支持 `zip` 扩展与网络访问（`curl`/`allow_url_fopen`）
