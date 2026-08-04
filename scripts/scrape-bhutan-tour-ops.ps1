# Scrape all certified tour operators from services.bhutan.travel
# The portal random-orders results, so single-pass pagination misses IDs —
# we re-sample pages until we reach the advertised total (or stall).
$ErrorActionPreference = 'Stop'
$Base = 'https://services.bhutan.travel/search/tour-operator'
$OutDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'docs\exports'
$Ua = 'PelbuSuites-research/1.0 (+hotel partner research; respectful crawl)'
$MaxRounds = 12
$StallRounds = 3

function Get-InertiaProps {
  param([string]$Url)
  $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -Headers @{
    'User-Agent' = $Ua
    'Accept'     = 'text/html'
  }
  if ($resp.Content -notmatch 'data-page="([^"]+)"') {
    throw "No Inertia data-page on $Url"
  }
  $json = [System.Net.WebUtility]::HtmlDecode($Matches[1])
  return ($json | ConvertFrom-Json)
}

function Get-Results {
  param($Props)
  if ($Props.PSObject.Properties.Name -contains 'results') { return $Props.results }
  foreach ($p in $Props.PSObject.Properties) {
    $v = $p.Value
    if ($null -eq $v) { continue }
    if ($v.PSObject.Properties.Name -contains 'data' -and $null -ne $v.data) { return $v }
  }
  throw 'results not found'
}

function Format-Phone([string]$phone) {
  if (-not $phone) { return '' }
  $phone = $phone.Trim()
  if ($phone -match '^\+') { return $phone }
  if ($phone -match '^\d{7,12}$') { return "+975 $phone" }
  return $phone
}

function Normalize-Row($item) {
  $id = if ($null -ne $item.id) { [string]$item.id } else { '' }
  $name = if ($item.name) { [string]$item.name } else { '' }
  $email = if ($item.email) { [string]$item.email } else { '' }
  $phone = Format-Phone ($(if ($null -ne $item.contact) { [string]$item.contact } elseif ($item.phone) { [string]$item.phone } else { '' }))
  $website = if ($item.website) { [string]$item.website } else { '' }
  $slug = if ($item.slug) { [string]$item.slug } else { '' }
  $source = if ($slug) { "https://services.bhutan.travel/search/tour-operator/$slug" } else { '' }

  [pscustomobject]@{
    id         = $id
    name       = $name.Trim()
    phone      = $phone
    email      = $email.Trim()
    website    = $website.Trim()
    slug       = $slug.Trim()
    source_url = $source
  }
}

Write-Host 'Bootstrap page 1...'
$first = Get-InertiaProps -Url $Base
$paginator = Get-Results -Props $first.props
$targetTotal = [int]$paginator.total
$lastPage = [int]$paginator.last_page
if ($lastPage -lt 1) { $lastPage = 1 }
Write-Host "Target total=$targetTotal last_page=$lastPage per_page=$($paginator.per_page)"

$byId = @{}
$noGain = 0

function Ingest-PageItems($items) {
  $added = 0
  foreach ($item in @($items)) {
    if ($null -eq $item) { continue }
    $row = Normalize-Row $item
    if (-not $row.id) { continue }
    if ($byId.ContainsKey($row.id)) { continue }
    $byId[$row.id] = $row
    $added++
  }
  return $added
}

# Seed from first page + alphabet / common substring filters (smaller sets, better coverage)
$querySets = @('')
# two-letter prefixes help when letter 'a' still has 700+ results
$letters = 97..122 | ForEach-Object { [char]$_ }
foreach ($a in $letters) { $querySets += "$a" }
foreach ($a in @('a','b','c','d','s','t','p','m','n','r')) {
  foreach ($b in $letters) { $querySets += "$a$b" }
}

