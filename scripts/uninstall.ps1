# Gỡ Tiny POS: dừng server, xóa biểu tượng Startup/Desktop, xóa rule tường lửa. Giữ nguyên data\.
$Repo = Split-Path -Parent $PSScriptRoot
Write-Host '[1/3] Dung server...'
& cmd /c "`"$Repo\scripts\stop.cmd`""
Write-Host '[2/3] Xoa bieu tuong...'
foreach ($dir in @([Environment]::GetFolderPath('Startup'), [Environment]::GetFolderPath('Desktop'))) {
  $f = "$dir\Tiny POS.lnk"
  if (Test-Path $f) { Remove-Item $f; Write-Host "    Da xoa $f" }
}
Write-Host '[3/3] Xoa rule tuong lua (Windows se hoi quyen quan tri)...'
try {
  Start-Process netsh -ArgumentList 'advfirewall firewall delete rule name="Tiny POS"' -Verb RunAs -Wait
} catch {
  Write-Host '    Bo qua.'
}
Write-Host "Xong. Du lieu van o $Repo\data, muon xoa thi xoa thu muc do."
