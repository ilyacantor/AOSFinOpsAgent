/**
 * COMPREHENSIVE TEST SUITE FOR DETECTION LOGIC
 * =============================================
 *
 * This tests the detection logic against ALL edge cases to ensure
 * the code works for ANY data, not just our synthetic test data.
 *
 * Tests include:
 * - Boundary conditions (exactly at thresholds)
 * - Null/undefined/missing field handling
 * - Type coercion (strings vs numbers)
 * - Extreme values
 * - Boolean edge cases
 * - Field name variations
 * - Empty objects
 *
 * Run with: DATABASE_URL='...' npx tsx scripts/test-comprehensive.ts
 */

// ============================================================================
// DETECTION LOGIC (extracted from scheduler.ts for isolated testing)
// ============================================================================

function detectWaste(resource: any): { isWasteful: boolean; reason?: string } {
  const metrics = resource.utilizationMetrics as any;
  const config = resource.currentConfig as any;

  if (!metrics) {
    return { isWasteful: false, reason: 'No metrics available' };
  }

  switch (resource.resourceType) {
    case 'EC2': {
      const cpuUtil = metrics.avgCpuUtilization ?? metrics.cpuUtilization ?? 0;
      const memUtil = metrics.avgMemoryUtilization ?? metrics.memoryUtilization ?? 100;
      const isWasteful = cpuUtil < 20 && memUtil < 20;
      return {
        isWasteful,
        reason: isWasteful ? `CPU ${cpuUtil}% AND mem ${memUtil}% both < 20%` : `CPU ${cpuUtil}% or mem ${memUtil}% >= 20%`
      };
    }

    case 'RDS': {
      const cpuUtil = metrics.avgCpuUtilization ?? metrics.cpuUtilization ?? 0;
      const isWasteful = cpuUtil < 20;
      return { isWasteful, reason: `CPU ${cpuUtil}% ${isWasteful ? '<' : '>='} 20%` };
    }

    case 'Redshift': {
      const cpuUtil = metrics.avgCpuUtilization ?? metrics.cpuUtilization ?? 0;
      const isWasteful = cpuUtil < 20;
      return { isWasteful, reason: `CPU ${cpuUtil}% ${isWasteful ? '<' : '>='} 20%` };
    }

    case 'EBS': {
      const isUnattached = config?.state === 'available' || !config?.attachedTo;
      const isGp2 = config?.volumeType === 'gp2';
      const isWasteful = isUnattached || isGp2;
      return {
        isWasteful,
        reason: isUnattached ? 'Unattached' : (isGp2 ? 'gp2 volume' : 'Attached and not gp2')
      };
    }

    case 'EBS_Snapshot': {
      const isOrphaned = metrics.sourceVolumeExists === false;
      const ageInDays = metrics.ageInDays ?? 0;
      const isWasteful = isOrphaned || ageInDays > 90;
      return {
        isWasteful,
        reason: isOrphaned ? 'Source volume deleted' : `Age ${ageInDays} days ${ageInDays > 90 ? '>' : '<='} 90`
      };
    }

    case 'ElasticIP': {
      const isWasteful = metrics.isAssociated === false || !config?.associationId;
      return { isWasteful, reason: isWasteful ? 'Not associated' : 'Associated' };
    }

    case 'NATGateway': {
      const bytesProcessed = metrics.bytesProcessed ?? 0;
      const isWasteful = bytesProcessed < 1073741824;
      return {
        isWasteful,
        reason: `${bytesProcessed} bytes ${isWasteful ? '<' : '>='} 1GB`
      };
    }

    case 'LoadBalancer': {
      const requestCount = metrics.requestCount ?? 0;
      const isWasteful = requestCount === 0;
      return { isWasteful, reason: `Request count = ${requestCount}` };
    }

    case 'S3': {
      const hasLifecyclePolicy = config?.hasLifecyclePolicy ?? metrics.hasLifecyclePolicy ?? true;
      const isWasteful = !hasLifecyclePolicy;
      return { isWasteful, reason: isWasteful ? 'No lifecycle policy' : 'Has lifecycle policy' };
    }

    case 'Lambda': {
      const memUtil = metrics.memoryUtilization ?? 100;
      const invocations = metrics.invocations ?? 0;
      const isWasteful = memUtil < 50 || invocations === 0;
      return {
        isWasteful,
        reason: invocations === 0 ? 'Zero invocations' : `Memory util ${memUtil}% ${memUtil < 50 ? '<' : '>='} 50%`
      };
    }

    default: {
      // Fallback: use EC2-style detection (conservative)
      const cpuUtil = metrics.avgCpuUtilization ?? metrics.cpuUtilization ?? 0;
      const memUtil = metrics.avgMemoryUtilization ?? metrics.memoryUtilization ?? 100;
      const isWasteful = cpuUtil < 20 && memUtil < 20;
      return {
        isWasteful,
        reason: `Unknown type fallback: CPU ${cpuUtil}%, mem ${memUtil}%`
      };
    }
  }
}