Write-Host "Phase 1: company_name filters ($($querySets.Count) queries)..."
$qi = 0
foreach ($q in $querySets) {
  $qi++
  if ($byId.Count -ge $targetTotal) { break }
  $url = if ($q) { "$Base`?company_name=$([uri]::EscapeDataString($q))" } else { $Base }
  try {
    if ($qi -gt 1) { Start-Sleep -Milliseconds 350 }
    $data = Get-InertiaProps -Url $url
    $res = Get-Results -Props $data.props
    $lp = [int]$res.last_page
    if ($lp -lt 1) { $lp = 1 }
    # crawl every page of this filter (still random, but smaller universe when q is specific)
    for ($page = 1; $page -le $lp; $page++) {
      if ($page -eq 1) {
        $items = $res.data
      } else {
        Start-Sleep -Milliseconds 300
        $pageUrl = if ($q) {
          "$Base`?company_name=$([uri]::EscapeDataString($q))&page=$page"
        } else {
          "$Base`?page=$page"
        }
        $items = (Get-Results -Props (Get-InertiaProps -Url $pageUrl).props).data
      }
      $null = Ingest-PageItems $items
    }
  } catch {
    Write-Host "  warn: query '$q' failed: $_"
  }
  if ($qi % 25 -eq 0 -or $qi -eq $querySets.Count) {
    Write-Host "  queries $qi/$($querySets.Count) unique=$($byId.Count)/$targetTotal"
  }
}

Write-Host "Phase 2: multi-round full index scrape (random order)..."
for ($round = 1; $round -le $MaxRounds; $round++) {
  if ($byId.Count -ge $targetTotal) { break }
  $before = $byId.Count
  for ($page = 1; $page -le $lastPage; $page++) {
    Start-Sleep -Milliseconds 350
    $url = if ($page -eq 1) { $Base } else { "$Base`?page=$page" }
    try {
      $items = (Get-Results -Props (Get-InertiaProps -Url $url).props).data
      $null = Ingest-PageItems $items
    } catch {
      Write-Host "  warn page $page round $round : $_"
    }
  }
  $gain = $byId.Count - $before
  Write-Host "  round $round : unique=$($byId.Count)/$targetTotal (+$gain)"
  if ($gain -eq 0) {
    $noGain++
    if ($noGain -ge $StallRounds) {
      Write-Host '  stalled — stopping resampling'
      break
    }
  } else {
    $noGain = 0
  }
}

# Language dimensions as extra buckets
Write-Host 'Phase 3: language buckets...'
$langs = @(21, 22, 28, 25, 23, 30, 31, 27, 24, 26, 29, 33, 34, 32, 35)
foreach ($lang in $langs) {
  if ($byId.Count -ge $targetTotal) { break }
  Start-Sleep -Milliseconds 350
  try {
    $url = "$Base`?languages[]=$lang"
    $res = Get-Results -Props (Get-InertiaProps -Url $url).props
    $lp = [int]$res.last_page
    if ($lp -lt 1) { $lp = 1 }
    for ($page = 1; $page -le $lp; $page++) {
      if ($page -eq 1) { $items = $res.data }
      else {
        Start-Sleep -Milliseconds 300
        $items = (Get-Results -Props (Get-InertiaProps -Url "$url&page=$page").props).data
      }
      $null = Ingest-PageItems $items
    }
    Write-Host "  language $lang unique=$($byId.Count)/$targetTotal"
  } catch {
    Write-Host "  warn language $lang : $_"
  }
}

$rows = @($byId.Values | Sort-Object name)
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$csvFull = Join-Path $OutDir 'bhutan-tour-operators.csv'
$csvSlim = Join-Path $OutDir 'bhutan-tour-operators-contacts.csv'

$rows | Select-Object id, name, phone, email, website, slug, source_url |
  Export-Csv -Path $csvFull -NoTypeInformation -Encoding UTF8
$rows | Select-Object name, phone, email |
  Export-Csv -Path $csvSlim -NoTypeInformation -Encoding UTF8

$missEmail = @($rows | Where-Object { -not $_.email }).Count
$missPhone = @($rows | Where-Object { -not $_.phone }).Count

Write-Host ''
Write-Host "Done. Collected $($rows.Count) of ~$targetTotal operators"
Write-Host "  $csvFull"
Write-Host "  $csvSlim"
Write-Host "Missing email: $missEmail | Missing phone: $missPhone"
if ($rows.Count -lt $targetTotal) {
  Write-Host "NOTE: portal random-orders listings; $($targetTotal - $rows.Count) may still be unsampled. Re-run script to close the gap."
}
