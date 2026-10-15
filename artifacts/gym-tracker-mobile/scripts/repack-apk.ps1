param(
  [Parameter(Mandatory = $true)][string]$BaseApk,
  [Parameter(Mandatory = $true)][string]$SdkRoot,
  [Parameter(Mandatory = $true)][string]$Keystore,
  [Parameter(Mandatory = $true)][string]$OutputDirectory,
  [string]$ApktoolJar = (Join-Path $PSScriptRoot '../../apk/tools/apktool_2.12.1.jar')
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$mobileRoot = Split-Path $PSScriptRoot -Parent
$basePath = (Resolve-Path -LiteralPath $BaseApk).Path
$keyPath = (Resolve-Path -LiteralPath $Keystore).Path
$sdkPath = (Resolve-Path -LiteralPath $SdkRoot).Path
$apktoolPath = (Resolve-Path -LiteralPath $ApktoolJar).Path
$buildTools = Join-Path $sdkPath 'build-tools/36.0.0'
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$output = (Resolve-Path -LiteralPath $OutputDirectory).Path
$resourceMap = Join-Path $output 'native-resources.json'
$resources = & (Join-Path $buildTools 'aapt2.exe') dump resources $basePath
if ($LASTEXITCODE -ne 0) { throw 'aapt2 resource inspection failed' }
$names = @($resources | ForEach-Object {
  if ($_ -match '^\s+resource 0x\S+ (?:raw|drawable)/(\S+)') { $Matches[1] }
})
[System.IO.File]::WriteAllText($resourceMap, (ConvertTo-Json -InputObject $names), [System.Text.UTF8Encoding]::new($false))
$bundle = Join-Path $output 'index.android.bundle'
$oldMap = $env:GYM_APK_RESOURCE_MAP
$oldRawAssets = $env:EXPO_PUBLIC_GYM_REPACK_ASSETS
Push-Location $mobileRoot
try {
  $env:GYM_APK_RESOURCE_MAP = $resourceMap
  $env:EXPO_PUBLIC_GYM_REPACK_ASSETS = '1'
  & pnpm exec expo export:embed --entry-file (Join-Path $mobileRoot 'node_modules/expo-router/entry.js') --platform android --dev false --minify true --bundle-output $bundle --assets-dest (Join-Path $output 'res') --unstable-transform-profile hermes --bytecode --reset-cache
  if ($LASTEXITCODE -ne 0) { throw 'Android bundle export failed' }
} finally {
  $env:GYM_APK_RESOURCE_MAP = $oldMap
  $env:EXPO_PUBLIC_GYM_REPACK_ASSETS = $oldRawAssets
  Pop-Location
}
$unsigned = Join-Path $output 'unsigned.apk'
$aligned = Join-Path $output 'aligned.apk'
$signed = Join-Path $output 'gym-tracker-tested.apk'
Copy-Item -LiteralPath $basePath -Destination $unsigned -Force
$zip = [System.IO.Compression.ZipFile]::Open($unsigned, 'Update')
try {
  @($zip.Entries | Where-Object { $_.FullName -match '^META-INF/(?:[^/]+\.(?:SF|RSA|DSA|EC)|MANIFEST\.MF)$' }) | ForEach-Object { $_.Delete() }
  $zip.GetEntry('assets/index.android.bundle').Delete()
  [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $bundle, 'assets/index.android.bundle', 'Optimal') | Out-Null
  $logoEntry = 'assets/branding/gymbeam-logo.png'
  if ($zip.GetEntry($logoEntry)) { $zip.GetEntry($logoEntry).Delete() }
  $logoPath = Join-Path $mobileRoot '../gym-tracker/src/assets/gymbeam-logo.png'
  [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $logoPath, $logoEntry, 'Optimal') | Out-Null
} finally {
  $zip.Dispose()
}
& (Join-Path $PSScriptRoot 'brand-android-apk.ps1') -ApkPath $unsigned -SdkRoot $sdkPath -ApktoolJar $apktoolPath -WorkDirectory (Join-Path $output ("branding-" + [guid]::NewGuid().ToString('N')))
& (Join-Path $buildTools 'zipalign.exe') -f -p 4 $unsigned $aligned
if ($LASTEXITCODE -ne 0) { throw 'zipalign failed' }
& (Join-Path $buildTools 'apksigner.bat') sign --ks $keyPath --ks-key-alias androiddebugkey --ks-pass pass:android --key-pass pass:android --out $signed $aligned
if ($LASTEXITCODE -ne 0) { throw 'APK signing failed' }
& (Join-Path $buildTools 'apksigner.bat') verify $signed
if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed' }
Write-Output $signed