// ============================================================================
// TEST FRAMEWORK
// ============================================================================

interface TestCase {
  name: string;
  resource: any;
  expectedWasteful: boolean;
  notes?: string;
}

interface TestResult {
  passed: boolean;
  testCase: TestCase;
  actual: boolean;
  reason: string;
}

function runTest(tc: TestCase): TestResult {
  const result = detectWaste(tc.resource);
  return {
    passed: result.isWasteful === tc.expectedWasteful,
    testCase: tc,
    actual: result.isWasteful,
    reason: result.reason || 'No reason'
  };
}

// ============================================================================
// TEST CASES
// ============================================================================

const testCases: TestCase[] = [
  // -------------------------------------------------------------------------
  // EC2 TESTS - CPU < 20 AND memory < 20
  // -------------------------------------------------------------------------

  // Boundary conditions
  {
    name: 'EC2: Exactly at 20% CPU and 20% memory (NOT wasteful)',
    resource: { resourceType: 'EC2', utilizationMetrics: { cpuUtilization: 20, memoryUtilization: 20 } },
    expectedWasteful: false,
    notes: 'Spec says < 20%, so exactly 20% should NOT be flagged'
  },
  {
    name: 'EC2: Just below threshold (19.9% CPU, 19.9% memory)',
    resource: { resourceType: 'EC2', utilizationMetrics: { cpuUtilization: 19.9, memoryUtilization: 19.9 } },
    expectedWasteful: true,
    notes: '19.9 < 20, so should be flagged'
  },
  {
    name: 'EC2: Just above threshold (20.1% CPU, 20.1% memory)',
    resource: { resourceType: 'EC2', utilizationMetrics: { cpuUtilization: 20.1, memoryUtilization: 20.1 } },
    expectedWasteful: false,
    notes: '20.1 >= 20, so should NOT be flagged'
  },

  // AND logic verification
  {
    name: 'EC2: Low CPU (10%) but high memory (50%) - NOT wasteful',
    resource: { resourceType: 'EC2', utilizationMetrics: { cpuUtilization: 10, memoryUtilization: 50 } },
    expectedWasteful: false,
    notes: 'BOTH must be < 20%, memory is high'
  },
  {
    name: 'EC2: High CPU (50%) but low memory (10%) - NOT wasteful',
    resource: { resourceType: 'EC2', utilizationMetrics: { cpuUtilization: 50, memoryUtilization: 10 } },
    expectedWasteful: false,
    notes: 'BOTH must be < 20%, CPU is high'
  },
  {
    name: 'EC2: Both low (5% CPU, 5% memory) - wasteful',
    resource: { resourceType: 'EC2', utilizationMetrics: { cpuUtilization: 5, memoryUtilization: 5 } },
    expectedWasteful: true,
    notes: 'Both below 20%'
  },

  // Field name variations
  {
    name: 'EC2: Uses avgCpuUtilization field name',
    resource: { resourceType: 'EC2', utilizationMetrics: { avgCpuUtilization: 5, avgMemoryUtilization: 5 } },
    expectedWasteful: true,
    notes: 'Should work with avg* field names'
  },
  {
    name: 'EC2: Mixed field names (avg and regular)',
    resource: { resourceType: 'EC2', utilizationMetrics: { avgCpuUtilization: 5, memoryUtilization: 5 } },
    expectedWasteful: true,
    notes: 'Should work with mixed field names'
  },

  // Null/undefined handling
  {
    name: 'EC2: Missing CPU metric (defaults to 0, wasteful)',
    resource: { resourceType: 'EC2', utilizationMetrics: { memoryUtilization: 5 } },
    expectedWasteful: true,
    notes: 'Missing CPU defaults to 0 (< 20)'
  },
  {
    name: 'EC2: Missing memory metric (defaults to 100, NOT wasteful)',
    resource: { resourceType: 'EC2', utilizationMetrics: { cpuUtilization: 5 } },
    expectedWasteful: false,
    notes: 'Missing memory defaults to 100 (>= 20) - conservative default'
  },
  {
    name: 'EC2: No metrics at all',
    resource: { resourceType: 'EC2', utilizationMetrics: null },
    expectedWasteful: false,
    notes: 'No metrics = no detection possible'
  },
  {
    name: 'EC2: Empty metrics object',
    resource: { resourceType: 'EC2', utilizationMetrics: {} },
    expectedWasteful: false,
    notes: 'Empty metrics = CPU defaults to 0, memory defaults to 100'
  },

  // Type coercion
  {
    name: 'EC2: CPU as string "15" (should work)',
    resource: { resourceType: 'EC2', utilizationMetrics: { cpuUtilization: "15", memoryUtilization: 15 } },
    expectedWasteful: true,
    notes: 'String "15" should be treated as number 15'
  },

  // Extreme values
  {
    name: 'EC2: Zero CPU and memory',
    resource: { resourceType: 'EC2', utilizationMetrics: { cpuUtilization: 0, memoryUtilization: 0 } },
    expectedWasteful: true,
    notes: '0 < 20'
  },
  {
    name: 'EC2: 100% CPU and memory',
    resource: { resourceType: 'EC2', utilizationMetrics: { cpuUtilization: 100, memoryUtilization: 100 } },
    expectedWasteful: false,
    notes: '100 >= 20'
  },
  {
    name: 'EC2: Negative values (edge case)',
    resource: { resourceType: 'EC2', utilizationMetrics: { cpuUtilization: -5, memoryUtilization: -5 } },
    expectedWasteful: true,
    notes: 'Negative values are < 20 (bad data but handled correctly)'
  },

  // -------------------------------------------------------------------------
  // RDS TESTS - CPU < 20 only
  // -------------------------------------------------------------------------

  {
    name: 'RDS: Exactly at 20% CPU (NOT wasteful)',
    resource: { resourceType: 'RDS', utilizationMetrics: { cpuUtilization: 20 } },
    expectedWasteful: false,
    notes: 'Exactly at threshold'
  },
  {
    name: 'RDS: 19.9% CPU (wasteful)',
    resource: { resourceType: 'RDS', utilizationMetrics: { cpuUtilization: 19.9 } },
    expectedWasteful: true,
    notes: 'Just below threshold'
  },
  {
    name: 'RDS: Low CPU (5%) but high memory (90%) - STILL wasteful',
    resource: { resourceType: 'RDS', utilizationMetrics: { cpuUtilization: 5, memoryUtilization: 90 } },
    expectedWasteful: true,
    notes: 'RDS only checks CPU, memory is irrelevant'
  },
  {
    name: 'RDS: High CPU (50%) - NOT wasteful',
    resource: { resourceType: 'RDS', utilizationMetrics: { cpuUtilization: 50 } },
    expectedWasteful: false,
    notes: 'Above threshold'
  },

  // -------------------------------------------------------------------------
  // REDSHIFT TESTS - CPU < 20 only
  // -------------------------------------------------------------------------

  {
    name: 'Redshift: 18% CPU (wasteful)',
    resource: { resourceType: 'Redshift', utilizationMetrics: { cpuUtilization: 18 } },
    expectedWasteful: true,
    notes: '18 < 20'
  },
  {
    name: 'Redshift: 35% CPU (NOT wasteful)',
    resource: { resourceType: 'Redshift', utilizationMetrics: { cpuUtilization: 35 } },
    expectedWasteful: false,
    notes: '35 >= 20'
  },

  // -------------------------------------------------------------------------
  // EBS TESTS - Unattached OR gp2
  // -------------------------------------------------------------------------

  {
    name: 'EBS: Unattached (state=available)',
    resource: { resourceType: 'EBS', utilizationMetrics: {}, currentConfig: { state: 'available', volumeType: 'gp3' } },
    expectedWasteful: true,
    notes: 'Unattached volume'
  },
  {
    name: 'EBS: Attached but gp2',
    resource: { resourceType: 'EBS', utilizationMetrics: {}, currentConfig: { state: 'in-use', attachedTo: 'i-123', volumeType: 'gp2' } },
    expectedWasteful: true,
    notes: 'gp2 volumes should be migrated'
  },
  {
    name: 'EBS: Attached gp3 (NOT wasteful)',
    resource: { resourceType: 'EBS', utilizationMetrics: {}, currentConfig: { state: 'in-use', attachedTo: 'i-123', volumeType: 'gp3' } },
    expectedWasteful: false,
    notes: 'Attached modern volume type'
  },
  {
    name: 'EBS: Attached io2 (NOT wasteful)',
    resource: { resourceType: 'EBS', utilizationMetrics: {}, currentConfig: { state: 'in-use', attachedTo: 'i-123', volumeType: 'io2' } },
    expectedWasteful: false,
    notes: 'Attached io2 volume'
  },
  {
    name: 'EBS: No attachedTo field (wasteful)',
    resource: { resourceType: 'EBS', utilizationMetrics: {}, currentConfig: { state: 'in-use', volumeType: 'gp3' } },
    expectedWasteful: true,
    notes: 'Missing attachedTo = unattached'
  },
  {
    name: 'EBS: attachedTo is null (wasteful)',
    resource: { resourceType: 'EBS', utilizationMetrics: {}, currentConfig: { state: 'in-use', attachedTo: null, volumeType: 'gp3' } },
    expectedWasteful: true,
    notes: 'Null attachedTo = unattached'
  },
  {
    name: 'EBS: attachedTo is empty string (wasteful)',
    resource: { resourceType: 'EBS', utilizationMetrics: {}, currentConfig: { state: 'in-use', attachedTo: '', volumeType: 'gp3' } },
    expectedWasteful: true,
    notes: 'Empty string = falsy = unattached'
  },
  {
    name: 'EBS: No config at all',
    resource: { resourceType: 'EBS', utilizationMetrics: {} },
    expectedWasteful: true,
    notes: 'No config = unattached (conservative)'
  },

  // -------------------------------------------------------------------------
  // EBS_SNAPSHOT TESTS - Age > 90 OR orphaned
  // -------------------------------------------------------------------------

  {
    name: 'EBS_Snapshot: Exactly 90 days old (NOT wasteful)',
    resource: { resourceType: 'EBS_Snapshot', utilizationMetrics: { ageInDays: 90, sourceVolumeExists: true } },
    expectedWasteful: false,
    notes: 'Spec says > 90, so exactly 90 is NOT wasteful'
  },
  {
    name: 'EBS_Snapshot: 91 days old (wasteful)',
    resource: { resourceType: 'EBS_Snapshot', utilizationMetrics: { ageInDays: 91, sourceVolumeExists: true } },
    expectedWasteful: true,
    notes: '91 > 90'
  },
  {
    name: 'EBS_Snapshot: 30 days but orphaned (wasteful)',
    resource: { resourceType: 'EBS_Snapshot', utilizationMetrics: { ageInDays: 30, sourceVolumeExists: false } },
    expectedWasteful: true,
    notes: 'Orphaned regardless of age'
  },
  {
    name: 'EBS_Snapshot: 30 days, source exists (NOT wasteful)',
    resource: { resourceType: 'EBS_Snapshot', utilizationMetrics: { ageInDays: 30, sourceVolumeExists: true } },
    expectedWasteful: false,
    notes: 'Young and has source'
  },
  {
    name: 'EBS_Snapshot: No age specified (defaults to 0)',
    resource: { resourceType: 'EBS_Snapshot', utilizationMetrics: { sourceVolumeExists: true } },
    expectedWasteful: false,
    notes: 'Missing age defaults to 0 (NOT > 90)'
  },
  {
    name: 'EBS_Snapshot: sourceVolumeExists undefined (NOT treated as false)',
    resource: { resourceType: 'EBS_Snapshot', utilizationMetrics: { ageInDays: 30 } },
    expectedWasteful: false,
    notes: 'undefined !== false, so not orphaned'
  },

  // -------------------------------------------------------------------------
  // ELASTICIP TESTS - Not associated
  // -------------------------------------------------------------------------

  {
    name: 'ElasticIP: isAssociated = false (wasteful)',
    resource: { resourceType: 'ElasticIP', utilizationMetrics: { isAssociated: false }, currentConfig: {} },
    expectedWasteful: true,
    notes: 'Explicitly not associated'
  },
  {
    name: 'ElasticIP: isAssociated = true (NOT wasteful)',
    resource: { resourceType: 'ElasticIP', utilizationMetrics: { isAssociated: true }, currentConfig: { associationId: 'assoc-123' } },
    expectedWasteful: false,
    notes: 'Associated'
  },
  {
    name: 'ElasticIP: isAssociated missing, no associationId (wasteful)',
    resource: { resourceType: 'ElasticIP', utilizationMetrics: {}, currentConfig: {} },
    expectedWasteful: true,
    notes: 'No associationId = not associated'
  },
  {
    name: 'ElasticIP: isAssociated true but no associationId (wasteful)',
    resource: { resourceType: 'ElasticIP', utilizationMetrics: { isAssociated: true }, currentConfig: {} },
    expectedWasteful: true,
    notes: 'OR logic: if no associationId, still wasteful'
  },
  {
    name: 'ElasticIP: isAssociated undefined, has associationId (NOT wasteful)',
    resource: { resourceType: 'ElasticIP', utilizationMetrics: {}, currentConfig: { associationId: 'assoc-123' } },
    expectedWasteful: false,
    notes: 'Has associationId, so associated'
  },

  // -------------------------------------------------------------------------
  // NATGATEWAY TESTS - BytesProcessed < 1GB
  // -------------------------------------------------------------------------

  {
    name: 'NATGateway: Exactly 1GB processed (NOT wasteful)',
    resource: { resourceType: 'NATGateway', utilizationMetrics: { bytesProcessed: 1073741824 } },
    expectedWasteful: false,
    notes: 'Exactly at threshold'
  },
  {
    name: 'NATGateway: 1 byte less than 1GB (wasteful)',
    resource: { resourceType: 'NATGateway', utilizationMetrics: { bytesProcessed: 1073741823 } },
    expectedWasteful: true,
    notes: 'Just below threshold'
  },
  {
    name: 'NATGateway: 0 bytes (wasteful)',
    resource: { resourceType: 'NATGateway', utilizationMetrics: { bytesProcessed: 0 } },
    expectedWasteful: true,
    notes: 'Completely idle'
  },
  {
    name: 'NATGateway: 10GB processed (NOT wasteful)',
    resource: { resourceType: 'NATGateway', utilizationMetrics: { bytesProcessed: 10737418240 } },
    expectedWasteful: false,
    notes: 'Well above threshold'
  },
  {
    name: 'NATGateway: Missing bytesProcessed (defaults to 0, wasteful)',
    resource: { resourceType: 'NATGateway', utilizationMetrics: {} },
    expectedWasteful: true,
    notes: 'Missing value defaults to 0'
  },

  // -------------------------------------------------------------------------
  // LOADBALANCER TESTS - RequestCount = 0
  // -------------------------------------------------------------------------

  {
    name: 'LoadBalancer: 0 requests (wasteful)',
    resource: { resourceType: 'LoadBalancer', utilizationMetrics: { requestCount: 0 } },
    expectedWasteful: true,
    notes: 'Idle load balancer'
  },
  {
    name: 'LoadBalancer: 1 request (NOT wasteful)',
    resource: { resourceType: 'LoadBalancer', utilizationMetrics: { requestCount: 1 } },
    expectedWasteful: false,
    notes: 'Even 1 request means its used'
  },
  {
    name: 'LoadBalancer: Missing requestCount (defaults to 0, wasteful)',
    resource: { resourceType: 'LoadBalancer', utilizationMetrics: {} },
    expectedWasteful: true,
    notes: 'Missing value defaults to 0'
  },
  {
    name: 'LoadBalancer: 1000000 requests (NOT wasteful)',
    resource: { resourceType: 'LoadBalancer', utilizationMetrics: { requestCount: 1000000 } },
    expectedWasteful: false,
    notes: 'High traffic'
  },

  // -------------------------------------------------------------------------
  // S3 TESTS - No lifecycle policy
  // -------------------------------------------------------------------------

  {
    name: 'S3: hasLifecyclePolicy = false (wasteful)',
    resource: { resourceType: 'S3', utilizationMetrics: {}, currentConfig: { hasLifecyclePolicy: false } },
    expectedWasteful: true,
    notes: 'No lifecycle policy'
  },
  {
    name: 'S3: hasLifecyclePolicy = true (NOT wasteful)',
    resource: { resourceType: 'S3', utilizationMetrics: {}, currentConfig: { hasLifecyclePolicy: true } },
    expectedWasteful: false,
    notes: 'Has lifecycle policy'
  },
  {
    name: 'S3: hasLifecyclePolicy in metrics (NOT wasteful)',
    resource: { resourceType: 'S3', utilizationMetrics: { hasLifecyclePolicy: true }, currentConfig: {} },
    expectedWasteful: false,
    notes: 'Policy flag in metrics'
  },
  {
    name: 'S3: hasLifecyclePolicy missing (defaults to true, NOT wasteful)',
    resource: { resourceType: 'S3', utilizationMetrics: {}, currentConfig: {} },
    expectedWasteful: false,
    notes: 'Conservative default - assume has policy'
  },
  {
    name: 'S3: Config overrides metrics (config=false, metrics=true)',
    resource: { resourceType: 'S3', utilizationMetrics: { hasLifecyclePolicy: true }, currentConfig: { hasLifecyclePolicy: false } },
    expectedWasteful: true,
    notes: 'Config takes precedence'
  },

  // -------------------------------------------------------------------------
  // LAMBDA TESTS - Memory < 50% OR Invocations = 0
  // -------------------------------------------------------------------------

  {
    name: 'Lambda: 0 invocations (wasteful)',
    resource: { resourceType: 'Lambda', utilizationMetrics: { invocations: 0, memoryUtilization: 80 } },
    expectedWasteful: true,
    notes: 'Zero invocations = unused'
  },
  {
    name: 'Lambda: High invocations but low memory (wasteful)',
    resource: { resourceType: 'Lambda', utilizationMetrics: { invocations: 1000, memoryUtilization: 30 } },
    expectedWasteful: true,
    notes: 'Memory < 50% = over-provisioned'
  },
  {
    name: 'Lambda: High invocations and high memory (NOT wasteful)',
    resource: { resourceType: 'Lambda', utilizationMetrics: { invocations: 1000, memoryUtilization: 60 } },
    expectedWasteful: false,
    notes: 'Well utilized'
  },
  {
    name: 'Lambda: Exactly 50% memory, some invocations (NOT wasteful)',
    resource: { resourceType: 'Lambda', utilizationMetrics: { invocations: 100, memoryUtilization: 50 } },
    expectedWasteful: false,
    notes: 'At threshold'
  },
  {
    name: 'Lambda: 49.9% memory (wasteful)',
    resource: { resourceType: 'Lambda', utilizationMetrics: { invocations: 100, memoryUtilization: 49.9 } },
    expectedWasteful: true,
    notes: 'Just below threshold'
  },
  {
    name: 'Lambda: Missing invocations (defaults to 0, wasteful)',
    resource: { resourceType: 'Lambda', utilizationMetrics: { memoryUtilization: 80 } },
    expectedWasteful: true,
    notes: 'Missing invocations = assume unused'
  },
  {
    name: 'Lambda: Missing memoryUtilization (defaults to 100, NOT wasteful by mem)',
    resource: { resourceType: 'Lambda', utilizationMetrics: { invocations: 100 } },
    expectedWasteful: false,
    notes: 'Defaults to 100% memory usage (conservative)'
  },

  // -------------------------------------------------------------------------
  // UNKNOWN RESOURCE TYPE TESTS
  // -------------------------------------------------------------------------

  {
    name: 'Unknown type: Uses EC2-style fallback (both low = wasteful)',
    resource: { resourceType: 'CustomResource', utilizationMetrics: { cpuUtilization: 5, memoryUtilization: 5 } },
    expectedWasteful: true,
    notes: 'Fallback to EC2 logic'
  },
  {
    name: 'Unknown type: Uses EC2-style fallback (high mem = NOT wasteful)',
    resource: { resourceType: 'CustomResource', utilizationMetrics: { cpuUtilization: 5, memoryUtilization: 50 } },
    expectedWasteful: false,
    notes: 'Fallback to EC2 logic'
  },

  // -------------------------------------------------------------------------
  // EDGE CASES AND WEIRD DATA
  // -------------------------------------------------------------------------

  {
    name: 'Null resource type',
    resource: { resourceType: null, utilizationMetrics: { cpuUtilization: 5 } },
    expectedWasteful: false,
    notes: 'Falls through to default case'
  },
  {
    name: 'Undefined metrics object',
    resource: { resourceType: 'EC2', utilizationMetrics: undefined },
    expectedWasteful: false,
    notes: 'No metrics = cannot detect'
  },
  {
    name: 'EC2: NaN values',
    resource: { resourceType: 'EC2', utilizationMetrics: { cpuUtilization: NaN, memoryUtilization: NaN } },
    expectedWasteful: false,
    notes: 'NaN comparisons return false'
  },
  {
    name: 'EC2: Infinity values',
    resource: { resourceType: 'EC2', utilizationMetrics: { cpuUtilization: Infinity, memoryUtilization: Infinity } },
    expectedWasteful: false,
    notes: 'Infinity >= 20'
  },
  {
    name: 'EC2: Very large numbers',
    resource: { resourceType: 'EC2', utilizationMetrics: { cpuUtilization: 999999999, memoryUtilization: 999999999 } },
    expectedWasteful: false,
    notes: 'Large numbers >= 20'
  },
];

