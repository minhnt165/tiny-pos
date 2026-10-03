# Mở cổng 7869 của Tiny POS trên tường lửa cho điện thoại. Rule "Tiny POS" cũ khác cổng (bản trước dùng 3000) thì sửa lại.
# Gọi từ install.ps1 và update.cmd; chỉ khi phải thêm/sửa rule mới hỏi UAC.
$Port = 7869
$rule = Get-NetFirewallRule -DisplayName 'Tiny POS' -ErrorAction SilentlyContinue
$current = if ($rule) { @($rule | Get-NetFirewallPortFilter -ErrorAction SilentlyContinue).LocalPort } else { @() }
if ($current -contains "$Port") {
  Write-Host '    Da co rule.'
} else {
  if ($rule) {
    $netshArgs = "advfirewall firewall set rule name=`"Tiny POS`" new localport=$Port"
  } else {
    $netshArgs = "advfirewall firewall add rule name=`"Tiny POS`" dir=in action=allow protocol=TCP localport=$Port"
  }
  try {
    Start-Process netsh -ArgumentList $netshArgs -Verb RunAs -Wait -ErrorAction Stop
    Write-Host "    Da mo cong $Port."
  } catch {
    Write-Host "    Bo qua: dien thoai se khong vao duoc. Chay lai install.cmd hoac tu mo cong $Port trong Windows Defender Firewall."
  }
}
