import * as connections from './connections.js';
import fs from 'fs';

async function exportFibreStructure() {
  try {
    console.log('Recherche de la connexion srv-fme...');
    const allConnections = connections.listConnections();
    
    // Chercher une connexion srv-fme ou créer temporairement
    let connId = allConnections.find(c => c.host?.includes('srv-fme'))?.id;
    
    if (!connId) {
      // Créer connexion temporaire
      console.log('Création connexion temporaire...');
      connId = await connections.addConnection({
        name: 'srv-fme (temp)',
        type: 'postgresql',
        host: 'srv-fme',
        port: 5432,
        database: 'Prod',
        username: 'postgres',
        password: ''  // Assumant trust authentication
      });
    }
    
    // Se connecter
    console.log(`Connexion à la base de données (ID: ${connId})...`);
    await connections.connect(connId);
    
    // Requête de structure
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
    
    console.log('Exécution de la requête...');
    const result = await connections.executeSQL(connId, query);
    console.log(`Nombre de colonnes trouvées: ${result.rows.length}\n`);
    
    if (result.rows.length === 0) {
      console.log('ATTENTION: Aucune table trouvée dans le schéma fibre_optique.');
      console.log('Vérifiez que le schéma existe et que vous avez les permissions.');
      return;
    }
    
    // Grouper par table
    const tables = {};
    result.rows.forEach(row => {
      if (!tables[row.table_name]) {
        tables[row.table_name] = [];
      }
      tables[row.table_name].push(row);
    });
    
    // Construire markdown
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
        const defaut = (col.column_default || '-').replace(/\|/g, '\|');
        const comment = (col.comment || '-').replace(/\|/g, '\|');
        markdown += `| ${pos} | \`${name}\` | ${type} | ${nullable} | ${defaut} | ${comment} |\n`;
      });
      
      markdown += `\n`;
    });
    
    // Sauvegarder
    const outputPath = 'C:/Users/zema/GeoBrain/projets/fibre_optique_structure.md';
    fs.writeFileSync(outputPath, markdown, 'utf8');
    console.log(`\nStructure exportée vers: ${outputPath}\n`);
    
    // Afficher
    console.log(markdown);
    
  } catch (error) {
    console.error('\nERREUR:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

exportFibreStructure();
