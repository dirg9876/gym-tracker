param(
  [Parameter(Mandatory = $true)][string]$ApkPath,
  [Parameter(Mandatory = $true)][string]$SdkRoot,
  [Parameter(Mandatory = $true)][string]$ApktoolJar,
  [Parameter(Mandatory = $true)][string]$WorkDirectory
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$apk = (Resolve-Path -LiteralPath $ApkPath).Path
$jar = (Resolve-Path -LiteralPath $ApktoolJar).Path
$aapt = Join-Path (Resolve-Path -LiteralPath $SdkRoot).Path 'build-tools/36.0.0/aapt2.exe'
$java = if ($env:JAVA_HOME) { Join-Path $env:JAVA_HOME 'bin/java.exe' } else { 'java' }
function Get-NativeIds($target) {
  @(& $aapt dump resources $target | ForEach-Object {
    if ($_ -match '^\s+resource (0x\S+) (\S+)') { "$($Matches[1]) $($Matches[2])" }
  })
}
$originalIds = Get-NativeIds $apk
if ($originalIds.Count -lt 1000) { throw 'Cannot inspect base resource IDs' }
$decoded = [System.IO.Path]::GetFullPath((Join-Path $WorkDirectory 'decoded'))
if (Test-Path -LiteralPath $decoded) { throw 'Use a new branding work directory' }
& $java -jar $jar d -s --no-assets $apk -o $decoded
if ($LASTEXITCODE -ne 0) { throw 'Native resource decoding failed' }
& node (Join-Path $PSScriptRoot 'brand-android-resources.cjs') $decoded
if ($LASTEXITCODE -ne 0) { throw 'Native branding failed' }
# Apktool's patched aapt2 supports Android's generated $-prefixed resource names.
& $java -jar $jar b $decoded --no-apk --no-crunch
if ($LASTEXITCODE -ne 0) { throw 'Native resource compilation failed' }

$compiled = (Resolve-Path -LiteralPath (Join-Path $decoded 'build/apk')).Path
$files = @('resources.arsc', 'AndroidManifest.xml') + @(Get-ChildItem -LiteralPath (Join-Path $compiled 'res') -Recurse -File | ForEach-Object {
  $_.FullName.Substring($compiled.Length + 1).Replace('\', '/')
})
foreach ($file in $files) {
  if (!(Test-Path -LiteralPath (Join-Path $compiled $file))) { throw "Missing compiled resource $file" }
}
$zip = [System.IO.Compression.ZipFile]::Open($apk, 'Update')
try {
  # The EAS base uses shortened resource paths; the rebuilt table restores names.
  @($zip.Entries | Where-Object { $_.FullName.StartsWith('res/') }) | ForEach-Object { $_.Delete() }
  foreach ($file in $files) {
    $source = Join-Path $compiled $file
    if (!(Test-Path -LiteralPath $source)) { throw "Missing compiled resource $file" }
    $entry = $zip.GetEntry($file)
    if ($entry) { $entry.Delete() }
    $compression = if ($file -eq 'resources.arsc') { 'NoCompression' } else { 'Optimal' }
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $source, $file, $compression) | Out-Null
  }
} finally { $zip.Dispose() }
# .NET Framework's NoCompression still uses DEFLATE; Android R+ needs STORED.
$jarTool = if ($env:JAVA_HOME) { Join-Path $env:JAVA_HOME 'bin/jar.exe' } else { 'jar' }
& $jarTool --update --file $apk --no-compress -C $compiled resources.arsc
if ($LASTEXITCODE -ne 0) { throw 'Storing Android resource table failed' }
$updatedIds = Get-NativeIds $apk
$unexpectedIds = Compare-Object $originalIds $updatedIds | Where-Object {
  $_.SideIndicator -eq '<=' -or $_.InputObject -notmatch '^0x[0-9a-f]+ xml/gymbeam_coach_network_security$'
}
if ($unexpectedIds) { throw 'Existing native resource IDs changed or unexpected resources added' }
