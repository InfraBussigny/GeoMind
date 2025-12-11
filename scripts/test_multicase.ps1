# Test multi-cas pour evaluer le modele Ollama
# Teste differents types de questions

$testCases = @(
    @{id=1; question="Combien de parcelles par type a Bussigny?"; expected="parcelles privees ~1079, DP communal ~102, DP cantonal ~25"},
    @{id=2; question="Quelle est la surface totale des parcelles de Bussigny?"; expected="surface en m2 ou ha"},
    @{id=3; question="Liste les 5 plus grandes parcelles de Bussigny"; expected="liste avec numeros et surfaces"},
    @{id=4; question="Combien de batiments a Bussigny?"; expected="nombre de batiments"},
    @{id=5; question="Quelles sont les rues de Bussigny?"; expected="liste de rues"},
    @{id=6; question="Donne moi un resume des donnees de Bussigny"; expected="stats generales"},
    @{id=7; question="Quelle est la longueur totale du reseau d'assainissement?"; expected="longueur en metres"},
    @{id=8; question="Combien de chambres de visite?"; expected="nombre de chambres"}
)

$results = @()

Write-Host "=== TEST MULTI-CASES QWEN2.5:14B ===" -ForegroundColor Cyan
Write-Host "Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm')" -ForegroundColor Gray
Write-Host ""

foreach ($test in $testCases) {
    Write-Host "--- Test $($test.id): $($test.question) ---" -ForegroundColor Yellow

    $body = @{
        provider = "ollama"
        model = "qwen2.5:14b"
        messages = @(@{role = "user"; content = $test.question})
        useTools = $true
    } | ConvertTo-Json -Depth 10

    $startTime = Get-Date

    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3001/api/ai/ollama/chat" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 180
        $duration = ((Get-Date) - $startTime).TotalSeconds

        # Analyser la reponse
        $hasData = $response.content -match '\d+'
        $hasError = $response.content -match 'erreur|error|impossible'
        $isLoop = $response.content -match '(je vais|veuillez patienter).*(je vais|veuillez patienter)'

        $status = "OK"
        if ($isLoop) { $status = "BOUCLE" }
        elseif ($hasError) { $status = "ERREUR" }
        elseif (-not $hasData) { $status = "SANS_DONNEES" }

        Write-Host "  Status: $status | Duree: $([math]::Round($duration,1))s" -ForegroundColor $(if($status -eq "OK"){"Green"}else{"Red"})
        Write-Host "  Reponse: $($response.content.Substring(0, [Math]::Min(150, $response.content.Length)))..." -ForegroundColor Gray

        $results += @{
            id = $test.id
            question = $test.question
            status = $status
            duration = $duration
            hasData = $hasData
            toolCalls = $response.toolCalls.Count
            preview = $response.content.Substring(0, [Math]::Min(200, $response.content.Length))
        }
    } catch {
        Write-Host "  ERREUR: $_" -ForegroundColor Red
        $results += @{
            id = $test.id
            question = $test.question
            status = "EXCEPTION"
            error = $_.ToString()
        }
    }

    Write-Host ""
}

# Resume
Write-Host "=== RESUME ===" -ForegroundColor Cyan
$ok = ($results | Where-Object { $_.status -eq "OK" }).Count
$total = $results.Count
Write-Host "Reussite: $ok / $total ($([math]::Round($ok/$total*100))%)" -ForegroundColor $(if($ok -eq $total){"Green"}elseif($ok -gt $total/2){"Yellow"}else{"Red"})

Write-Host "`nDetails par test:" -ForegroundColor Gray
foreach ($r in $results) {
    $color = switch($r.status) { "OK" {"Green"} "BOUCLE" {"Red"} "ERREUR" {"Red"} default {"Yellow"} }
    Write-Host "  [$($r.status.PadRight(12))] Test $($r.id): $($r.question.Substring(0, [Math]::Min(40, $r.question.Length)))..." -ForegroundColor $color
}

# Retourner les resultats pour analyse
return $results
