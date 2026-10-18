param([string]$InputName = 'rocky-style-selected.png', [string]$OutputName = 'rocky-selected-preview.png')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$image = [System.Drawing.Image]::FromFile((Join-Path $PSScriptRoot $InputName))
$sheet = New-Object System.Drawing.Bitmap 800, 430
$graphics = [System.Drawing.Graphics]::FromImage($sheet)
$font = New-Object System.Drawing.Font 'Arial', 10
$lightText = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$darkText = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::Black)
$lightBackground = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(232, 235, 238))
try {
  $graphics.Clear([System.Drawing.Color]::FromArgb(24, 26, 29))
  $graphics.FillRectangle($lightBackground, 400, 0, 400, 430)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  foreach ($offset in @(0, 400)) {
    $brush = if ($offset -eq 0) { $lightText } else { $darkText }
    $graphics.DrawString('Rocky v4 / diagnostic only / contain', $font, $brush, ($offset + 15), 12)
    foreach ($sample in @(@{ X = 15; Y = 65; Size = 250 }, @{ X = 270; Y = 65; Size = 100 }, @{ X = 295; Y = 230; Size = 48 })) {
      $scale = [Math]::Min($sample.Size / $image.Width, $sample.Size / $image.Height)
      $width = [int][Math]::Round($image.Width * $scale)
      $height = [int][Math]::Round($image.Height * $scale)
      $x = $offset + $sample.X + [int][Math]::Floor(($sample.Size - $width) / 2)
      $y = $sample.Y + [int][Math]::Floor(($sample.Size - $height) / 2)
      $graphics.DrawImage($image, $x, $y, $width, $height)
      $graphics.DrawString(($sample.Size.ToString() + ' x ' + $sample.Size.ToString()), $font, $brush, ($offset + $sample.X), ($sample.Y + $sample.Size + 10))
    }
    $graphics.DrawString('Source unchanged; no palette/grid correction', $font, $brush, ($offset + 15), 390)
  }
  $sheet.Save((Join-Path $PSScriptRoot $OutputName), [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $image.Dispose()
  $graphics.Dispose()
  $sheet.Dispose()
  $font.Dispose()
  $lightText.Dispose()
  $darkText.Dispose()
  $lightBackground.Dispose()
}
Write-Output (Join-Path $PSScriptRoot $OutputName)
