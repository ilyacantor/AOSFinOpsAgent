/**
 * UI Review Script: Shows exactly what the UI displays to humans
 *
 * This is the "test through UI" that dad emphasized - verify recommendations
 * make sense to a human, not just pass automated tests.
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

async function reviewUIData() {
  const client = await pool.connect();

  try {
    // Get all recommendations with resource info - this is what the UI shows
    const result = await client.query(`
      SELECT
        r.title,
        r.type,
        r.status,
        r.projected_monthly_savings as savings_amount,
        r.risk_level,
        r.description,
        ar.resource_type,
        ar.resource_id,
        ar.utilization_metrics
      FROM recommendations r
      LEFT JOIN aws_resources ar ON r.resource_id = ar.resource_id
      WHERE r.status IN ('pending', 'executed', 'approved')
      ORDER BY ar.resource_type, r.projected_monthly_savings DESC
    `);

    console.log('='.repeat(80));
    console.log('WHAT THE UI SHOWS - HUMAN REVIEW');
    console.log('Does each recommendation make sense? Would a user understand what to do?');
    console.log('='.repeat(80));
    console.log();

    let currentType = '';
    let issues: string[] = [];

    for (const row of result.rows) {
      if (row.resource_type !== currentType) {
        currentType = row.resource_type;
        console.log('\n' + '─'.repeat(80));
        console.log('RESOURCE TYPE: ' + currentType);
        console.log('─'.repeat(80));
      }

      console.log();
      console.log('📌 Title: ' + row.title);
      console.log('   Type: ' + row.type);
      console.log('   Status: ' + row.status);
      console.log('   Risk: ' + row.risk_level);
      console.log('   Savings: $' + (row.savings_amount || 0).toLocaleString() + '/month');
      console.log('   Resource: ' + row.resource_id);
      console.log('   Description: ' + (row.description || 'No description').substring(0, 120));

      // Show metrics that triggered the detection
      const metrics = row.utilization_metrics || {};
      console.log('   Metrics: ' + JSON.stringify(metrics).substring(0, 120));

      // Human sanity checks
      if (!row.title || row.title.length < 10) {
        issues.push(`${row.resource_id}: Title too short or missing`);
      }
      if (!row.description || row.description.length < 20) {
        issues.push(`${row.resource_id}: Description too short or missing`);
      }
      if (row.savings_amount === 0 || row.savings_amount === null) {
        issues.push(`${row.resource_id}: No savings amount - user won't understand value`);
      }
      if (row.savings_amount > 1000000) {
        issues.push(`${row.resource_id}: Savings of $${row.savings_amount.toLocaleString()} seems unrealistic`);
      }
    }

    console.log('\n');
    console.log('='.repeat(80));
    console.log('SUMMARY: ' + result.rowCount + ' recommendations');
    console.log('='.repeat(80));

    // Count by type
    const byType = await client.query(`
      SELECT ar.resource_type, COUNT(*) as count
      FROM recommendations r
      LEFT JOIN aws_resources ar ON r.resource_id = ar.resource_id
      WHERE r.status IN ('pending', 'executed', 'approved')
      GROUP BY ar.resource_type
      ORDER BY ar.resource_type
    `);

    console.log('\nRecommendations by Resource Type:');
    for (const row of byType.rows) {
      console.log(`  ${row.resource_type}: ${row.count}`);
    }

    if (issues.length > 0) {
      console.log('\n⚠️  POTENTIAL UI ISSUES FOUND:');
      for (const issue of issues) {
        console.log('  - ' + issue);
      }
    } else {
      console.log('\n✅ No obvious UI issues detected');
    }

    // Check for missing resource types (should have 10)
    const expectedTypes = ['EC2', 'RDS', 'Redshift', 'EBS', 'EBS_Snapshot', 'ElasticIP', 'NATGateway', 'LoadBalancer', 'S3', 'Lambda'];
    const foundTypes = byType.rows.map(r => r.resource_type);
    const missingTypes = expectedTypes.filter(t => !foundTypes.includes(t));

    if (missingTypes.length > 0) {
      console.log('\n⚠️  RESOURCE TYPES WITH NO RECOMMENDATIONS:');
      for (const t of missingTypes) {
        console.log('  - ' + t);
      }
      console.log('  (This may be correct if no resources are wasteful)');
    }

  } finally {
    client.release();
    await pool.end();
  }
}

reviewUIData().catch(e => {
  console.error(e);
  process.exit(1);
});
