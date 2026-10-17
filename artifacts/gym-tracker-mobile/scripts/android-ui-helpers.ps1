$ErrorActionPreference = 'Stop'
$adb = Join-Path $PSScriptRoot '../../android-sdk/platform-tools/adb.exe'
$qaOutput = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../apk/verified'))
function Read-Ui {
  $dump = & $adb shell uiautomator dump /sdcard/coach-ui.xml 2>&1
  if ($LASTEXITCODE -ne 0 -or $dump -match 'ERROR:') { throw 'UI dump failed (pause any ticking timer before dumping)' }
  [xml]((& $adb shell cat /sdcard/coach-ui.xml) -join "`n")
}
function Tap-Node($node) {
  if (!$node) { throw 'Control missing' }
  $bounds = [regex]::Matches($node.bounds, '\d+')
  & $adb shell input tap (([int]$bounds[0].Value + [int]$bounds[2].Value) / 2) (([int]$bounds[1].Value + [int]$bounds[3].Value) / 2)
}
function Tap-Text([string]$text) {
  $ui = Read-Ui
  Tap-Node ($ui.SelectNodes('//node') | Where-Object { $_.text -eq $text } | Select-Object -First 1)
}
function Tap-Label([string]$label) {
  $ui = Read-Ui
  Tap-Node ($ui.SelectSingleNode("//node[@content-desc='$label']"))
}
function Open-Route([string]$path) {
  & $adb shell am start -a android.intent.action.VIEW -d "gym-tracker-mobile://$path" | Out-Null
  Read-Ui
}
function Save-Screen([string]$name) {
  & $adb shell screencap -p /sdcard/coach-screen.png
  & $adb pull /sdcard/coach-screen.png (Join-Path $qaOutput "$name.png") | Out-Null
  & $adb pull /sdcard/coach-ui.xml (Join-Path $qaOutput "$name.xml") | Out-Null
}
function Find-Scrolled([string]$xpath, [int]$bottom = 2100) {
  for ($i = 0; $i -lt 12; $i++) {
    $ui = Read-Ui
    $node = $ui.SelectSingleNode($xpath)
    if ($node) {
      $bounds = [regex]::Matches($node.bounds, '\d+')
      if ([int]$bounds[3].Value -gt [int]$bounds[1].Value -and [int]$bounds[1].Value -ge 250 -and [int]$bounds[3].Value -lt $bottom) { return $node }
    }
    & $adb shell input swipe 540 1780 540 850 250
  }
  throw "Could not find $xpath"
}
function Export-Backup([string]$filename) {
  $null = Open-Route 'backup'
  Tap-Text ([regex]::Unescape('\u042d\u043a\u0441\u043f\u043e\u0440\u0442 \u0432 \u0444\u0430\u0439\u043b'))
  $picker = Read-Ui
  if ($picker.SelectSingleNode('//node[contains(@text,"protect your privacy")]')) {
    Tap-Text 'Documents'
    Tap-Text 'GymTracker'
  }
  Tap-Text 'USE THIS FOLDER'
  $permission = Read-Ui
  $allow = $permission.SelectSingleNode('//node[@text="ALLOW"]')
  if ($allow) { Tap-Node $allow }
  $ui = Read-Ui
  $success = [regex]::Unescape('\u041a\u043e\u043f\u0438\u044f \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0430')
  if (!$ui.SelectSingleNode("//node[@text='$success']")) { throw 'Backup not confirmed' }
  $saved = $ui.SelectSingleNode('//node[starts-with(@text,"gym-tracker-")]').text
  & $adb pull "/sdcard/Documents/GymTracker/$saved" (Join-Path $qaOutput $filename)
  Tap-Text 'OK'
  "Exported $saved as $filename"
}
