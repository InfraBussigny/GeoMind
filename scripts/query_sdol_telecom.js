const { Client } = require('pg');

const client = new Client({
  host: 'postgres.hkd-geomatique.com',
  port: 5432,
  database: 'sdol',
  user: 'by_fme_w',
  password: process.env.SDOL_PASSWORD || '' // À définir via variable d'environnement
});

async function queryTelecomTables() {
  try {
    await client.connect();
    console.log('✓ Connecté à SDOL\n');

    const query = `
      SELECT 
        c.table_name,
        c.column_name,
        c.data_type,
        c.character_maximum_length,
        c.numeric_precision,
        c.numeric_scale,
        c.is_nullable,
        c.column_default,
        pgd.description as comment
      FROM information_schema.columns c
      LEFT JOIN pg_catalog.pg_statio_all_tables st 
        ON c.table_schema = st.schemaname AND c.table_name = st.relname
      LEFT JOIN pg_catalog.pg_description pgd 
        ON pgd.objoid = st.relid AND pgd.objsubid = c.ordinal_position
      WHERE c.table_schema = 'back_hkd_databy'
        AND c.table_name IN ('tc_conduite', 'tc_elemontage')
      ORDER BY c.table_name, c.ordinal_position;
    `;

    const result = await client.query(query);
    
    console.log(`Nombre de colonnes trouvées : ${result.rows.length}\n`);

    // Grouper par table
    const tables = {};
    result.rows.forEach(row => {
      if (!tables[row.table_name]) {
        tables[row.table_name] = [];
      }
      tables[row.table_name].push(row);
    });

    // Afficher les résultats
    Object.keys(tables).sort().forEach(tableName => {
      console.log(`\n## Table : ${tableName}`);
      console.log(`${'='.repeat(80)}\n`);
      console.log('| Colonne | Type | Nullable | Défaut | Commentaire |');
      console.log('|---------|------|----------|--------|-------------|');
      
      tables[tableName].forEach(col => {
        let dataType = col.data_type;
        if (col.character_maximum_length) {
          dataType += `(${col.character_maximum_length})`;
        } else if (col.numeric_precision) {
          dataType += `(${col.numeric_precision}${col.numeric_scale ? ',' + col.numeric_scale : ''})`;
        }
        
        const nullable = col.is_nullable === 'YES' ? 'Oui' : 'Non';
        const defaultVal = col.column_default || '-';
        const comment = col.comment || '-';
        
        console.log(`| ${col.column_name} | ${dataType} | ${nullable} | ${defaultVal} | ${comment} |`);
      });
    });

  } catch (err) {
    console.error('Erreur:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

queryTelecomTables();
