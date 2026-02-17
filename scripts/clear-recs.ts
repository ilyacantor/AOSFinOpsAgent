import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkRecommendations() {
  const client = await pool.connect();
  try {
    console.log('=== Current Recommendations ===');
    const result = await client.query(`
      SELECT r.resource_id, r.type, r.title, r.status, ar.resource_type
      FROM recommendations r
      LEFT JOIN aws_resources ar ON r.resource_id = ar.resource_id
      ORDER BY ar.resource_type, r.title
    `);

    for (const row of result.rows) {
      console.log(`[${row.resource_type || 'Unknown'}] ${row.title} (${row.status})`);
    }
    console.log(`\nTotal: ${result.rowCount} recommendations`);

    // Check which resource types have recommendations
    const byType = await client.query(`
      SELECT ar.resource_type, COUNT(*) as count
      FROM recommendations r
      LEFT JOIN aws_resources ar ON r.resource_id = ar.resource_id
      GROUP BY ar.resource_type
      ORDER BY ar.resource_type
    `);
    console.log('\n=== By Resource Type ===');
    for (const row of byType.rows) {
      console.log(`${row.resource_type || 'Unknown'}: ${row.count}`);
    }

  } finally {
    client.release();
    await pool.end();
  }
}

checkRecommendations().catch(e => {
  console.error(e);
  process.exit(1);
});
