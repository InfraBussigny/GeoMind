// Script Node.js pour exporter la structure du schéma fibre_optique
// Utilise pg (PostgreSQL client pour Node.js)

const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  host: 'srv-fme',
  port: 5432,
  database: 'Prod',
  user: 'postgres',
  // password: '', // Si nécessaire
  connectionTimeoutMillis: 10000,
});

const query = `
SELECT 
    c.table_name,
    c.ordinal_position AS pos,
    c.column_name,
    c.data_type,
    CASE 
        WHEN c.character_maximum_length IS NOT NULL THEN c.data_type || '(' || c.character_maximum_length || ')'
        WHEN c.numeric_precision IS NOT NULL THEN c.data_type || '(' || c.numeric_precision || ',' || COALESCE(c.numeric_scale, 0) || ')'
        ELSE c.data_type
    END AS full_type,
    c.is_nullable,
    c.column_default,
    pgd.description AS comment
FROM information_schema.columns c
LEFT JOIN pg_catalog.pg_statio_all_tables st 
    ON c.table_schema = st.schemaname AND c.table_name = st.relname
LEFT JOIN pg_catalog.pg_description pgd 
    ON pgd.objoid = st.relid AND pgd.objsubid = c.ordinal_position
WHERE c.table_schema = 'fibre_optique'
ORDER BY c.table_name, c.ordinal_position;
`;

async function exportSchema() {
  let client;
  try {
    console.log('Connexion à srv-fme/Prod...');
    client = await pool.connect();
    
    console.log('Exécution de la requête...');
    const result = await client.query(query);
    
    console.log(`Nombre de colonnes trouvées: ${result.rows.length}\n`);
    
    // Grouper par table
    const tables = {};
    result.rows.forEach(row => {
      if (!tables[row.table_name]) {
        tables[row.table_name] = [];
      }
      tables[row.table_name].push(row);
    });
    
    // Afficher en markdown
    let markdown = `# Structure du schéma fibre_optique\n\n`;
    markdown += `**Base**: srv-fme / Prod  \n`;
    markdown += `**Schéma**: fibre_optique  \n`;
    markdown += `**Date**: ${new Date().toLocaleString('fr-CH')}  \n\n`;
    markdown += `**Nombre de tables/vues**: ${Object.keys(tables).length}  \n`;
    markdown += `**Nombre total de colonnes**: ${result.rows.length}  \n\n`;
    markdown += `---\n\n`;
    
    Object.keys(tables).sort().forEach(tableName => {
      const columns = tables[tableName];
      markdown += `## Table: \`${tableName}\`\n\n`;
      markdown += `**Nombre de colonnes**: ${columns.length}\n\n`;
      markdown += `| # | Colonne | Type | Nullable | Défaut | Commentaire |\n`;
      markdown += `|---|---------|------|----------|--------|-------------|\n`;
      
      columns.forEach(col => {
        const pos = col.pos;
        const name = col.column_name;
        const type = col.full_type;
        const nullable = col.is_nullable === 'YES' ? 'Oui' : 'Non';
        const defaut = col.column_default || '-';
        const comment = col.comment || '-';
        markdown += `| ${pos} | \`${name}\` | ${type} | ${nullable} | ${defaut} | ${comment} |\n`;
      });
      
      markdown += `\n`;
    });
    
    // Sauvegarder dans un fichier
    const outputPath = 'C:/Users/zema/GeoBrain/projets/fibre_optique_structure.md';
    fs.writeFileSync(outputPath, markdown, 'utf8');
    console.log(`\nStructure exportée vers: ${outputPath}`);
    
    // Afficher aussi dans la console
    console.log('\n' + markdown);
    
  } catch (error) {
    console.error('Erreur:', error.message);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

exportSchema();
