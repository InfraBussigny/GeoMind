$prompt = @"
Tu es un assistant avec acces aux outils suivants:
- execute_sql(query: string): Execute une requete SQL sur PostgreSQL Bussigny

Pour utiliser un outil, reponds UNIQUEMENT avec le format:
<tool_call>{"name": "execute_sql", "parameters": {"query": "SELECT ..."}}</tool_call>

Question: Combien y a-t-il de parcelles a Bussigny?
"@

$body = @{
    model = "qwen2.5:14b"
    prompt = $prompt
    stream = $false
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:11434/api/generate" -Method POST -Body $body -ContentType "application/json"
Write-Host "=== REPONSE QWEN2.5:14B ==="
Write-Host $response.response
