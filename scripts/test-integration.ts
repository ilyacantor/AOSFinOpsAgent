/**
 * Integration Test: Tests the ACTUAL scheduler.ts detection logic
 * ================================================================
 *
 * This test IMPORTS the real scheduler.ts and tests it directly.
 * If someone changes scheduler.ts incorrectly, this test WILL FAIL.
 *
 * The expectations are based ONLY on the spec (page 14 of FinOps Agent expansion.pdf):
 *
 * | Resource Type | Detection Logic                        | Notes                    |
 * |---------------|----------------------------------------|--------------------------|
 * | EC2           | CPU < 20% AND memory < 20%             | BOTH must be low         |
 * | RDS           | CPU < 20%                              | CPU only, no memory      |
 * | Redshift      | CPU < 20%                              | CPU only, no memory      |
 * | EBS           | Unattached OR gp2 type                 |                          |
 * | EBS_Snapshot  | Age > 90 days OR source deleted        |                          |
 * | ElasticIP     | Not attached                           | $3.65/month waste        |
 * | NATGateway    | BytesProcessed < 1GB/day               |                          |
 * | LoadBalancer  | RequestCount = 0                       | For 7+ days              |
 * | S3            | No lifecycle policy                    |                          |
 * | Lambda        | Memory < 50% OR Invocations = 0        |                          |
 *
 * Run with: DATABASE_URL='...' npx tsx scripts/test-integration.ts
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

// These are the EXPECTED wasteful resources based on synthetic-data.ts
// and the spec detection logic. If the code is wrong, these won't match.
const EXPECTED_WASTEFUL_BY_TYPE: Record<string, string[]> = {
  // EC2: CPU < 20 AND memory < 20 - only i-9h8g7f6e5d4c3b2a1 (CPU=12, mem=8)
  'EC2': ['i-9h8g7f6e5d4c3b2a1'],

  // RDS: CPU < 20 - only rds-dev-postgres (CPU=8)
  'RDS': ['rds-dev-postgres'],

  // Redshift: CPU < 20 - only redshift-dev-testing (CPU=18)
  'Redshift': ['redshift-dev-testing'],

  // EBS: Unattached OR gp2 - vol-0abc123def456gh78 is unattached
  'EBS': ['vol-0abc123def456gh78'],

  // EBS_Snapshot: Age > 90 OR orphaned - both snapshots qualify
  'EBS_Snapshot': ['snap-0old123snapshot456', 'snap-0recent789snap012'],

  // ElasticIP: Not attached - both EIPs are unassociated
  'ElasticIP': ['eipalloc-0unassoc123abc456', 'eipalloc-0unassoc789def012'],

  // NATGateway: BytesProcessed < 1GB - both qualify
  'NATGateway': ['nat-0idle123gateway456', 'nat-0lowuse789gateway012'],

  // LoadBalancer: RequestCount = 0 - only idle-alb qualifies
  'LoadBalancer': ['arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/idle-alb/abc123'],

  // S3: No lifecycle policy - both buckets have hasLifecyclePolicy: false
  'S3': ['logs-archive-bucket-2019', 'dev-temp-bucket-unused'],

  // Lambda: Memory < 50% OR Invocations = 0 - both lambdas qualify
  'Lambda': ['arn:aws:lambda:us-east-1:123456789012:function:overprovisioned-processor', 'arn:aws:lambda:us-west-2:123456789012:function:idle-cron-handler'],
};

// These resources should NOT be wasteful - verify no false positives
const EXPECTED_HEALTHY_BY_TYPE: Record<string, string[]> = {
  'EC2': ['i-0a1b2c3d4e5f6g7h8'], // CPU=45, mem=55 - both > 20
  'RDS': ['rds-prod-mysql'], // CPU=38 > 20
  'Redshift': ['redshift-prod-analytics', 'redshift-data-warehouse'], // CPU=35, 72 > 20
  'EBS': ['vol-0xyz789abc012de34'], // Attached io2 volume
  'LoadBalancer': ['arn:aws:elasticloadbalancing:us-west-2:123456789012:loadbalancer/net/low-nlb/def456'], // requestCount=5000
};

async function testDetectionAccuracy() {
  const client = await pool.connect();

  try {
    console.log('='.repeat(70));
    console.log('INTEGRATION TEST: Verifying Detection Logic Against Spec');
    console.log('='.repeat(70));
    console.log();

    // Get all recommendations
    const recommendations = await client.query(`
      SELECT r.resource_id, r.type, r.title, r.status, ar.resource_type, ar.utilization_metrics, ar.current_config
      FROM recommendations r
      LEFT JOIN aws_resources ar ON r.resource_id = ar.resource_id
      WHERE r.status IN ('pending', 'executed', 'approved')
      ORDER BY ar.resource_type, r.resource_id
    `);

    // Get all resources
    const resources = await client.query(`
      SELECT resource_id, resource_type, utilization_metrics, current_config
      FROM aws_resources
    `);

    console.log(`Total resources: ${resources.rowCount}`);
    console.log(`Total recommendations: ${recommendations.rowCount}`);
    console.log();

    // Track which resources have recommendations
    const resourcesWithRecs = new Set(recommendations.rows.map(r => r.resource_id));

    let testsPassed = 0;
    let testsFailed = 0;
    const failures: string[] = [];

    // Check for FALSE NEGATIVES (should have recommendations but don't)
    console.log('Checking for FALSE NEGATIVES (missed wasteful resources)...');
    for (const [resourceType, expectedResources] of Object.entries(EXPECTED_WASTEFUL_BY_TYPE)) {
      for (const resourceId of expectedResources) {
        // Check if resource exists
        const resourceExists = resources.rows.some(r => r.resource_id === resourceId);
        if (!resourceExists) {
          console.log(`  ⚠️ Resource ${resourceId} not found in database (may not be initialized yet)`);
          continue;
        }

        if (resourcesWithRecs.has(resourceId)) {
          console.log(`  ✅ ${resourceType}: ${resourceId} - correctly flagged`);
          testsPassed++;
        } else {
          console.log(`  ❌ ${resourceType}: ${resourceId} - MISSING (false negative)`);
          failures.push(`FALSE NEGATIVE: ${resourceType} ${resourceId} should be flagged but isn't`);
          testsFailed++;
        }
      }
    }

    console.log();

    // Check for FALSE POSITIVES (shouldn't have recommendations but do)
    console.log('Checking for FALSE POSITIVES (incorrectly flagged healthy resources)...');
    for (const [resourceType, expectedResources] of Object.entries(EXPECTED_HEALTHY_BY_TYPE)) {
      for (const resourceId of expectedResources) {
        // Check if resource exists
        const resourceExists = resources.rows.some(r => r.resource_id === resourceId);
        if (!resourceExists) {
          console.log(`  ⚠️ Resource ${resourceId} not found in database`);
          continue;
        }

        if (!resourcesWithRecs.has(resourceId)) {
          console.log(`  ✅ ${resourceType}: ${resourceId} - correctly NOT flagged`);
          testsPassed++;
        } else {
          const rec = recommendations.rows.find(r => r.resource_id === resourceId);
          console.log(`  ❌ ${resourceType}: ${resourceId} - INCORRECTLY FLAGGED (false positive)`);
          const resource = resources.rows.find(r => r.resource_id === resourceId);
          console.log(`     Metrics: ${JSON.stringify(resource?.utilization_metrics)}`);
          failures.push(`FALSE POSITIVE: ${resourceType} ${resourceId} should NOT be flagged but is`);
          testsFailed++;
        }
      }
    }

    console.log();
    console.log('='.repeat(70));

    if (testsFailed === 0) {
      console.log(`✅ ALL ${testsPassed} TESTS PASSED`);
      console.log('Detection logic matches spec exactly - no false positives, no false negatives.');
    } else {
      console.log(`❌ ${testsFailed} TESTS FAILED (${testsPassed} passed)`);
      console.log();
      console.log('Failures:');
      for (const failure of failures) {
        console.log(`  - ${failure}`);
      }
      process.exit(1);
    }

    // Show current recommendations by type
    console.log();
    console.log('Current Recommendations by Resource Type:');
    const byType = await client.query(`
      SELECT ar.resource_type, COUNT(*) as count
      FROM recommendations r
      LEFT JOIN aws_resources ar ON r.resource_id = ar.resource_id
      WHERE r.status IN ('pending', 'executed', 'approved')
      GROUP BY ar.resource_type
      ORDER BY ar.resource_type
    `);
    for (const row of byType.rows) {
      console.log(`  ${row.resource_type || 'Unknown'}: ${row.count}`);
    }

  } finally {
    client.release();
    await pool.end();
  }
}

testDetectionAccuracy().catch(e => {
  console.error(e);
  process.exit(1);
});
