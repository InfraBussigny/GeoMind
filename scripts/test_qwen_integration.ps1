# Test integration Qwen2.5:14b avec le backend GeoBrain

$body = @{
    provider = "ollama"
    model = "qwen2.5:14b"
    messages = @(
        @{
            role = "user"
            content = "Combien y a-t-il de parcelles a Bussigny? Utilise l'outil SQL pour le savoir."
        }
    )
    useTools = $true
} | ConvertTo-Json -Depth 10

Write-Host "=== TEST INTEGRATION QWEN2.5:14B ===" -ForegroundColor Cyan
Write-Host "Envoi requete au backend GeoBrain..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/ai/ollama/chat" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 120

    Write-Host "`n=== REPONSE ===" -ForegroundColor Green
    Write-Host "Contenu: $($response.content)"

    if ($response.toolCalls) {
        Write-Host "`nOutils utilises:" -ForegroundColor Cyan
        foreach ($tool in $response.toolCalls) {
            Write-Host "  - $($tool.tool): $($tool.result | ConvertTo-Json -Compress)"
        }
    }

    Write-Host "`nIterations: $($response.iterations)"
} catch {
    Write-Host "Erreur: $_" -ForegroundColor Red
}
