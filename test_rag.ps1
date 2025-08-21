# RAG Endpoint Stress Test - PowerShell Edition
# Usage: .\test_rag.ps1 http://localhost:5000

param(
    [string]$BaseUrl = "http://localhost:5000"
)

$RAGBase = "$BaseUrl/rag"

Write-Host "🔥 RAG Endpoint Stress Test" -ForegroundColor Yellow
Write-Host "📡 Testing against: $RAGBase" -ForegroundColor Cyan
Write-Host "================================================"

# Test cases: Player Name -> Topic
$testCases = @{
    "Josh Downs" = "qb-change"
    "Anthony Richardson" = "qb-change"
    "Puka Nacua" = "injury"
    "Saquon Barkley" = "contract"
    "Daniel Jones" = "camp"
    "Michael Pittman" = "depth-chart"
}

function Test-Player {
    param(
        [string]$PlayerName,
        [string]$Topic
    )
    
    Write-Host "🎯 Testing: $PlayerName ($Topic)" -ForegroundColor Green
    
    try {
        # Step 1: Search for player ID
        $searchUrl = "$RAGBase/api/players/search?name=$([System.Web.HttpUtility]::UrlEncode($PlayerName))"
        $searchResult = Invoke-RestMethod -Uri $searchUrl -Method Get -ContentType "application/json" -ErrorAction Stop
        
        if (-not $searchResult -or -not $searchResult.results -or $searchResult.results.Count -eq 0) {
            Write-Host "❌ Player ID not found for: $PlayerName" -ForegroundColor Red
            return
        }
        
        $playerId = $searchResult.results[0].player_id
        Write-Host "✅ Found player_id: $playerId" -ForegroundColor Green
        
        # Step 2: Generate take
        $takeUrl = "$RAGBase/api/take?player_id=$playerId&topic=$([System.Web.HttpUtility]::UrlEncode($Topic))"
        $takeResult = Invoke-RestMethod -Uri $takeUrl -Method Get -ContentType "application/json" -ErrorAction Stop
        
        # Extract take data
        $headline = $takeResult.headline ?? "N/A"
        $verdict = $takeResult.verdict ?? "N/A"
        $confidence = $takeResult.confidence ?? "N/A"
        $citationCount = if ($takeResult.citations) { $takeResult.citations.Count } else { 0 }
        
        Write-Host "📰 Headline: $headline" -ForegroundColor White
        Write-Host "⚖️  Verdict: $verdict" -ForegroundColor White
        Write-Host "🎯 Confidence: $confidence" -ForegroundColor White
        Write-Host "📚 Citations: $citationCount" -ForegroundColor White
        Write-Host
    }
    catch {
        Write-Host "❌ Error testing $PlayerName`: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host
    }
}

# Run all test cases
foreach ($player in $testCases.Keys) {
    Test-Player -PlayerName $player -Topic $testCases[$player]
    Start-Sleep -Milliseconds 500  # Brief pause between requests
}

Write-Host "================================================"
Write-Host "✅ RAG stress test complete!" -ForegroundColor Green