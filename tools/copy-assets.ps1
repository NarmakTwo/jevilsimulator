# Copy sprites, fonts, SFX, and joker.ogg from the decompile into src/assets.
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$proj = Join-Path $root "othershit\Exported_Project"
$outSpr = Join-Path $root "src\assets\sprites"
$outSnd = Join-Path $root "src\assets\sounds"
$outFnt = Join-Path $root "src\assets\fonts"
$outMus = Join-Path $root "src\assets\mus"
New-Item -ItemType Directory -Force -Path $outSpr, $outSnd, $outFnt, $outMus | Out-Null

$sprites = @(
  "spr_dodgeheart", "spr_heart", "spr_battlebg_0",
  "spr_spadebullet", "spr_diamondbullet", "spr_clubsbullet", "spr_heartbullet",
  "spr_clubsball_a", "spr_clubsball_b", "spr_clubsball_c", "spr_diamondbullet_vert",
  "spr_bomb_spade", "spr_bomb_diamond", "spr_bomb_heart", "spr_bomb_club",
  "spr_carousel", "spr_carouselbg",
  "spr_joker_scythebody", "spr_jokerscythe_big",
  "spr_joker_teleport", "spr_joker_teleport_r",
  "spr_joker_main", "spr_joker_tired", "spr_joker_dance", "spr_joker_dance_reverse",
  "spr_jokerbody", "spr_jokerhead", "spr_jokerchain", "spr_tallpx",
  "spr_krisb_idle", "spr_krisb_hurt", "spr_krisb_defeat",
  "spr_susieb_idle", "spr_susieb_hurt", "spr_susieb_defeat",
  "spr_ralseib_idle", "spr_ralseib_hurt", "spr_ralseib_defeat",
  "spr_headkris", "spr_headsusie", "spr_headralsei",
  "spr_bnamekris", "spr_bnamesusie", "spr_bnameralsei",
  "spr_hpname", "spr_hpslash",
  "spr_btfight", "spr_btact", "spr_btitem", "spr_btspare", "spr_btdefend", "spr_bttech",
  "spr_tensionbar", "spr_tensionmarker", "spr_tplogo",
  "spr_numbersfontsmall",
  "spr_pressfront", "spr_pressfront_b", "spr_pressspot", "spr_attackspot",
  "spr_numbersfontbig", "spr_battlemsg", "spr_attack_cut1"
)

$manifest = @{}
foreach ($s in $sprites) {
  $dir = Join-Path $proj "sprites\$s"
  if (-not (Test-Path $dir)) { Write-Host "sprite $s MISSING" -ForegroundColor Yellow; continue }
  $yy = Get-Content (Join-Path $dir "$s.yy") -Raw | ConvertFrom-Json
  $i = 0
  foreach ($f in $yy.frames) {
    $src = Join-Path $dir "$($f.name).png"
    Copy-Item $src (Join-Path $outSpr ("{0}_{1}.png" -f $s, $i)) -Force
    $i++
  }
  $manifest[$s] = @{
    frames = $i
    w = $yy.width; h = $yy.height
    ox = $yy.sequence.xorigin; oy = $yy.sequence.yorigin
    bbl = $yy.bbox_left; bbr = $yy.bbox_right; bbt = $yy.bbox_top; bbb = $yy.bbox_bottom
  }
  Write-Host "sprite $s ($i frames)"
}

function Copy-Sound($name) {
  $candidates = @(
    (Join-Path $proj "sounds\$name\$name"),
    (Join-Path $root "othershit\rory\assets\audio\$name.wav"),
    (Join-Path $root "othershit\rory\assets\audio\$name.ogg")
  )
  foreach ($c in $candidates) {
    if (Test-Path $c) {
      $bytes = [System.IO.File]::ReadAllBytes((Resolve-Path $c).Path)
      $ext = if ($bytes.Length -ge 4 -and [System.Text.Encoding]::ASCII.GetString($bytes[0..3]) -eq "OggS") { ".ogg" } else { ".wav" }
      Copy-Item $c (Join-Path $outSnd "$name$ext") -Force
      return "$name$ext"
    }
  }
  return $null
}

$sounds = @(
  "snd_swing", "snd_spearappear", "snd_scytheburst", "snd_hurt1", "snd_graze",
  "snd_rumble", "snd_bombfall", "snd_bomb", "snd_weirdeffect", "snd_boost",
  "snd_applause", "snd_awkward", "snd_badexplosion", "snd_carhonk", "snd_toilet",
  "snd_birdtweet", "snd_shadowpendant", "snd_pirouette", "snd_hypnosis",
  "snd_joker_chaos", "snd_joker_anything", "snd_joker_oh", "snd_joker_byebye",
  "snd_joker_neochaos", "snd_joker_laugh0", "snd_joker_laugh1",
  "snd_joker_ha0", "snd_joker_ha1", "snd_joker_metamorphosis",
  "snd_select", "snd_menumove", "snd_smallswing", "snd_heavyswing", "snd_criticalswing"
)
$soundList = @()
foreach ($s in $sounds) {
  $copied = Copy-Sound $s
  if ($copied) { $soundList += $copied; Write-Host "sound  $copied" }
  else { Write-Host "sound  $s MISSING" -ForegroundColor Yellow }
}
$manifest["__sounds"] = $soundList

# Music is streamed from mus/, not baked into data.win (snd_init).
$joker = Join-Path $root "othershit\joker.ogg"
if (Test-Path $joker) {
  Copy-Item $joker (Join-Path $outMus "joker.ogg") -Force
  Write-Host "music  joker.ogg"
}

function Export-Font($name) {
  $dir = Join-Path $proj "fonts\$name"
  $png = Join-Path $dir "$name.png"
  $yyPath = Join-Path $dir "$name.yy"
  if (-not (Test-Path $png)) { Write-Host "font $name MISSING" -ForegroundColor Yellow; return }
  Copy-Item $png (Join-Path $outFnt "$name.png") -Force
  $yy = Get-Content $yyPath -Raw | ConvertFrom-Json
  $glyphs = @()
  foreach ($prop in $yy.glyphs.PSObject.Properties) {
    $g = $prop.Value
    $glyphs += @{
      c = [int]$g.character
      x = [int]$g.x; y = [int]$g.y; w = [int]$g.w; h = [int]$g.h
      shift = [int]$g.shift; offset = [int]$g.offset
    }
  }
  $json = @{
    name = $name
    size = $yy.size
    lineHeight = if ($yy.lineHeight) { $yy.lineHeight } else { 0 }
    glyphs = $glyphs
  } | ConvertTo-Json -Depth 4 -Compress
  [System.IO.File]::WriteAllText((Join-Path $outFnt "$name.json"), $json)
  Write-Host "font   $name ($($glyphs.Count) glyphs)"
}
Export-Font "fnt_main"
Export-Font "fnt_mainbig"

$manifest | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $root "src\assets\manifest.json") -Encoding UTF8
Write-Host "manifest written"
