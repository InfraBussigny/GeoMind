# Test iteratif du modele Ollama avec outils
# Envoie une requete et capture la reponse complete

param(
    [string]$Question = "Combien de parcelles par type a Bussigny?"
)

$body = @{
    provider = "ollama"
    model = "qwen2.5:14b"
    messages = @(
        @{
            role = "user"
            content = $Question
        }
    )
    useTools = $true
} | ConvertTo-Json -Depth 10

Write-Host "=== TEST QWEN2.5:14B ===" -ForegroundColor Cyan
Write-Host "Question: $Question" -ForegroundColor Yellow
Write-Host ""

$startTime = Get-Date

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/ai/ollama/chat" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 180

    $duration = (Get-Date) - $startTime

    Write-Host "=== REPONSE (${duration.TotalSeconds}s) ===" -ForegroundColor Green
    Write-Host $response.content

    Write-Host "`n=== METRIQUES ===" -ForegroundColor Cyan
    Write-Host "Iterations: $($response.iterations)"
    Write-Host "Tool calls: $($response.toolCalls.Count)"

    if ($response.toolCalls) {
        Write-Host "`n=== OUTILS UTILISES ===" -ForegroundColor Magenta
        foreach ($tool in $response.toolCalls) {
            Write-Host "  Tool: $($tool.tool)"
            if ($tool.result.success) {
                Write-Host "  Resultat: SUCCESS" -ForegroundColor Green
                if ($tool.result.rows) {
                    Write-Host "  Rows: $($tool.result.rows.Count)"
                }
            } else {
                Write-Host "  Resultat: ERREUR - $($tool.result.error)" -ForegroundColor Red
            }
        }
    }

    # Retourner un objet pour analyse
    return @{
        success = $true
        content = $response.content
        iterations = $response.iterations
        toolCalls = $response.toolCalls
        duration = $duration.TotalSeconds
    }
} catch {
    Write-Host "ERREUR: $_" -ForegroundColor Red
    return @{
        success = $false
        error = $_.ToString()
    }
}
