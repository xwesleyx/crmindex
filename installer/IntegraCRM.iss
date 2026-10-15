; Instalador Windows do Integra CRM (Inno Setup 6).
; Não compile direto — rode installer\build.ps1, que monta installer\.build\stage
; (Node portátil + CRM compilado + serviço do WhatsApp + banco limpo) e chama
; o ISCC com este arquivo.

#define AppName "Integra CRM"
#ifndef AppVersion
  #define AppVersion "1.0"
#endif
#define Stage "{#SourcePath}\.build\stage"
#define CrmPort "3100"
#define WhatsappPort "8787"

[Setup]
AppId={{6F1C2B7E-4E5A-4D8B-9A51-2C7E0B3D9F41}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=Integra
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir={#SourcePath}\output
OutputBaseFilename=IntegraCRM-Setup-{#AppVersion}
SetupIconFile={#Stage}\icon.ico
UninstallDisplayIcon={app}\icon.ico
Compression=lzma2/ultra64
SolidCompression=yes
LZMANumBlockThreads=4
WizardStyle=modern
CloseApplications=no

[Languages]
Name: "ptbr"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Tasks]
Name: "desktopicon"; Description: "Criar atalho na Área de Trabalho"; GroupDescription: "Atalhos:"
Name: "autostart"; Description: "Iniciar o Integra CRM automaticamente com o Windows (recomendado — o WhatsApp só recebe mensagens com ele ligado)"; GroupDescription: "Inicialização:"

[Dirs]
; Dados (banco, sessão do WhatsApp, mídias, logs) — fora de Arquivos de
; Programas e graváveis por qualquer usuário do computador.
Name: "{commonappdata}\IntegraCRM"; Permissions: users-modify

[Files]
Source: "{#Stage}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#AppName}"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\launcher\start.vbs"""; IconFilename: "{app}\icon.ico"
Name: "{group}\Parar {#AppName}"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\launcher\stop.vbs"""; IconFilename: "{app}\icon.ico"
Name: "{group}\Pasta de dados e logs"; Filename: "{commonappdata}\IntegraCRM"
Name: "{group}\Desinstalar {#AppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\launcher\start.vbs"""; IconFilename: "{app}\icon.ico"; Tasks: desktopicon
Name: "{commonstartup}\{#AppName}"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\launcher\start.vbs"""; IconFilename: "{app}\icon.ico"; Tasks: autostart

[Run]
; Libera as portas no Firewall pra outros computadores da rede acessarem o
; CRM (e carregarem fotos/áudios do WhatsApp).
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall delete rule name=""Integra CRM"""; Flags: runhidden
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall add rule name=""Integra CRM"" dir=in action=allow protocol=TCP localport={#CrmPort},{#WhatsappPort}"; Flags: runhidden; StatusMsg: "Liberando o acesso pela rede..."
; Atualizador automático: tarefa do Windows (SYSTEM, a cada minuto) — ver
; launcher\updater.js.
Filename: "{app}\runtime\node.exe"; Parameters: """{app}\launcher\updater.js"" install-task"; Flags: runhidden waituntilterminated; StatusMsg: "Configurando as atualizações automáticas..."
Filename: "{sys}\wscript.exe"; Parameters: """{app}\launcher\start.vbs"""; Description: "Abrir o {#AppName} agora"; Flags: postinstall nowait skipifsilent

[UninstallRun]
Filename: "{app}\runtime\node.exe"; Parameters: """{app}\launcher\updater.js"" uninstall-task"; Flags: runhidden waituntilterminated; RunOnceId: "DelUpdaterTask"
Filename: "{app}\runtime\node.exe"; Parameters: """{app}\launcher\launcher.js"" stop"; Flags: runhidden waituntilterminated; RunOnceId: "StopCrm"
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall delete rule name=""Integra CRM"""; Flags: runhidden; RunOnceId: "DelFirewall"

[Messages]
ptbr.FinishedLabel=O {#AppName} foi instalado.%n%nAcesse pelo navegador em http://localhost:{#CrmPort} (ou, de outro computador da rede, http://IP-DESTE-COMPUTADOR:{#CrmPort}).%n%nEntre com o acesso fornecido pelo suporte.

[Code]
// CNPJ do cliente (vínculo da licença): pedido numa tela do instalador e
// gravado em {commonappdata}\IntegraCRM\instalacao.json — o CRM confere esse
// CNPJ na lista de ativos publicada no GitHub. Atualização (instalação por
// cima) não pergunta de novo. Instalação silenciosa: parâmetro /CNPJ=...
var
  CnpjPage: TInputQueryWizardPage;

function OnlyDigits(S: String): String;
var
  I: Integer;
begin
  Result := '';
  for I := 1 to Length(S) do
    if (S[I] >= '0') and (S[I] <= '9') then
      Result := Result + S[I];
end;

function CnpjCheckDigit(D: String; Len: Integer): Integer;
var
  I, Sum, Weight: Integer;
begin
  Sum := 0;
  Weight := Len - 7;
  for I := 1 to Len do
  begin
    Sum := Sum + (Ord(D[I]) - Ord('0')) * Weight;
    Weight := Weight - 1;
    if Weight < 2 then
      Weight := 9;
  end;
  Result := 11 - (Sum mod 11);
  if Result >= 10 then
    Result := 0;
end;

function IsValidCnpj(D: String): Boolean;
begin
  Result := False;
  if Length(D) <> 14 then
    Exit;
  if D = StringOfChar(D[1], 14) then
    Exit;
  Result := (CnpjCheckDigit(D, 12) = Ord(D[13]) - Ord('0')) and (CnpjCheckDigit(D, 13) = Ord(D[14]) - Ord('0'));
end;

function LicenseFile: String;
begin
  Result := ExpandConstant('{commonappdata}\IntegraCRM\instalacao.json');
end;

function EnteredCnpj: String;
begin
  Result := OnlyDigits(ExpandConstant('{param:CNPJ|}'));
  if (Result = '') and (CnpjPage <> nil) then
    Result := OnlyDigits(CnpjPage.Values[0]);
end;

procedure InitializeWizard;
begin
  CnpjPage := CreateInputQueryPage(wpWelcome,
    'CNPJ do cliente',
    'Informe o CNPJ da empresa onde o CRM está sendo instalado.',
    'O CNPJ vincula esta instalação à licença do cliente. Digite só os números ou no formato 00.000.000/0000-00.');
  CnpjPage.Add('CNPJ:', False);
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  // Já vinculado (atualização) ou CNPJ passado na linha de comando.
  Result := (CnpjPage <> nil) and (PageID = CnpjPage.ID) and
    (FileExists(LicenseFile) or (ExpandConstant('{param:CNPJ|}') <> ''));
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  // Silencioso sem CNPJ: segue — o suporte vincula depois pelo menu Licença.
  if WizardSilent then
    Exit;
  if (CnpjPage <> nil) and (CurPageID = CnpjPage.ID) and not IsValidCnpj(OnlyDigits(CnpjPage.Values[0])) then
  begin
    MsgBox('CNPJ inválido. Confira os números.', mbError, MB_OK);
    Result := False;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  Cnpj: String;
begin
  if (CurStep = ssPostInstall) and not FileExists(LicenseFile) then
  begin
    Cnpj := EnteredCnpj;
    if IsValidCnpj(Cnpj) then
    begin
      ForceDirectories(ExtractFileDir(LicenseFile));
      SaveStringToFile(LicenseFile, '{"cnpj":"' + Cnpj + '"}', False);
    end;
  end;
end;

// Atualização/reinstalação: para o CRM que estiver rodando antes de
// sobrescrever os arquivos (senão o Windows trava os .exe/.dll em uso).
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
  NodeExe, Launcher: String;
begin
  Result := '';
  NodeExe := ExpandConstant('{app}\runtime\node.exe');
  Launcher := ExpandConstant('{app}\launcher\launcher.js');
  if FileExists(NodeExe) and FileExists(Launcher) then
    Exec(NodeExe, '"' + Launcher + '" stop', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;
