# Test etendu - couverture maximale des use-cases
# 40 questions couvrant tous les types de requetes possibles

$testCases = @(
    # === PARCELLES (10 cas) ===
    @{id=1;  cat="PARCELLE"; q="Combien de parcelles a Bussigny?"},
    @{id=2;  cat="PARCELLE"; q="Nombre de parcelles privees"},
    @{id=3;  cat="PARCELLE"; q="Combien de DP communal?"},
    @{id=4;  cat="PARCELLE"; q="Y a-t-il des parcelles DP cantonal?"},
    @{id=5;  cat="PARCELLE"; q="Surface totale des parcelles"},
    @{id=6;  cat="PARCELLE"; q="Quelle est la superficie des terrains a Bussigny?"},
    @{id=7;  cat="PARCELLE"; q="Liste les plus grandes parcelles"},
    @{id=8;  cat="PARCELLE"; q="Parcelles par type"},
    @{id=9;  cat="PARCELLE"; q="Statistiques parcellaires"},
    @{id=10; cat="PARCELLE"; q="Donne moi les biens-fonds de Bussigny"},

    # === BATIMENTS (8 cas) ===
    @{id=11; cat="BATIMENT"; q="Combien de batiments a Bussigny?"},
    @{id=12; cat="BATIMENT"; q="Nombre de constructions"},
    @{id=13; cat="BATIMENT"; q="Combien d'immeubles?"},
    @{id=14; cat="BATIMENT"; q="Surface des batiments"},
    @{id=15; cat="BATIMENT"; q="Liste des maisons"},
    @{id=16; cat="BATIMENT"; q="Y a-t-il des buildings a Bussigny?"},
    @{id=17; cat="BATIMENT"; q="Batiments par genre"},
    @{id=18; cat="BATIMENT"; q="Nombre total de constructions a Bussigny"},

    # === ADRESSES/RUES (6 cas) ===
    @{id=19; cat="ADRESSE"; q="Quelles sont les rues de Bussigny?"},
    @{id=20; cat="ADRESSE"; q="Liste des chemins"},
    @{id=21; cat="ADRESSE"; q="Combien d'adresses?"},
    @{id=22; cat="ADRESSE"; q="Nombre de rues a Bussigny"},
    @{id=23; cat="ADRESSE"; q="Les avenues de Bussigny"},
    @{id=24; cat="ADRESSE"; q="Donne moi les noms de rue"},

    # === ASSAINISSEMENT (8 cas) ===
    @{id=25; cat="ASSAINI"; q="Longueur du reseau d'assainissement"},
    @{id=26; cat="ASSAINI"; q="Combien de collecteurs?"},
    @{id=27; cat="ASSAINI"; q="Longueur des canalisations"},
    @{id=28; cat="ASSAINI"; q="Combien de chambres de visite?"},
    @{id=29; cat="ASSAINI"; q="Nombre de regards"},
    @{id=30; cat="ASSAINI"; q="Longueur totale des egouts"},
    @{id=31; cat="ASSAINI"; q="Stats reseau eaux usees"},
    @{id=32; cat="ASSAINI"; q="Combien de metres de conduites?"},

    # === GENERAL/STATS (6 cas) ===
    @{id=33; cat="GENERAL"; q="Resume des donnees de Bussigny"},
    @{id=34; cat="GENERAL"; q="Donne moi les stats"},
    @{id=35; cat="GENERAL"; q="Vue d'ensemble des donnees"},
    @{id=36; cat="GENERAL"; q="Quelles donnees as-tu sur Bussigny?"},
    @{id=37; cat="GENERAL"; q="Informations generales"},
    @{id=38; cat="GENERAL"; q="Overview de la commune"},

    # === EDGE CASES (6 cas) ===
    @{id=39; cat="EDGE"; q="parcelles"},
    @{id=40; cat="EDGE"; q="surface"},
    @{id=41; cat="EDGE"; q="Combien?"},
    @{id=42; cat="EDGE"; q="batiment bussigny"},
    @{id=43; cat="EDGE"; q="donnees"},
    @{id=44; cat="EDGE"; q="Tout sur les parcelles de la commune"},

    # === HYDRANTS (4 cas) ===
    @{id=45; cat="HYDRANT"; q="Combien d'hydrants a Bussigny?"},
    @{id=46; cat="HYDRANT"; q="Nombre de bornes hydrantes"},
    @{id=47; cat="HYDRANT"; q="Y a-t-il des bouches incendie?"},
    @{id=48; cat="HYDRANT"; q="Liste des hydrants"},

    # === ROUTES (4 cas) ===
    @{id=49; cat="ROUTE"; q="Longueur des routes"},
    @{id=50; cat="ROUTE"; q="Combien de troncons de route?"},
    @{id=51; cat="ROUTE"; q="Longueur totale de voirie"},
    @{id=52; cat="ROUTE"; q="Kilometres de routes a Bussigny"},

    # === FORMULATIONS NATURELLES (8 cas) ===
    @{id=53; cat="NATUREL"; q="C'est quoi la surface de Bussigny?"},
    @{id=54; cat="NATUREL"; q="Tu peux me dire combien de parcelles?"},
    @{id=55; cat="NATUREL"; q="J'aimerais savoir le nombre de batiments"},
    @{id=56; cat="NATUREL"; q="Est-ce que tu as des infos sur les rues?"},
    @{id=57; cat="NATUREL"; q="Dis moi tout sur l'assainissement"},
    @{id=58; cat="NATUREL"; q="Parle moi des parcelles de Bussigny"},
    @{id=59; cat="NATUREL"; q="Qu'est-ce que tu sais sur les terrains?"},
    @{id=60; cat="NATUREL"; q="Raconte moi les donnees de la commune"}
)

