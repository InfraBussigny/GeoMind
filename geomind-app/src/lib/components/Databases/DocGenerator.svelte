<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    connectionId: string;
  }
  let { connectionId }: Props = $props();

  // Types
  interface Column {
    name: string;
    type: string;
    nullable: boolean;
    defaultValue: string | null;
    comment: string | null;
    isPrimaryKey: boolean;
    isForeignKey: boolean;
    foreignKey: {
      foreignSchema: string;
      foreignTable: string;
      foreignColumn: string;
    } | null;
    isGeometry: boolean;
    geometry: {
      geometryType: string;
      srid: number;
    } | null;
  }

  interface Table {
    schema: string;
    name: string;
    fullName: string;
    comment: string | null;
    sizeBytes: number;
    columns: Column[];
  }

  interface Relation {
    sourceTable: string;
    sourceColumn: string;
    targetTable: string;
    targetColumn: string;
  }

  interface Schema {
    tables: Table[];
    relations: Relation[];
    availableSchemas: string[];
  }

  // State
  let schema = $state<Schema | null>(null);
  let selectedSchemas = $state<string[]>(['public', 'bdco']);
  let outputFormat = $state<'html' | 'markdown'>('html');
  let includeRelations = $state(true);
  let includeComments = $state(true);
  let includeTypes = $state(true);
  let includeAiDescriptions = $state(false);
  let loading = $state(false);
  let generating = $state(false);
  let generatedDoc = $state('');
  let error = $state<string | null>(null);
  let progress = $state(0);
  let progressText = $state('');

  // AI-generated descriptions cache
  let aiDescriptions = $state<Map<string, { table: string; columns: Map<string, string> }>>(new Map());

  // Load schema
  async function loadSchema() {
    loading = true;
    error = null;
    try {
      const schemasParam = selectedSchemas.join(',') || 'public';
      const res = await fetch(`http://localhost:3001/api/databases/${connectionId}/schema?schemas=${schemasParam}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      schema = await res.json();
      if (schema?.availableSchemas && selectedSchemas.length === 0) {
        selectedSchemas = schema.availableSchemas.includes('bdco') ? ['bdco'] : ['public'];
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Erreur chargement';
    } finally {
      loading = false;
    }
  }

  // Format bytes
  function formatBytes(bytes: number): string {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // Get filtered tables
  function getFilteredTables(): Table[] {
    if (!schema) return [];
    return schema.tables.filter(t => selectedSchemas.includes(t.schema));
  }

  // Generate AI description for a table
  async function generateTableDescription(table: Table): Promise<{ table: string; columns: Map<string, string> }> {
    const columnsList = table.columns.map(c => {
      let info = `${c.name} (${c.type})`;
      if (c.isPrimaryKey) info += ' [PK]';
      if (c.isForeignKey && c.foreignKey) info += ` [FK → ${c.foreignKey.foreignTable}]`;
      if (c.isGeometry && c.geometry) info += ` [${c.geometry.geometryType}]`;
      return info;
    }).join(', ');

    const prompt = `Tu es un expert en bases de données géospatiales.
Décris en français simple et clair la table "${table.fullName}" pour des utilisateurs non-techniques.

Colonnes: ${columnsList}
${table.comment ? `Commentaire existant: ${table.comment}` : ''}

Réponds en JSON avec ce format exact:
{
  "tableDescription": "Description de la table en 1-2 phrases simples",
  "columns": {
    "${table.columns[0]?.name || 'col'}": "Description simple de cette colonne"
  }
}

Utilise un vocabulaire accessible. Par exemple:
- "id" → "Identifiant unique de l'enregistrement"
- "geom" → "Position géographique (coordonnées)"
- "created_at" → "Date de création"
- "fk_xxx" → "Lien vers [table liée]"`;

    try {
      const res = await fetch('http://localhost:3001/api/chat/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          provider: 'groq',
          model: 'llama-3.3-70b-versatile'
        })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const content = data.content || data.message?.content || '';

      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const columnsMap = new Map<string, string>();
        if (parsed.columns) {
          for (const [colName, desc] of Object.entries(parsed.columns)) {
            columnsMap.set(colName, desc as string);
          }
        }
        return {
          table: parsed.tableDescription || '',
          columns: columnsMap
        };
      }
    } catch (err) {
      console.warn(`[DocGenerator] Failed to generate AI description for ${table.fullName}:`, err);
    }

    return { table: '', columns: new Map() };
  }

  // Generate all AI descriptions
  async function generateAllAiDescriptions() {
    const tables = getFilteredTables();
    aiDescriptions = new Map();

    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];
      progress = Math.round(((i + 1) / tables.length) * 100);
      progressText = `Génération description: ${table.name} (${i + 1}/${tables.length})`;

      const desc = await generateTableDescription(table);
      aiDescriptions.set(table.fullName, desc);

      // Small delay to avoid rate limiting
      if (i < tables.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
  }

  // Get AI description for a table
  function getAiTableDesc(tableName: string): string {
    return aiDescriptions.get(tableName)?.table || '';
  }

  // Get AI description for a column
  function getAiColumnDesc(tableName: string, colName: string): string {
    return aiDescriptions.get(tableName)?.columns.get(colName) || '';
  }

  // Generate HTML documentation
  function generateHtml(): string {
    const tables = getFilteredTables();
    const now = new Date().toLocaleString('fr-CH');

    let html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Documentation Base de Donnees</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; background: #1a1a2e; color: #e0e0e0; }
    h1 { color: #00ff88; border-bottom: 2px solid #00ff88; padding-bottom: 10px; }
    h2 { color: #00ff88; margin-top: 40px; }
    h3 { color: #87ceeb; }
    .meta { color: #888; font-size: 0.9em; margin-bottom: 30px; }
    .toc { background: #252540; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
    .toc ul { columns: 2; }
    .toc a { color: #00ff88; text-decoration: none; }
    .toc a:hover { text-decoration: underline; }
    .table-card { background: #252540; border: 1px solid #333; border-radius: 8px; padding: 20px; margin-bottom: 24px; }
    .table-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .table-name { font-size: 1.3em; color: #00ff88; }
    .table-size { color: #888; font-size: 0.85em; }
    .table-comment { color: #aaa; font-style: italic; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9em; }
    th { background: #1a1a2e; text-align: left; padding: 10px 12px; border-bottom: 2px solid #00ff88; color: #00ff88; }
    td { padding: 8px 12px; border-bottom: 1px solid #333; }
    tr:hover td { background: #2a2a4e; }
    .pk { color: #ffd700; font-weight: bold; }
    .fk { color: #87ceeb; }
    .geo { color: #90EE90; }
    .nullable { color: #888; }
    .badge { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 0.75em; font-weight: bold; margin-left: 4px; }
    .badge-pk { background: #ffd700; color: #000; }
    .badge-fk { background: #87ceeb; color: #000; }
    .badge-geo { background: #90EE90; color: #000; }
    .relations { margin-top: 16px; padding-top: 16px; border-top: 1px solid #333; }
    .relation { padding: 4px 0; font-family: monospace; font-size: 0.85em; }
    .arrow { color: #888; }
    .ai-description { background: linear-gradient(135deg, #1a2a1a 0%, #1a1a2e 100%); border-left: 3px solid #00ff88; padding: 12px 16px; margin-bottom: 16px; border-radius: 0 8px 8px 0; }
    .ai-description p { margin: 0; color: #c0c0c0; line-height: 1.6; }
    .ai-description .ai-badge { display: inline-block; background: #00ff88; color: #000; padding: 2px 8px; border-radius: 4px; font-size: 0.7em; font-weight: bold; margin-bottom: 8px; }
    .col-ai-desc { font-size: 0.85em; color: #90EE90; font-style: italic; }
  </style>
</head>
<body>
  <h1>Documentation Base de Donnees</h1>
  <div class="meta">Genere le ${now} | Schemas: ${selectedSchemas.join(', ')} | ${tables.length} tables</div>

  <div class="toc">
    <h2>Table des matieres</h2>
    <ul>
      ${tables.map(t => `<li><a href="#${t.fullName.replace(/\./g, '_')}">${t.fullName}</a></li>`).join('\n      ')}
    </ul>
  </div>
`;

    for (const table of tables) {
      const tableRelations = schema?.relations.filter(r =>
        r.sourceTable === table.fullName || r.targetTable === table.fullName
      ) || [];

      const aiTableDesc = includeAiDescriptions ? getAiTableDesc(table.fullName) : '';

      html += `
  <div class="table-card" id="${table.fullName.replace(/\./g, '_')}">
    <div class="table-header">
      <span class="table-name">${table.fullName}</span>
      <span class="table-size">${formatBytes(table.sizeBytes)} | ${table.columns.length} colonnes</span>
    </div>
    ${aiTableDesc ? `<div class="ai-description"><span class="ai-badge">Description IA</span><p>${aiTableDesc}</p></div>` : ''}
    ${table.comment && includeComments ? `<div class="table-comment">${table.comment}</div>` : ''}
    <table>
      <thead>
        <tr>
          <th>Colonne</th>
          ${includeTypes ? '<th>Type</th>' : ''}
          <th>Null</th>
          ${includeComments ? '<th>Description</th>' : ''}
        </tr>
      </thead>
      <tbody>
`;

      for (const col of table.columns) {
        const badges: string[] = [];
        if (col.isPrimaryKey) badges.push('<span class="badge badge-pk">PK</span>');
        if (col.isForeignKey) badges.push('<span class="badge badge-fk">FK</span>');
        if (col.isGeometry) badges.push(`<span class="badge badge-geo">${col.geometry?.geometryType || 'GEO'}</span>`);

        const aiColDesc = includeAiDescriptions ? getAiColumnDesc(table.fullName, col.name) : '';
        let descriptionCell = col.comment || (col.foreignKey ? `FK → ${col.foreignKey.foreignTable}.${col.foreignKey.foreignColumn}` : '-');
        if (aiColDesc) {
          descriptionCell = `<span class="col-ai-desc">${aiColDesc}</span>`;
        }

        html += `        <tr>
          <td class="${col.isPrimaryKey ? 'pk' : col.isForeignKey ? 'fk' : col.isGeometry ? 'geo' : ''}">${col.name}${badges.join('')}</td>
          ${includeTypes ? `<td>${col.type}</td>` : ''}
          <td class="nullable">${col.nullable ? 'Oui' : 'Non'}</td>
          ${includeComments ? `<td>${descriptionCell}</td>` : ''}
        </tr>
`;
      }

      html += `      </tbody>
    </table>
`;

      if (includeRelations && tableRelations.length > 0) {
        html += `    <div class="relations">
      <strong>Relations:</strong>
`;
        for (const rel of tableRelations) {
          if (rel.sourceTable === table.fullName) {
            html += `      <div class="relation">${rel.sourceColumn} <span class="arrow">→</span> ${rel.targetTable}.${rel.targetColumn}</div>
`;
          } else {
            html += `      <div class="relation">${rel.sourceTable}.${rel.sourceColumn} <span class="arrow">→</span> ${rel.targetColumn}</div>
`;
          }
        }
        html += `    </div>
`;
      }

      html += `  </div>
`;
    }

    html += `</body>
</html>`;

    return html;
  }

  // Generate Markdown documentation
  function generateMarkdown(): string {
    const tables = getFilteredTables();
    const now = new Date().toLocaleString('fr-CH');

    let md = `# Documentation Base de Donnees

**Genere le:** ${now}
**Schemas:** ${selectedSchemas.join(', ')}
**Tables:** ${tables.length}

---

## Table des matieres

${tables.map(t => `- [${t.fullName}](#${t.fullName.replace(/\./g, '').toLowerCase()})`).join('\n')}

---

`;

    for (const table of tables) {
      const tableRelations = schema?.relations.filter(r =>
        r.sourceTable === table.fullName || r.targetTable === table.fullName
      ) || [];

      const aiTableDesc = includeAiDescriptions ? getAiTableDesc(table.fullName) : '';

      md += `## ${table.fullName}

`;
      if (aiTableDesc) {
        md += `> **Description :** ${aiTableDesc}

`;
      }
      if (table.comment && includeComments) {
        md += `*${table.comment}*

`;
      }
      md += `**Taille:** ${formatBytes(table.sizeBytes)} | **Colonnes:** ${table.columns.length}

| Colonne | ${includeTypes ? 'Type | ' : ''}Nullable | ${includeComments ? 'Description |' : ''}
|---------|${includeTypes ? '------|' : ''}---------${includeComments ? '|-------------|' : ''}
`;

      for (const col of table.columns) {
        const markers: string[] = [];
        if (col.isPrimaryKey) markers.push('🔑');
        if (col.isForeignKey) markers.push('🔗');
        if (col.isGeometry) markers.push('📍');

        const name = markers.length > 0 ? `${col.name} ${markers.join('')}` : col.name;
        const aiColDesc = includeAiDescriptions ? getAiColumnDesc(table.fullName, col.name) : '';
        const desc = aiColDesc || col.comment || (col.foreignKey ? `FK → ${col.foreignKey.foreignTable}` : '-');

        md += `| ${name} | ${includeTypes ? `\`${col.type}\` | ` : ''}${col.nullable ? 'Oui' : 'Non'} | ${includeComments ? `${desc} |` : ''}
`;
      }

      if (includeRelations && tableRelations.length > 0) {
        md += `
**Relations:**
`;
        for (const rel of tableRelations) {
          if (rel.sourceTable === table.fullName) {
            md += `- ${rel.sourceColumn} → ${rel.targetTable}.${rel.targetColumn}
`;
          } else {
            md += `- ${rel.sourceTable}.${rel.sourceColumn} → ${rel.targetColumn}
`;
          }
        }
      }

      md += `
---

`;
    }

    return md;
  }

  // Generate documentation
  async function generateDocumentation() {
    if (!schema) return;

    generating = true;
    error = null;
    progress = 0;
    progressText = '';

    try {
      // Generate AI descriptions first if enabled
      if (includeAiDescriptions) {
        progressText = 'Generation des descriptions IA...';
        await generateAllAiDescriptions();
      }

      progressText = 'Generation du document...';
      progress = 100;

      if (outputFormat === 'html') {
        generatedDoc = generateHtml();
      } else {
        generatedDoc = generateMarkdown();
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Erreur generation';
    } finally {
      generating = false;
    }
  }

  // Download documentation
  function downloadDoc() {
    if (!generatedDoc) return;

    const ext = outputFormat === 'html' ? 'html' : 'md';
    const mime = outputFormat === 'html' ? 'text/html' : 'text/markdown';
    const blob = new Blob([generatedDoc], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `documentation_db_${new Date().toISOString().split('T')[0]}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Copy to clipboard
  let copySuccess = $state(false);
  function copyDoc() {
    navigator.clipboard.writeText(generatedDoc);
    copySuccess = true;
    setTimeout(() => copySuccess = false, 2000);
  }

  // Toggle schema
  function toggleSchema(s: string) {
    if (selectedSchemas.includes(s)) {
      selectedSchemas = selectedSchemas.filter(x => x !== s);
    } else {
      selectedSchemas = [...selectedSchemas, s];
    }
  }

  onMount(() => {
    loadSchema();
  });
</script>

<div class="doc-generator">
  <!-- Header -->
  <div class="header">
    <div class="title-section">
      <h2>Documentation Automatique</h2>
      <p>Generez une documentation complete de votre schema de base de donnees</p>
    </div>
    <button class="refresh-btn" onclick={loadSchema} disabled={loading}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class:spinning={loading}>
        <path d="M23 4v6h-6M1 20v-6h6"/>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
      </svg>
    </button>
  </div>

  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <p>Chargement du schema...</p>
    </div>
  {:else if error && !schema}
    <div class="error-box">
      <p>{error}</p>
      <button onclick={loadSchema}>Reessayer</button>
    </div>
  {:else}
    <div class="content">
      <!-- Left: Configuration -->
      <div class="config-panel">
        <h3>Configuration</h3>

        <!-- Schema selection -->
        <div class="config-section">
          <label>Schemas</label>
          <div class="schema-list">
            {#if schema?.availableSchemas}
              {#each schema.availableSchemas as s}
                <label class="checkbox-option">
                  <input type="checkbox" checked={selectedSchemas.includes(s)} onchange={() => toggleSchema(s)} />
                  <span>{s}</span>
                  <span class="count">{schema.tables.filter(t => t.schema === s).length}</span>
                </label>
              {/each}
            {/if}
          </div>
        </div>

        <!-- Format -->
        <div class="config-section">
          <label for="format">Format de sortie</label>
          <select id="format" bind:value={outputFormat}>
            <option value="html">HTML (theme sombre)</option>
            <option value="markdown">Markdown</option>
          </select>
        </div>

        <!-- Options -->
        <div class="config-section">
          <label>Options</label>
          <div class="options-list">
            <label class="checkbox-option">
              <input type="checkbox" bind:checked={includeTypes} />
              <span>Inclure les types de colonnes</span>
            </label>
            <label class="checkbox-option">
              <input type="checkbox" bind:checked={includeComments} />
              <span>Inclure les commentaires</span>
            </label>
            <label class="checkbox-option">
              <input type="checkbox" bind:checked={includeRelations} />
              <span>Inclure les relations (FK)</span>
            </label>
          </div>
        </div>

        <!-- AI Descriptions -->
        <div class="config-section ai-section">
          <label class="checkbox-option ai-option">
            <input type="checkbox" bind:checked={includeAiDescriptions} />
            <span>Descriptions IA</span>
            <span class="ai-badge-small">IA</span>
          </label>
          <p class="ai-hint">Genere des descriptions en langage simple pour chaque table et colonne (necessite le backend)</p>
        </div>

        <!-- Stats -->
        <div class="stats-box">
          <div class="stat">
            <span class="stat-value">{getFilteredTables().length}</span>
            <span class="stat-label">Tables</span>
          </div>
          <div class="stat">
            <span class="stat-value">{getFilteredTables().reduce((acc, t) => acc + t.columns.length, 0)}</span>
            <span class="stat-label">Colonnes</span>
          </div>
          <div class="stat">
            <span class="stat-value">{schema?.relations.length || 0}</span>
            <span class="stat-label">Relations</span>
          </div>
        </div>

        <!-- Progress bar (when generating with AI) -->
        {#if generating && includeAiDescriptions}
          <div class="progress-section">
            <div class="progress-bar">
              <div class="progress-fill" style="width: {progress}%"></div>
            </div>
            <p class="progress-text">{progressText}</p>
          </div>
        {/if}

        <!-- Generate button -->
        <button class="generate-btn" onclick={generateDocumentation} disabled={generating || selectedSchemas.length === 0}>
          {#if generating}
            <span class="spinner small"></span>
            {includeAiDescriptions ? `${progress}%` : 'Generation...'}
          {:else}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            Generer la documentation
          {/if}
        </button>
      </div>

      <!-- Right: Preview -->
      <div class="preview-panel">
        <div class="preview-header">
          <h3>Apercu</h3>
          {#if generatedDoc}
            <div class="preview-actions">
              <button class="action-btn" onclick={copyDoc} title="Copier">
                {#if copySuccess}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                {:else}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2"/>
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                  </svg>
                {/if}
              </button>
              <button class="action-btn download" onclick={downloadDoc} title="Telecharger">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </button>
            </div>
          {/if}
        </div>

        <div class="preview-content">
          {#if generatedDoc}
            {#if outputFormat === 'html'}
              <iframe srcdoc={generatedDoc} title="Preview"></iframe>
            {:else}
              <pre class="markdown-preview"><code>{generatedDoc}</code></pre>
            {/if}
          {:else}
            <div class="preview-placeholder">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
              <p>Selectionnez les schemas et cliquez sur "Generer"</p>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .doc-generator {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow: hidden;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border-color);
  }

  .title-section h2 {
    margin: 0 0 4px;
    font-size: 1.2rem;
    color: var(--text-bright);
  }

  .title-section p {
    margin: 0;
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  .refresh-btn {
    padding: 8px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--noir-card);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s;
  }

  .refresh-btn:hover:not(:disabled) {
    color: var(--cyber-green);
    border-color: var(--cyber-green);
  }

  .refresh-btn svg {
    width: 18px;
    height: 18px;
  }

  .refresh-btn svg.spinning {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .loading, .error-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 12px;
    color: var(--text-muted);
  }

  .error-box {
    color: var(--danger);
  }

  .error-box button {
    padding: 8px 16px;
    border: 1px solid var(--danger);
    border-radius: 6px;
    background: transparent;
    color: var(--danger);
    cursor: pointer;
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid transparent;
    border-top-color: var(--cyber-green);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .spinner.small {
    width: 14px;
    height: 14px;
    border-top-color: currentColor;
  }

  .content {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: 16px;
    flex: 1;
    overflow: hidden;
  }

  .config-panel {
    background: var(--noir-card);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }

  h3 {
    margin: 0 0 16px;
    font-size: 0.95rem;
    color: var(--text-bright);
    font-weight: 600;
  }

  .config-section {
    margin-bottom: 20px;
  }

  .config-section > label {
    display: block;
    margin-bottom: 8px;
    font-size: 0.85rem;
    color: var(--text-secondary);
    font-weight: 500;
  }

  .schema-list, .options-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .checkbox-option {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .checkbox-option:hover {
    background: var(--bg-hover);
  }

  .checkbox-option input {
    accent-color: var(--cyber-green);
  }

  .checkbox-option span {
    font-size: 0.9rem;
    color: var(--text-primary);
  }

  .checkbox-option .count {
    margin-left: auto;
    font-size: 0.75rem;
    color: var(--text-muted);
    background: var(--bg-hover);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .config-section select {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--noir-surface);
    color: var(--text-primary);
    font-size: 0.9rem;
  }

  .config-section select:focus {
    outline: none;
    border-color: var(--cyber-green);
  }

  .stats-box {
    display: flex;
    justify-content: space-around;
    padding: 16px;
    background: var(--noir-surface);
    border-radius: 8px;
    margin-bottom: 16px;
  }

  .stat {
    text-align: center;
  }

  .stat-value {
    display: block;
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--cyber-green);
  }

  .stat-label {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .ai-section {
    padding: 12px;
    background: linear-gradient(135deg, rgba(0, 255, 136, 0.05) 0%, transparent 100%);
    border: 1px solid rgba(0, 255, 136, 0.2);
    border-radius: 8px;
  }

  .ai-option {
    margin-bottom: 8px;
  }

  .ai-badge-small {
    margin-left: auto;
    padding: 2px 8px;
    background: var(--cyber-green);
    color: var(--noir-profond);
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 700;
  }

  .ai-hint {
    margin: 0;
    font-size: 0.75rem;
    color: var(--text-muted);
    line-height: 1.4;
  }

  .progress-section {
    margin-bottom: 12px;
  }

  .progress-bar {
    height: 6px;
    background: var(--noir-surface);
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 6px;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--cyber-green), #00cc6a);
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  .progress-text {
    margin: 0;
    font-size: 0.75rem;
    color: var(--text-muted);
    text-align: center;
  }

  .generate-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 12px;
    margin-top: auto;
    border: none;
    border-radius: 6px;
    background: var(--cyber-green);
    color: var(--noir-profond);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .generate-btn:hover:not(:disabled) {
    filter: brightness(1.1);
    box-shadow: 0 0 15px var(--cyber-green-glow);
  }

  .generate-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .generate-btn svg {
    width: 18px;
    height: 18px;
  }

  .preview-panel {
    background: var(--noir-card);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color);
    background: var(--noir-surface);
  }

  .preview-header h3 {
    margin: 0;
    font-size: 0.9rem;
  }

  .preview-actions {
    display: flex;
    gap: 6px;
  }

  .action-btn {
    padding: 6px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--noir-card);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s;
  }

  .action-btn:hover {
    color: var(--cyber-green);
    border-color: var(--cyber-green);
  }

  .action-btn.download:hover {
    color: var(--primary);
    border-color: var(--primary);
  }

  .action-btn svg {
    width: 16px;
    height: 16px;
  }

  .preview-content {
    flex: 1;
    overflow: hidden;
  }

  .preview-content iframe {
    width: 100%;
    height: 100%;
    border: none;
  }

  .markdown-preview {
    margin: 0;
    padding: 16px;
    background: var(--noir-profond);
    height: 100%;
    overflow: auto;
    font-family: var(--font-mono);
    font-size: 0.85rem;
    line-height: 1.5;
    color: var(--text-primary);
  }

  .preview-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-muted);
    text-align: center;
  }

  .preview-placeholder svg {
    width: 64px;
    height: 64px;
    margin-bottom: 16px;
    opacity: 0.3;
  }

  .preview-placeholder p {
    margin: 0;
    font-size: 0.9rem;
  }
</style>
