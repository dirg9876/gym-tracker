param([int[]]$Ids = @(1, 30, 80), [string]$OutputName = 'review-anchors.png', [switch]$Light)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$staging = Join-Path $root 'artifacts/apk/verified/level-art-male-v4'
$catalog = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'catalog-male-v4.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$columns = 3
$cellWidth = 360
$cellHeight = 330
$rows = [int][Math]::Ceiling($Ids.Count / $columns)
$sheet = New-Object System.Drawing.Bitmap ($columns * $cellWidth), ($rows * $cellHeight)
$graphics = [System.Drawing.Graphics]::FromImage($sheet)
$font = New-Object System.Drawing.Font 'Arial', 11
$small = New-Object System.Drawing.Font 'Arial', 9
$foreground = if ($Light) { [System.Drawing.Color]::FromArgb(24, 26, 29) } else { [System.Drawing.Color]::FromArgb(232, 236, 240) }
$background = if ($Light) { [System.Drawing.Color]::FromArgb(232, 236, 240) } else { [System.Drawing.Color]::FromArgb(24, 26, 29) }
$text = New-Object System.Drawing.SolidBrush $foreground
try {
  $graphics.Clear($background)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  for ($index = 0; $index -lt $Ids.Count; $index++) {
    $id = $Ids[$index]
    $x = ($index % $columns) * $cellWidth
    $y = [int][Math]::Floor($index / $columns) * $cellHeight
    $image = [System.Drawing.Image]::FromFile((Join-Path $staging ('level-' + $id + '.png')))
    try {
      foreach ($sample in @(@{ X = 10; Y = 15; Size = 210 }, @{ X = 235; Y = 20; Size = 100 }, @{ X = 258; Y = 155; Size = 48 })) {
        $inset = [int][Math]::Round($sample.Size * 0.06)
        $size = $sample.Size - 2 * $inset
        $graphics.DrawImage($image, ($x + $sample.X + $inset), ($y + $sample.Y + $inset), $size, $size)
        $graphics.DrawString(($sample.Size.ToString() + 'px / inset6%'), $small, $text, ($x + $sample.X), ($y + $sample.Y + $sample.Size + 2))
      }
      $level = $catalog.levels[$id]
      $graphics.DrawString(($id.ToString() + '  ' + $level.name), $font, $text, ($x + 10), ($y + 250))
      $rect = New-Object System.Drawing.RectangleF ($x + 10), ($y + 277), 335, 44
      $graphics.DrawString($level.caption, $small, $text, $rect)
    } finally { $image.Dispose() }
  }
  $sheet.Save((Join-Path $staging $OutputName), [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $graphics.Dispose(); $sheet.Dispose(); $font.Dispose(); $small.Dispose(); $text.Dispose()
}
Write-Output (Join-Path $staging $OutputName)
