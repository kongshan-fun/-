Add-Type -AssemblyName System.Drawing

function Compose-Compare {
  param(
    [string]$Before, [string]$After, [string]$OutPath,
    [string]$Title, [string]$BeforeLabel, [string]$AfterLabel, [string]$Note
  )
  $b = [System.Drawing.Image]::FromFile($Before)
  $a = [System.Drawing.Image]::FromFile($After)
  $w = [Math]::Max($b.Width, $a.Width)
  $h = [Math]::Max($b.Height, $a.Height)
  $head = 128
  $gap = 24
  $pad = 20
  $canvasW = $pad * 2 + $w * 2 + $gap
  $canvasH = $head + $h + $pad * 2
  $bmp = New-Object System.Drawing.Bitmap($canvasW, $canvasH)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.TextRenderingHint = 'ClearTypeGridFit'
  $g.Clear([System.Drawing.Color]::FromArgb(246, 246, 244))

  $fTitle = New-Object System.Drawing.Font("Microsoft YaHei", 20, [System.Drawing.FontStyle]::Bold)
  $fSub = New-Object System.Drawing.Font("Microsoft YaHei", 12)
  $fLbl = New-Object System.Drawing.Font("Microsoft YaHei", 15, [System.Drawing.FontStyle]::Bold)
  $brInk = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(30, 30, 30))
  $brMuted = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(110, 110, 110))

  $g.DrawString($Title, $fTitle, $brInk, $pad, 14)
  if ($Note) { $g.DrawString($Note, $fSub, $brMuted, $pad, 56) }

  $x1 = $pad
  $x2 = $pad + $w + $gap
  $y = $head

  $g.DrawString($BeforeLabel, $fLbl, $brMuted, $x1, $y - 30)
  $g.DrawString($AfterLabel, $fLbl, $brInk, $x2, $y - 34)

  $penB = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(200, 200, 200), 2)
  $penA = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(40, 40, 40), 2)
  $g.DrawImage($b, $x1, $y, $b.Width, $b.Height)
  $g.DrawImage($a, $x2, $y, $a.Width, $a.Height)
  $g.DrawRectangle($penB, $x1, $y, $b.Width, $b.Height)
  $g.DrawRectangle($penA, $x2, $y, $a.Width, $a.Height)

  $g.Dispose()
  $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose(); $b.Dispose(); $a.Dispose()
  Write-Output ("wrote " + $OutPath)
}

$dir = "D:\deepseek harness\shanhe-repo"
$out = Join-Path $dir "visual\v910-compare"
New-Item -ItemType Directory -Force -Path $out | Out-Null

$pairs = @(
  @{ n='book';  t='图鉴 · 分类折叠与成就折叠';      note='内容高 14,456px (25.77 屏) → 606px (1.08 屏)' },
  @{ n='craft'; t='炼制 · 可制优先与采集指路';      note='新增汇总条、可炼制置顶、缺料标注采集地点（高度略增，见报告）' },
  @{ n='pack';  t='背包 · 储物袋折叠与行密度';      note='储物袋收进折叠区，物品按类型排序，补禁用原因' }
)

foreach ($p in $pairs) {
  $b = Join-Path $dir ("visual\v909-audit\panel-" + $p.n + ".png")
  $a = Join-Path $dir ("visual\v910-audit\panel-" + $p.n + ".png")
  if ((Test-Path $b) -and (Test-Path $a)) {
    Compose-Compare -Before $b -After $a -OutPath (Join-Path $out ("compare-" + $p.n + ".png")) `
      -Title $p.t -BeforeLabel "改前 V90.9" -AfterLabel "改后 V90.10" -Note $p.note
  } else {
    Write-Output ("缺少素材: " + $p.n)
  }
}

Get-ChildItem $out -Filter *.png | ForEach-Object { "{0,-24} {1,10:N0} B" -f $_.Name, $_.Length }
