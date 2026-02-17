/**
 * Check that recommendation types make sense for each resource type
 */

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

function checkIfSensible(resourceType: string, recType: string): boolean {
  const sensibleCombos: Record<string, string[]> = {
    'EC2': ['rightsizing', 'scheduling'],
    'RDS': ['rightsizing', 'reserved-instance'],
    'Redshift': ['rightsizing', 'scheduling', 'reserved-instance'],
    'EBS': ['delete-unattached', 'volume-rightsizing'],
    'EBS_Snapshot': ['delete-orphaned', 'snapshot-cleanup'],
    'ElasticIP': ['release-eip'],
    'NATGateway': ['delete-unused', 'nat-consolidation'],
    'LoadBalancer': ['delete-unused', 'lb-consolidation'],
    'S3': ['storage-tiering', 'lifecycle-policy'],
    'Lambda': ['lambda-rightsizing', 'delete-unused']
  };

  const allowed = sensibleCombos[resourceType] || [];
  return allowed.includes(recType);
}

async function main() {
  const client = await pool.connect();
  const result = await client.query(`
    SELECT ar.resource_type, r.type as rec_type, r.title
    FROM recommendations r
    JOIN aws_resources ar ON r.resource_id = ar.resource_id
    ORDER BY ar.resource_type
  `);

  console.log('RECOMMENDATION TYPE CHECK:');
  console.log('='.repeat(70));

  const issues: string[] = [];
  for (const row of result.rows) {
    const sensible = checkIfSensible(row.resource_type, row.rec_type);
    const mark = sensible ? '✅' : '❌';
    console.log(`${mark} ${row.resource_type} → ${row.rec_type} (${row.title})`);
    if (!sensible) {
      issues.push(`${row.resource_type} → ${row.rec_type}`);
    }
  }

  console.log();
  if (issues.length > 0) {
    console.log('❌ ISSUES FOUND: ' + issues.join(', '));
    process.exit(1);
  } else {
    console.log('✅ All recommendation types make sense!');
  }

  client.release();
  await pool.end();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
