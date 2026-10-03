# Cài Tiny POS trên máy quầy: build, biểu tượng tự chạy khi đăng nhập + trên Desktop, mở cổng 7869 cho điện thoại.
# Chạy qua install.cmd (không cần quyền quản trị; chỉ bước tường lửa hỏi UAC).
$ErrorActionPreference = 'Stop'
$Repo = Split-Path -Parent $PSScriptRoot
Set-Location $Repo

Write-Host '[1/6] Kiem tra Node.js...'
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Write-Host 'Chua cai Node.js. Tai ban LTS tai https://nodejs.org roi chay lai.'; exit 1 }
$nodeVer = (& node --version).Trim()
$major = [int]($nodeVer.TrimStart('v').Split('.')[0])
if ($major -lt 20) { Write-Host "Node.js $nodeVer qua cu, can 20 tro len: https://nodejs.org"; exit 1 }
Write-Host "    Node.js $nodeVer"

Write-Host '[2/6] Cai thu vien va build (vai phut)...'
if (Test-Path "$Repo\.certs\corp-root.pem") { $env:NODE_EXTRA_CA_CERTS = "$Repo\.certs\corp-root.pem" }
& npm install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { Write-Host 'npm install loi, xem thong bao o tren.'; exit 1 }
& npm run build
if ($LASTEXITCODE -ne 0) { Write-Host 'Build loi, xem thong bao o tren.'; exit 1 }

Write-Host '[3/6] Tao bieu tuong tu chay va tren Desktop...'
$browser = $null
$candidates = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
)
foreach ($p in $candidates) { if (Test-Path $p) { $browser = $p; break } }
$ws = New-Object -ComObject WScript.Shell
$startup = [Environment]::GetFolderPath('Startup')
$desktop = [Environment]::GetFolderPath('Desktop')
foreach ($dir in @($startup, $desktop)) {
  $s = $ws.CreateShortcut("$dir\Tiny POS.lnk")
  $s.TargetPath = "$env:SystemRoot\System32\wscript.exe"
  $s.Arguments = "`"$Repo\scripts\open.vbs`""
  $s.WorkingDirectory = $Repo
  $s.Description = 'Mo Tiny POS'
  if ($browser) { $s.IconLocation = "$browser,0" }
  $s.Save()
  Write-Host "    $dir\Tiny POS.lnk"
}

Write-Host '[4/6] Mo cong 7869 tren tuong lua (Windows se hoi quyen quan tri)...'
& "$PSScriptRoot\firewall.ps1"

Write-Host '[5/6] Bat Tiny POS...'
Start-Process wscript.exe -ArgumentList "`"$Repo\scripts\open.vbs`""

Write-Host '[6/6] Xong.'
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1).IPAddress
if ($ip) { Write-Host "Dien thoai cung Wi-Fi mo: http://${ip}:7869" }
Write-Host 'Tu nay bat may la Tiny POS tu chay. Bieu tuong "Tiny POS" tren Desktop mo man hinh ban hang.'