// ============================================================================
// RUN TESTS
// ============================================================================

async function runAllTests() {
  console.log('='.repeat(80));
  console.log('COMPREHENSIVE DETECTION LOGIC TEST SUITE');
  console.log('Testing ' + testCases.length + ' scenarios for robustness');
  console.log('='.repeat(80));
  console.log();

  const results: TestResult[] = [];
  const failures: TestResult[] = [];

  for (const tc of testCases) {
    const result = runTest(tc);
    results.push(result);
    if (!result.passed) {
      failures.push(result);
    }
  }

  // Group by resource type
  const byType: Record<string, TestResult[]> = {};
  for (const r of results) {
    const type = r.testCase.resource.resourceType || 'Unknown';
    if (!byType[type]) byType[type] = [];
    byType[type].push(r);
  }

  // Print results by type
  for (const [type, typeResults] of Object.entries(byType).sort()) {
    const passed = typeResults.filter(r => r.passed).length;
    const total = typeResults.length;
    const status = passed === total ? '✅' : '❌';

    console.log(`\n${status} ${type}: ${passed}/${total} tests passed`);
    console.log('-'.repeat(60));

    for (const r of typeResults) {
      const mark = r.passed ? '  ✓' : '  ✗';
      console.log(`${mark} ${r.testCase.name}`);
      if (!r.passed) {
        console.log(`      Expected: ${r.testCase.expectedWasteful}, Got: ${r.actual}`);
        console.log(`      Reason: ${r.reason}`);
        if (r.testCase.notes) console.log(`      Notes: ${r.testCase.notes}`);
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  const totalPassed = results.filter(r => r.passed).length;
  const totalFailed = results.length - totalPassed;

  if (totalFailed === 0) {
    console.log(`✅ ALL ${results.length} TESTS PASSED`);
    console.log('Detection logic handles all edge cases correctly!');
  } else {
    console.log(`❌ ${totalFailed} TESTS FAILED (${totalPassed} passed)`);
    console.log('\nFailed tests:');
    for (const f of failures) {
      console.log(`  - ${f.testCase.name}`);
      console.log(`    Expected: ${f.testCase.expectedWasteful}, Got: ${f.actual}`);
    }
    process.exit(1);
  }

  console.log('='.repeat(80));
}

runAllTests().catch(e => {
  console.error(e);
  process.exit(1);
});
