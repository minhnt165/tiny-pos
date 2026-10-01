' Bảo đảm server Tiny POS đang chạy rồi mở trình duyệt ở chế độ ứng dụng (Chrome/Edge, in không hỏi).
' Biểu tượng Startup và Desktop đều trỏ file này.
Option Explicit
Dim sh, fso, dir, url, i, candidates, p, browser
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
url = "http://localhost:3000"

Function Alive()
  Dim http
  Alive = False
  On Error Resume Next
  Set http = CreateObject("MSXML2.XMLHTTP")
  http.Open "GET", url & "/api/settings", False
  http.Send
  If Err.Number = 0 Then
    If http.Status = 200 Then Alive = True
  End If
  Err.Clear
  On Error GoTo 0
End Function

If Not Alive() Then
  sh.Run "wscript.exe """ & dir & "\start-hidden.vbs""", 0, False
  For i = 1 To 30
    WScript.Sleep 1000
    If Alive() Then Exit For
  Next
End If
If Not Alive() Then
  MsgBox "Khong bat duoc Tiny POS. Xem file data\server.log trong thu muc phan mem.", 16, "Tiny POS"
  WScript.Quit 1
End If

browser = ""
candidates = Array( _
  sh.ExpandEnvironmentStrings("%ProgramFiles%") & "\Google\Chrome\Application\chrome.exe", _
  sh.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\Google\Chrome\Application\chrome.exe", _
  sh.ExpandEnvironmentStrings("%LocalAppData%") & "\Google\Chrome\Application\chrome.exe", _
  sh.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\Microsoft\Edge\Application\msedge.exe", _
  sh.ExpandEnvironmentStrings("%ProgramFiles%") & "\Microsoft\Edge\Application\msedge.exe")
For Each p In candidates
  If browser = "" And fso.FileExists(p) Then browser = p
Next
If browser = "" Then
  sh.Run url, 1, False
Else
  sh.Run """" & browser & """ --app=" & url & " --kiosk-printing", 1, False
End If
