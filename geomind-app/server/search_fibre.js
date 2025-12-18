import * as connections from './connections.js';

async function searchFibreTables() {
  try {
    const allConnections = connections.listConnections();
    let connId = allConnections.find(c => c.host?.includes('srv-fme'))?.id;
    
    if (!connId) {
      connId = await connections.addConnection({
        name: 'srv-fme (temp)',
        type: 'postgresql',
        host: 'srv-fme',
        port: 5432,
        database: 'Prod',
        username: 'postgres',
        password: ''
      });
    }
    
    await connections.connect(connId);
    
    const query = `
      SELECT 
        table_schema,
        table_name,
        table_type
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'tiger', 'tiger_data', 'topology')
        AND (
          LOWER(table_name) LIKE '%fibre%'
          OR LOWER(table_name) LIKE '%optique%'
          OR LOWER(table_name) LIKE '%fo%'
        )
      ORDER BY table_schema, table_name;
    `;
    
    const result = await connections.executeSQL(connId, query);
    
    if (result.rows.length > 0) {
      console.log('\nTables/vues contenant "fibre", "optique" ou "fo":');
      console.log('==================================================');
      result.rows.forEach(row => {
        console.log(`${row.table_schema}.${row.table_name} (${row.table_type})`);
      });
    } else {
      console.log('\nAucune table trouvée avec "fibre", "optique" ou "fo" dans le nom.');
      console.log('\nLes données de fibre optique sont probablement:');
      console.log('1. Dans la base Oracle (srv-sai) - voir AutoCAD Map 3D dans ton architecture');
      console.log('2. Pas encore importées dans PostgreSQL');
      console.log('3. Dans un schéma ou table avec un nom différent');
    }
    
  } catch (error) {
    console.error('ERREUR:', error.message);
  } finally {
    process.exit(0);
  }
}

searchFibreTables();
