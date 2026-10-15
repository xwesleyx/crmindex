' Roda o launcher do Integra CRM (stop) sem abrir janela de console.
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)
node = fso.BuildPath(fso.GetParentFolderName(here), "runtime\node.exe")
launcher = fso.BuildPath(here, "launcher.js")
CreateObject("WScript.Shell").Run Chr(34) & node & Chr(34) & " " & Chr(34) & launcher & Chr(34) & " stop", 0, False
