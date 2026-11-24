# RAVEN's ノート 一键发布脚本
# 用法：双击 发布网站.bat，或在项目根目录运行：powershell -File scripts\publish.ps1 "本次更新说明"
# 说明：构建 -> 数据测试 -> 提交(如有改动) -> 推送 -> 等待 GitHub Pages 部署完成

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot          # 项目根目录 (scripts 的上一级)
$tools = Join-Path (Split-Path -Parent $root) '.tools'
$nodeDir = Join-Path $tools 'node\node-v22.14.0-win-x64'
$gitDir = Join-Path $tools 'git\cmd'
$ghDir = Join-Path $tools 'gh\bin'
$ghConfig = Join-Path $tools 'ghconfig'

Set-Location $root

function Add-Path($p) {
  if (Test-Path $p) { $env:Path = "$p;$env:Path" }
}
Add-Path $nodeDir
Add-Path $gitDir
Add-Path $ghDir
$env:GH_CONFIG_DIR = $ghConfig

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "    $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "    $msg" -ForegroundColor Yellow }
function Fail($msg) { Write-Host "`n[失败] $msg`n" -ForegroundColor Red; exit 1 }

# 1. 依赖检查
Step '检查环境'
$nodeOK = (Get-Command node -ErrorAction SilentlyContinue) -ne $null
$gitOK  = (Get-Command git  -ErrorAction SilentlyContinue) -ne $null
$ghOK   = (Get-Command gh   -ErrorAction SilentlyContinue) -ne $null
if (-not $nodeOK) { Fail "找不到 Node.js，路径应为：$nodeDir" }
if (-not $gitOK)  { Fail "找不到 Git，路径应为：$gitDir" }
if (-not $ghOK)   { Fail "找不到 GitHub CLI，路径应为：$ghDir" }
& gh auth status *> $null
if ($LASTEXITCODE -ne 0) { Fail 'GitHub 未授权。请先在终端运行：gh auth login --web' }
Ok "node: $(& node --version)  git: $(& git --version)  gh: $(& gh --version | Select-Object -First 1)"

# 2. 只允许在 main 分支发布
$branch = (& git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne 'main') { Fail "当前分支是 '$branch'，请先切换到 main 再发布" }
Ok "当前分支：main"

# 3. 构建
Step '构建项目（类型检查 + 打包）'
& npm run build
if ($LASTEXITCODE -ne 0) { Fail '构建失败，请修复错误后再发布' }
Ok '构建成功'

# 4. 数据层测试
Step '运行数据层测试'
& npm run test:data
if ($LASTEXITCODE -ne 0) { Fail '数据测试失败，请修复后再发布' }
Ok '数据测试通过'

# 5. 远程仓库信息
$origin = (& git remote get-url origin 2>$null).Trim()
if (-not $origin) { Fail '未配置 origin 远程仓库' }
# 解析 owner/repo
$repoSlug = $origin -replace '^https?://github\.com/', '' -replace '\.git$', '' -replace '/$', ''
if ($repoSlug -notmatch '^[^/]+/[^/]+$') { Fail "无法解析远程仓库：$origin" }
$repoInfo = $repoSlug -split '/'
$owner = $repoInfo[0]; $repo = $repoInfo[1]
$liveUrl = "https://$owner.github.io/$repo/"
Ok "仓库：$repoSlug  线上地址：$liveUrl"

# 6. 提交并推送
$changed = @(& git status --porcelain | Where-Object { $_ -ne '' })
if ($changed.Count -gt 0) {
  $msg = if ($args.Count -gt 0) { $args -join ' ' } else { '更新网站（自动发布）' }
  Step "提交改动（共 $($changed.Count) 项）：$msg"
  $changed | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
  & git add -A
  & git commit -m $msg
  if ($LASTEXITCODE -ne 0) { Fail 'git commit 失败' }
  Ok '已提交'
} else {
  Warn '工作区没有新改动，跳过提交（仍会推送并部署）'
}

Step '推送到 GitHub'
& gh auth setup-git *> $null   # 让 git push 通过 gh 凭据

# 低速超过 30 秒就放弃本次连接并重试，避免在不稳定网络下空等几分钟
function Try-Push($url, $label) {
  for ($i = 1; $i -le 4; $i++) {
    & git -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=30 push $url main:main
    if ($LASTEXITCODE -eq 0) { return $true }
    if ($i -lt 4) { Warn "$label 失败（第 $i/$((4-1)) 次重试，8 秒后）"; Start-Sleep -Seconds 8 }
  }
  return $false
}

$pushed = Try-Push 'origin' '默认推送'
if (-not $pushed) {
  $token = (& gh auth token).Trim()
  if (-not $token) { Fail 'git push 失败，且无法获取令牌' }
  Warn '默认推送失败，改用令牌 URL 重试'
  $pushed = Try-Push "https://x-access-token:$token@github.com/$repoSlug.git" '令牌推送'
}
if (-not $pushed) { Fail 'git push 多次重试仍失败，请检查网络后手动运行：git push origin main' }
Ok '已推送'

# 7. 等待部署
Step '等待 GitHub Pages 部署完成'
Start-Sleep -Seconds 6
$runJson = & gh run list --repo $repoSlug --limit 1 --json databaseId,displayTitle,status,conclusion
$run = $runJson | ConvertFrom-Json
$runId = $run.databaseId
Warn "监控工作流：$($run.displayTitle) (#$runId)"
& gh run watch $runId --repo $repoSlug --exit-status --interval 15
if ($LASTEXITCODE -ne 0) { Fail "部署失败，请查看：https://github.com/$repoSlug/actions" }
Ok '部署成功！'

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  发布完成：$liveUrl" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green
