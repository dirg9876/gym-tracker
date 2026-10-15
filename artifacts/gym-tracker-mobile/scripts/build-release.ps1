param([string]$SigningKey = (Join-Path $PSScriptRoot '../../apk/debug.keystore'))
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if (!(Test-Path -LiteralPath $SigningKey)) { throw 'The existing private signing key is required. Do not generate a replacement key.' }
if ((Get-FileHash -LiteralPath $SigningKey -Algorithm SHA256).Hash -ne '5013232F77A47ECBF2980735F28B1CA0619A5D3F036657F4495F9CD84AD96AF2') { throw 'Signing key differs from the key used in the installed local APKs.' }
if (!$env:JAVA_HOME -or !$env:ANDROID_HOME) { throw 'Set JAVA_HOME (JDK 17) and ANDROID_HOME (Android SDK).' }
$env:CI = '1'; $env:NODE_ENV = 'production'
Push-Location $root
try {
  pnpm exec expo prebuild --platform android --no-install
  if ($LASTEXITCODE -ne 0) { throw 'Expo prebuild failed' }
  Copy-Item -LiteralPath $SigningKey -Destination (Join-Path $root 'android/app/debug.keystore') -Force
  [IO.File]::WriteAllText((Join-Path $root 'android/local.properties'), 'sdk.dir=' + $env:ANDROID_HOME.Replace('\', '/'))
  Push-Location (Join-Path $root 'android')
  try {
    .\gradlew.bat assembleRelease '-PreactNativeArchitectures=arm64-v8a,x86_64' '-Dorg.gradle.jvmargs=-Xmx3072m -XX:MaxMetaspaceSize=1024m' --max-workers=2 --console=plain
    if ($LASTEXITCODE -ne 0) { throw 'Android build failed' }
  } finally { Pop-Location }
} finally { Pop-Location }