Write-Host "=== TEST ETENDU SQL ASSISTANT ===" -ForegroundColor Cyan
Write-Host "Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm')" -ForegroundColor Gray
Write-Host "$($testCases.Count) questions a tester" -ForegroundColor Gray
Write-Host ""

$results = @{}
$categories = @("PARCELLE", "BATIMENT", "ADRESSE", "ASSAINI", "GENERAL", "EDGE", "HYDRANT", "ROUTE", "NATUREL")
foreach ($cat in $categories) { $results[$cat] = @{ok=0; fail=0; errors=@()} }

foreach ($test in $testCases) {
    Write-Host "[$($test.cat.PadRight(8))] #$($test.id.ToString().PadLeft(2)): $($test.q.Substring(0, [Math]::Min(40, $test.q.Length)))..." -NoNewline

    $body = @{
        provider = "ollama"
        model = "qwen2.5:14b"
        messages = @(@{role = "user"; content = $test.q})
        useTools = $true
    } | ConvertTo-Json -Depth 10

    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3001/api/ai/ollama/chat" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 180

        $hasData = $response.content -match '\d+'
        $hasError = $response.content -match "erreur|error|impossible|pas d'acc[eè]s|pas acc[eè]s|je n'ai pas"
        $isLoop = $response.content -match '(je vais|veuillez patienter).{0,100}(je vais|veuillez patienter)'

        if ($isLoop) {
            Write-Host " [BOUCLE]" -ForegroundColor Red
            $results[$test.cat].fail++
            $results[$test.cat].errors += @{id=$test.id; q=$test.q; reason="BOUCLE"}
        } elseif ($hasError) {
            Write-Host " [ERREUR]" -ForegroundColor Red
            $results[$test.cat].fail++
            $results[$test.cat].errors += @{id=$test.id; q=$test.q; reason="ERREUR"; preview=$response.content.Substring(0, [Math]::Min(100, $response.content.Length))}
        } elseif (-not $hasData) {
            Write-Host " [SANS_DATA]" -ForegroundColor Yellow
            $results[$test.cat].fail++
            $results[$test.cat].errors += @{id=$test.id; q=$test.q; reason="SANS_DATA"; preview=$response.content.Substring(0, [Math]::Min(100, $response.content.Length))}
        } else {
            Write-Host " [OK]" -ForegroundColor Green
            $results[$test.cat].ok++
        }
    } catch {
        Write-Host " [EXCEPTION]" -ForegroundColor Red
        $results[$test.cat].fail++
        $results[$test.cat].errors += @{id=$test.id; q=$test.q; reason="EXCEPTION"; error=$_.ToString()}
    }
}

# Resume par categorie
Write-Host ""
Write-Host "=== RESUME PAR CATEGORIE ===" -ForegroundColor Cyan
$totalOk = 0
$totalFail = 0
foreach ($cat in $categories) {
    $ok = $results[$cat].ok
    $fail = $results[$cat].fail
    $total = $ok + $fail
    $pct = if($total -gt 0) { [math]::Round($ok/$total*100) } else { 0 }
    $color = if($pct -eq 100){"Green"}elseif($pct -ge 80){"Yellow"}else{"Red"}
    Write-Host "  $($cat.PadRight(10)): $ok/$total ($pct%)" -ForegroundColor $color
    $totalOk += $ok
    $totalFail += $fail
}

$totalPct = [math]::Round($totalOk/($totalOk+$totalFail)*100)
Write-Host ""
Write-Host "=== TOTAL: $totalOk/$($totalOk+$totalFail) ($totalPct%) ===" -ForegroundColor $(if($totalPct -ge 90){"Green"}elseif($totalPct -ge 70){"Yellow"}else{"Red"})

# Details des echecs
if ($totalFail -gt 0) {
    Write-Host ""
    Write-Host "=== ECHECS DETAILS ===" -ForegroundColor Red
    foreach ($cat in $categories) {
        foreach ($err in $results[$cat].errors) {
            Write-Host "  #$($err.id) [$($err.reason)]: $($err.q)" -ForegroundColor Yellow
            if ($err.preview) {
                Write-Host "     -> $($err.preview)..." -ForegroundColor Gray
            }
        }
    }
}

# Export JSON pour analyse
$exportData = @{
    date = Get-Date -Format "yyyy-MM-dd HH:mm"
    total = @{ok=$totalOk; fail=$totalFail; pct=$totalPct}
    categories = $results
}
$exportData | ConvertTo-Json -Depth 5 | Out-File "C:\Users\zema\GeoBrain\scripts\test_results.json" -Encoding UTF8

Write-Host ""
Write-Host "Resultats exportes dans test_results.json" -ForegroundColor Gray
