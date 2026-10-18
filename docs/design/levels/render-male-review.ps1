param([string]$OutputName = 'review-current.png', [int]$FromLevel = 0, [int]$ToLevel = 80)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$staging = Join-Path $root 'artifacts/apk/verified/level-art-male-v3'
$catalog = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'catalog-male-v3.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$ready = @($catalog.levels | Where-Object { $_.id -ge $FromLevel -and $_.id -le $ToLevel -and (Test-Path -LiteralPath (Join-Path $staging ('level-' + $_.id + '.png'))) })
if ($ready.Count -eq 0) { throw 'No images generated yet' }
$columns = 3
$cellWidth = 360
$cellHeight = 335
$rows = [int][Math]::Ceiling($ready.Count / $columns)
$sheet = New-Object System.Drawing.Bitmap ($columns * $cellWidth), ($rows * $cellHeight)
$g = [System.Drawing.Graphics]::FromImage($sheet)
$g.Clear([System.Drawing.Color]::FromArgb(18, 20, 23))
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
$font = New-Object System.Drawing.Font 'Arial', 12
$small = New-Object System.Drawing.Font 'Arial', 9
$brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(233, 237, 240))
try {
  for ($index = 0; $index -lt $ready.Count; $index++) {
    $level = $ready[$index]
    $x = ($index % $columns) * $cellWidth
    $y = [int][Math]::Floor($index / $columns) * $cellHeight
    $image = [System.Drawing.Image]::FromFile((Join-Path $staging ('level-' + $level.id + '.png')))
    try {
      $g.DrawImage($image, ($x + 15), ($y + 20), 200, 200)
      $g.DrawImage($image, ($x + 235), ($y + 35), 100, 100)
      $g.DrawImage($image, ($x + 258), ($y + 165), 48, 48)
      $g.DrawString('100 x 100', $small, $brush, ($x + 250), ($y + 140))
      $g.DrawString('48 x 48', $small, $brush, ($x + 257), ($y + 218))
      $g.DrawString(($level.id.ToString() + '  ' + $level.name), $font, $brush, ($x + 15), ($y + 250))
      $rect = New-Object System.Drawing.RectangleF ($x + 15), ($y + 278), ($cellWidth - 25), 52
      $g.DrawString($level.caption, $small, $brush, $rect)
    } finally { $image.Dispose() }
  }
  $sheet.Save((Join-Path $staging $OutputName), [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $g.Dispose()
  $sheet.Dispose()
  $font.Dispose()
  $small.Dispose()
  $brush.Dispose()
}
Write-Output (Join-Path $staging $OutputName)
