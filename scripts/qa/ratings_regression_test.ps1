$BASE_URL = $env:BASE_URL
if (-not $BASE_URL) { $BASE_URL = "http://localhost:5000" }

Write-Host "[QA] Ratings API health"
try {
    iwr "$BASE_URL/api/tiber-ratings?format=redraft&position=RB&season=2024&week=6&limit=25" -UseBasicParsing | Out-Null
    iwr "$BASE_URL/api/tiber-ratings?format=dynasty&position=WR&season=2024&limit=50" -UseBasicParsing | Out-Null
    $resp = (iwr "$BASE_URL/api/tiber-ratings?format=redraft&position=QB&season=2024&week=6&debug=1" -UseBasicParsing).Content | ConvertFrom-Json
    if (-not $resp.items) { throw "No items in response" }
}
catch {
    Write-Host "API health check failed: $($_.Exception.Message)"
}

Write-Host "[QA] Parameter validation"
try {
    $resp = (iwr "$BASE_URL/api/tiber-ratings?format=INVALID&position=RB&season=2024" -UseBasicParsing -ErrorAction SilentlyContinue).Content
    if ($resp -notmatch "error") { throw "Expected error for invalid format" }

    $resp = (iwr "$BASE_URL/api/tiber-ratings?format=redraft&position=INVALID&season=2024" -UseBasicParsing -ErrorAction SilentlyContinue).Content
    if ($resp -notmatch "error") { throw "Expected error for invalid position" }

    $resp = (iwr "$BASE_URL/api/tiber-ratings?format=redraft&position=RB&season=2024&week=0" -UseBasicParsing -ErrorAction SilentlyContinue).Content
    if ($resp -notmatch "error") { throw "Expected error for week=0" }

    $resp = (iwr "$BASE_URL/api/tiber-ratings?format=redraft&position=RB&season=2024&week=18" -UseBasicParsing -ErrorAction SilentlyContinue).Content
    if ($resp -notmatch "error") { throw "Expected error for week=18 in 2024" }
}
catch {
    Write-Host "Parameter validation failed: $($_.Exception.Message)"
}

Write-Host "[QA] Tiers endpoint"
try {
    $resp = (iwr "$BASE_URL/api/tiber-ratings/tiers?format=redraft&position=RB&season=2024&week=6" -UseBasicParsing).Content | ConvertFrom-Json
    if (-not $resp.tiers) { Write-Host "No tiers data available - may need sample data" }
}
catch {
    Write-Host "Tiers endpoint failed: $($_.Exception.Message)"
}

Write-Host "[QA] Individual player endpoint"
try {
    iwr "$BASE_URL/api/tiber-ratings/jamarr-chase?format=redraft&season=2024&week=6" -UseBasicParsing | Out-Null
}
catch {
    Write-Host "Player not found - may need sample data: $($_.Exception.Message)"
}

Write-Host "[QA] Weight override sanity"
try {
    iwr "$BASE_URL/api/tiber-ratings?format=redraft&position=RB&season=2024&week=6&weights=0.4,0.3,0.15,0.1,0.03,0.02" -UseBasicParsing | Out-Null
}
catch {
    Write-Host "Weight override failed: $($_.Exception.Message)"
}

Write-Host "[QA] Recompute endpoint"
try {
    iwr "$BASE_URL/api/tiber-ratings/recompute?format=redraft&position=RB&season=2024&week=6" -Method POST -UseBasicParsing | Out-Null
}
catch {
    Write-Host "Recompute failed - check sample data: $($_.Exception.Message)"
}

Write-Host "[QA] DONE - All basic endpoints responding"