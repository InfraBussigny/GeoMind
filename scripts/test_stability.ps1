# Test de stabilite - questions variees
# 3 iterations pour verifier qu'il n'y a plus de corrections necessaires

$testCases = @(
    # Variantes parcelles
    @{question="Y a-t-il des parcelles privees a Bussigny?"},
    @{question="Combien de DP cantonal?"},
    # Variantes batiments
    @{question="Nombre de constructions a Bussigny"},
    @{question="Les batiments de Bussigny"},
    # Variantes assainissement
    @{question="Longueur des canalisations"},
    @{question="Combien de regards d'egout?"},
    # Questions ouvertes
    @{question="Donne moi les stats de Bussigny"},
    @{question="Quelles donnees as-tu sur Bussigny?"},
    # Edge cases
    @{question="Surface parcelles"},
    @{question="Liste des chemins"}
)

Write-Host "=== TEST STABILITE QWEN2.5:14B ===" -ForegroundColor Cyan
Write-Host "Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm')" -ForegroundColor Gray
Write-Host "10 questions variees" -ForegroundColor Gray
Write-Host ""

$success = 0
$fail = 0

foreach ($test in $testCases) {
    Write-Host "Q: $($test.question)" -ForegroundColor Yellow -NoNewline

    $body = @{
        provider = "ollama"
        model = "qwen2.5:14b"
        messages = @(@{role = "user"; content = $test.question})
        useTools = $true
    } | ConvertTo-Json -Depth 10

    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3001/api/ai/ollama/chat" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 180

        $hasData = $response.content -match '\d+'
        $hasError = $response.content -match 'erreur|error|impossible|pas acc[eè]s'
        $isLoop = $response.content -match '(je vais|veuillez patienter).{0,50}(je vais|veuillez patienter)'

        if ($isLoop -or $hasError -or -not $hasData) {
            Write-Host " [FAIL]" -ForegroundColor Red
            $fail++
        } else {
            Write-Host " [OK]" -ForegroundColor Green
            $success++
        }
    } catch {
        Write-Host " [EXCEPTION]" -ForegroundColor Red
        $fail++
    }
}

Write-Host ""
Write-Host "=== RESULTAT ===" -ForegroundColor Cyan
Write-Host "Reussite: $success / $($testCases.Count) ($([math]::Round($success/$testCases.Count*100))%)" -ForegroundColor $(if($fail -eq 0){"Green"}else{"Yellow"})

if ($fail -eq 0) {
    Write-Host "STABILITE VALIDEE - Pas de corrections necessaires" -ForegroundColor Green
} else {
    Write-Host "CORRECTIONS NECESSAIRES - $fail echecs" -ForegroundColor Red
}
