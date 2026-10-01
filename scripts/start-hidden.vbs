' Chạy start.cmd không hiện cửa sổ (dùng cho biểu tượng tự chạy và open.vbs).
Option Explicit
Dim sh, fso, dir
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.Run "cmd /c """ & dir & "\start.cmd""", 0, False
