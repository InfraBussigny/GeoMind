<script lang="ts">
  interface Column {
    key: string;
    label: string;
    type?: 'string' | 'number' | 'date' | 'geometry';
    width?: number;
  }

  interface Props {
    columns: Column[];
    data: Record<string, any>[];
    pageSize?: number;
  }

  let { columns, data, pageSize = 50 }: Props = $props();

  let sortColumn = $state<string | null>(null);
  let sortDirection = $state<'asc' | 'desc'>('asc');
  let filterText = $state('');
  let currentPage = $state(0);

  // Filter data
  let filteredData = $derived(() => {
    if (!filterText) return data;
    const lower = filterText.toLowerCase();
    return data.filter(row =>
      columns.some(col => {
        const value = row[col.key];
        return value != null && String(value).toLowerCase().includes(lower);
      })
    );
  });

  // Sort data
  let sortedData = $derived(() => {
    const filtered = filteredData();
    if (!sortColumn) return filtered;

    return [...filtered].sort((a, b) => {
      const aVal = a[sortColumn!];
      const bVal = b[sortColumn!];

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      const col = columns.find(c => c.key === sortColumn);
      let comparison = 0;

      if (col?.type === 'number') {
        comparison = Number(aVal) - Number(bVal);
      } else if (col?.type === 'date') {
        comparison = new Date(aVal).getTime() - new Date(bVal).getTime();
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  });

  // Paginate data
  let pageCount = $derived(Math.ceil(sortedData().length / pageSize));
  let paginatedData = $derived(() => {
    const start = currentPage * pageSize;
    return sortedData().slice(start, start + pageSize);
  });

  function toggleSort(colKey: string) {
    if (sortColumn === colKey) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = colKey;
      sortDirection = 'asc';
    }
  }

  function goToPage(page: number) {
    currentPage = Math.max(0, Math.min(page, pageCount - 1));
  }

  function copyCell(value: any) {
    navigator.clipboard.writeText(String(value ?? ''));
  }

  function copyRow(row: Record<string, any>) {
    const text = columns.map(col => row[col.key] ?? '').join('\t');
    navigator.clipboard.writeText(text);
  }

  function exportCSV() {
    const header = columns.map(c => c.label).join(',');
    const rows = sortedData().map(row =>
      columns.map(col => {
        const val = row[col.key];
        if (val == null) return '';
        const str = String(val);
        return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(',')
    );
    const csv = [header, ...rows].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'export.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function formatValue(value: any, type?: string): string {
    if (value == null) return '-';
    if (type === 'geometry') return '[GEOMETRY]';
    if (type === 'number' && typeof value === 'number') {
      return value.toLocaleString('fr-CH');
    }
    return String(value);
  }
</script>

<div class="data-table-container">
  <!-- Toolbar -->
  <div class="table-toolbar">
    <div class="toolbar-left">
      <input
        type="text"
        placeholder="Filtrer..."
        bind:value={filterText}
        class="filter-input"
      />
      <span class="row-count">{filteredData().length} lignes</span>
    </div>
    <div class="toolbar-right">
      <button class="export-btn" onclick={exportCSV} title="Exporter CSV">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        CSV
      </button>
    </div>
  </div>

  <!-- Table -->
  <div class="table-wrapper">
    <table>
      <thead>
        <tr>
          {#each columns as col}
            <th
              onclick={() => toggleSort(col.key)}
              style={col.width ? `width: ${col.width}px` : ''}
              class:sorted={sortColumn === col.key}
            >
              <span class="th-content">
                {col.label}
                {#if sortColumn === col.key}
                  <svg class="sort-icon" class:desc={sortDirection === 'desc'} width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 4l-8 8h16z"/>
                  </svg>
                {/if}
              </span>
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each paginatedData() as row, rowIndex}
          <tr>
            {#each columns as col}
              <td
                class={col.type || ''}
                ondblclick={() => copyCell(row[col.key])}
                title="Double-clic pour copier"
              >
                {formatValue(row[col.key], col.type)}
              </td>
            {/each}
          </tr>
        {/each}
        {#if paginatedData().length === 0}
          <tr>
            <td colspan={columns.length} class="empty-row">
              Aucun resultat
            </td>
          </tr>
        {/if}
      </tbody>
    </table>
  </div>

  <!-- Pagination -->
  {#if pageCount > 1}
    <div class="pagination">
      <button
        onclick={() => goToPage(0)}
        disabled={currentPage === 0}
        title="Premiere page"
      >
        &laquo;
      </button>
      <button
        onclick={() => goToPage(currentPage - 1)}
        disabled={currentPage === 0}
        title="Page precedente"
      >
        &lsaquo;
      </button>
      <span class="page-info">
        Page {currentPage + 1} / {pageCount}
      </span>
      <button
        onclick={() => goToPage(currentPage + 1)}
        disabled={currentPage >= pageCount - 1}
        title="Page suivante"
      >
        &rsaquo;
      </button>
      <button
        onclick={() => goToPage(pageCount - 1)}
        disabled={currentPage >= pageCount - 1}
        title="Derniere page"
      >
        &raquo;
      </button>
    </div>
  {/if}
</div>

<style>
  .data-table-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--noir-surface);
  }

  .table-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px;
    border-bottom: 1px solid var(--border-color);
    background: var(--noir-card);
    gap: 8px;
  }

  .toolbar-left,
  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .filter-input {
    padding: 4px 8px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--noir-surface);
    color: var(--text-primary);
    font-family: var(--font-mono);
    font-size: 11px;
    width: 150px;
    outline: none;
  }

  .filter-input:focus {
    border-color: var(--cyber-green);
  }

  .filter-input::placeholder {
    color: var(--text-muted);
  }

  .row-count {
    font-size: 11px;
    color: var(--text-muted);
    font-family: var(--font-mono);
  }

  .export-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border: 1px solid var(--border-color);
    background: var(--noir-surface);
    color: var(--text-secondary);
    border-radius: 4px;
    font-family: var(--font-mono);
    font-size: 10px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .export-btn:hover {
    border-color: var(--cyber-green);
    color: var(--cyber-green);
  }

  .table-wrapper {
    flex: 1;
    overflow: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--font-mono);
    font-size: 11px;
  }

  thead {
    position: sticky;
    top: 0;
    z-index: 1;
  }

  th {
    padding: 8px;
    text-align: left;
    background: var(--noir-card);
    color: var(--text-secondary);
    font-weight: 600;
    border-bottom: 1px solid var(--border-color);
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
  }

  th:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
  }

  th.sorted {
    color: var(--cyber-green);
  }

  .th-content {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .sort-icon {
    transition: transform 0.15s;
  }

  .sort-icon.desc {
    transform: rotate(180deg);
  }

  td {
    padding: 6px 8px;
    border-bottom: 1px solid var(--border-color);
    color: var(--text-primary);
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  td.number {
    text-align: right;
    color: var(--accent-purple);
  }

  td.geometry {
    color: var(--text-muted);
    font-style: italic;
  }

  tr:hover td {
    background: var(--bg-hover);
  }

  .empty-row {
    text-align: center;
    color: var(--text-muted);
    padding: 24px !important;
  }

  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 8px;
    border-top: 1px solid var(--border-color);
    background: var(--noir-card);
  }

  .pagination button {
    padding: 4px 8px;
    border: 1px solid var(--border-color);
    background: var(--noir-surface);
    color: var(--text-secondary);
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.15s;
  }

  .pagination button:hover:not(:disabled) {
    border-color: var(--cyber-green);
    color: var(--cyber-green);
  }

  .pagination button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .page-info {
    font-size: 11px;
    color: var(--text-muted);
    padding: 0 8px;
    font-family: var(--font-mono);
  }
</style>
