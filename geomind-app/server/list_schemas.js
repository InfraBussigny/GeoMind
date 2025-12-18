import * as connections from './connections.js';

async function listSchemas() {
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
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY schema_name;
    `;
    
    const result = await connections.executeSQL(connId, query);
    console.log('\nSchémas disponibles dans la base Prod:');
    console.log('=====================================');
    result.rows.forEach(row => {
      console.log(`- ${row.schema_name}`);
    });
    
  } catch (error) {
    console.error('ERREUR:', error.message);
  } finally {
    process.exit(0);
  }
}

listSchemas();
