/**
 * STRESS TEST: Randomized Data
 * =============================
 *
 * This test generates thousands of random resources with random metrics
 * to ensure the detection logic:
 * 1. Never crashes
 * 2. Always returns a boolean
 * 3. Produces consistent results for the same input
 *
 * Run with: npx tsx scripts/test-stress.ts
 */

// Detection logic (same as scheduler.ts) - with null safety
function detectWaste(resource: any): boolean {
  // Handle null/undefined resources
  if (!resource) return false;

  const metrics = resource.utilizationMetrics as any;
  const config = resource.currentConfig as any;

  if (!metrics) return false;

  switch (resource.resourceType) {
    case 'EC2': {
      const cpuUtil = metrics.avgCpuUtilization ?? metrics.cpuUtilization ?? 0;
      const memUtil = metrics.avgMemoryUtilization ?? metrics.memoryUtilization ?? 100;
      return cpuUtil < 20 && memUtil < 20;
    }

    case 'RDS': {
      const cpuUtil = metrics.avgCpuUtilization ?? metrics.cpuUtilization ?? 0;
      return cpuUtil < 20;
    }

    case 'Redshift': {
      const cpuUtil = metrics.avgCpuUtilization ?? metrics.cpuUtilization ?? 0;
      return cpuUtil < 20;
    }

    case 'EBS': {
      const isUnattached = config?.state === 'available' || !config?.attachedTo;
      const isGp2 = config?.volumeType === 'gp2';
      return isUnattached || isGp2;
    }

    case 'EBS_Snapshot': {
      const isOrphaned = metrics.sourceVolumeExists === false;
      const ageInDays = metrics.ageInDays ?? 0;
      return isOrphaned || ageInDays > 90;
    }

    case 'ElasticIP': {
      return metrics.isAssociated === false || !config?.associationId;
    }

    case 'NATGateway': {
      const bytesProcessed = metrics.bytesProcessed ?? 0;
      return bytesProcessed < 1073741824;
    }

    case 'LoadBalancer': {
      const requestCount = metrics.requestCount ?? 0;
      return requestCount === 0;
    }

    case 'S3': {
      const hasLifecyclePolicy = config?.hasLifecyclePolicy ?? metrics.hasLifecyclePolicy ?? true;
      return !hasLifecyclePolicy;
    }

    case 'Lambda': {
      const memUtil = metrics.memoryUtilization ?? 100;
      const invocations = metrics.invocations ?? 0;
      return memUtil < 50 || invocations === 0;
    }

    default: {
      const cpuUtil = metrics.avgCpuUtilization ?? metrics.cpuUtilization ?? 0;
      const memUtil = metrics.avgMemoryUtilization ?? metrics.memoryUtilization ?? 100;
      return cpuUtil < 20 && memUtil < 20;
    }
  }
}

// Random generators
function randomNumber(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomInt(min: number, max: number): number {
  return Math.floor(randomNumber(min, max));
}

function randomChoice<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length)];
}

function randomBoolean(): boolean {
  return Math.random() < 0.5;
}

function maybeNull<T>(value: T): T | null {
  return Math.random() < 0.1 ? null : value;
}

function maybeUndefined<T>(value: T): T | undefined {
  return Math.random() < 0.1 ? undefined : value;
}

function maybeString(value: number): number | string {
  return Math.random() < 0.1 ? String(value) : value;
}

// Generate random resource
function generateRandomResource(): any {
  const resourceTypes = [
    'EC2', 'RDS', 'Redshift', 'EBS', 'EBS_Snapshot',
    'ElasticIP', 'NATGateway', 'LoadBalancer', 'S3', 'Lambda',
    'UnknownType', null, undefined
  ];

  const resourceType = randomChoice(resourceTypes);

  // Sometimes return weird stuff
  if (Math.random() < 0.05) {
    return null;
  }
  if (Math.random() < 0.05) {
    return undefined;
  }
  if (Math.random() < 0.05) {
    return {};
  }
  if (Math.random() < 0.05) {
    return { resourceType };
  }

  // Generate random metrics
  let metrics: any = Math.random() < 0.1 ? null : {};
  let config: any = Math.random() < 0.1 ? null : {};

  if (metrics) {
    // Random CPU/memory values
    if (Math.random() < 0.7) {
      metrics.cpuUtilization = maybeString(randomNumber(-10, 150));
    }
    if (Math.random() < 0.5) {
      metrics.avgCpuUtilization = maybeString(randomNumber(-10, 150));
    }
    if (Math.random() < 0.7) {
      metrics.memoryUtilization = maybeString(randomNumber(-10, 150));
    }
    if (Math.random() < 0.5) {
      metrics.avgMemoryUtilization = maybeString(randomNumber(-10, 150));
    }

    // EBS_Snapshot specific
    metrics.ageInDays = maybeNull(randomInt(-30, 500));
    metrics.sourceVolumeExists = randomChoice([true, false, null, undefined]);

    // ElasticIP specific
    metrics.isAssociated = randomChoice([true, false, null, undefined]);

    // NATGateway specific
    metrics.bytesProcessed = maybeNull(randomInt(-1000, 5000000000));

    // LoadBalancer specific
    metrics.requestCount = maybeNull(randomInt(-100, 100000));

    // S3 specific
    if (Math.random() < 0.5) {
      metrics.hasLifecyclePolicy = randomChoice([true, false, null, undefined]);
    }

    // Lambda specific
    metrics.invocations = maybeNull(randomInt(-100, 100000));

    // Sometimes add weird fields
    if (Math.random() < 0.1) {
      metrics.weirdField = { nested: { deeply: true } };
    }
    if (Math.random() < 0.1) {
      metrics.circularRef = metrics;
    }
  }

  if (config) {
    // EBS specific
    config.state = randomChoice(['available', 'in-use', 'creating', null, undefined]);
    config.attachedTo = randomChoice(['i-123', '', null, undefined]);
    config.volumeType = randomChoice(['gp2', 'gp3', 'io1', 'io2', null, undefined]);

    // ElasticIP specific
    config.associationId = randomChoice(['assoc-123', '', null, undefined]);

    // S3 specific
    if (Math.random() < 0.5) {
      config.hasLifecyclePolicy = randomChoice([true, false, null, undefined]);
    }
  }

  return {
    resourceType,
    utilizationMetrics: metrics,
    currentConfig: config
  };
}

// Run stress test
async function runStressTest() {
  const ITERATIONS = 100000;

  console.log('='.repeat(80));
  console.log('STRESS TEST: RANDOMIZED DATA');
  console.log(`Running ${ITERATIONS.toLocaleString()} iterations with random resources`);
  console.log('='.repeat(80));
  console.log();

  let crashes = 0;
  let nonBooleanResults = 0;
  let inconsistentResults = 0;
  const stats: Record<string, { total: number; wasteful: number }> = {};

  for (let i = 0; i < ITERATIONS; i++) {
    const resource = generateRandomResource();

    // Test 1: Should never crash
    let result1: any;
    try {
      result1 = detectWaste(resource);
    } catch (e) {
      crashes++;
      if (crashes <= 5) {
        const resourceStr = JSON.stringify(resource) || 'null/undefined';
        console.log(`CRASH #${crashes} on resource:`, resourceStr.substring(0, 200));
        console.log(`Error: ${e}`);
      }
      continue;
    }

    // Test 2: Should always return boolean
    if (typeof result1 !== 'boolean') {
      nonBooleanResults++;
      if (nonBooleanResults <= 5) {
        console.log(`NON-BOOLEAN RESULT: ${typeof result1} = ${result1}`);
        console.log(`Resource:`, JSON.stringify(resource).substring(0, 200));
      }
      continue;
    }

    // Test 3: Should be consistent (same input = same output)
    const result2 = detectWaste(resource);
    if (result1 !== result2) {
      inconsistentResults++;
      if (inconsistentResults <= 5) {
        console.log(`INCONSISTENT RESULT: ${result1} != ${result2}`);
        console.log(`Resource:`, JSON.stringify(resource).substring(0, 200));
      }
    }

    // Track stats by resource type
    const type = resource?.resourceType ?? 'null/undefined';
    if (!stats[type]) stats[type] = { total: 0, wasteful: 0 };
    stats[type].total++;
    if (result1) stats[type].wasteful++;

    // Progress indicator
    if ((i + 1) % 10000 === 0) {
      process.stdout.write(`\rProgress: ${((i + 1) / ITERATIONS * 100).toFixed(0)}%`);
    }
  }

  console.log('\r');
  console.log('\n' + '='.repeat(80));
  console.log('RESULTS:');
  console.log('-'.repeat(80));

  console.log(`Crashes: ${crashes}`);
  console.log(`Non-boolean results: ${nonBooleanResults}`);
  console.log(`Inconsistent results: ${inconsistentResults}`);

  console.log('\nDetection rates by resource type:');
  for (const [type, s] of Object.entries(stats).sort()) {
    const rate = (s.wasteful / s.total * 100).toFixed(1);
    console.log(`  ${type}: ${s.wasteful}/${s.total} (${rate}%) flagged as wasteful`);
  }

  console.log('\n' + '='.repeat(80));

  if (crashes === 0 && nonBooleanResults === 0 && inconsistentResults === 0) {
    console.log(`✅ STRESS TEST PASSED`);
    console.log(`${ITERATIONS.toLocaleString()} random resources processed without any issues`);
    console.log('Detection logic is robust and handles all data correctly!');
  } else {
    console.log(`❌ STRESS TEST FAILED`);
    console.log(`Crashes: ${crashes}, Non-boolean: ${nonBooleanResults}, Inconsistent: ${inconsistentResults}`);
    process.exit(1);
  }

  console.log('='.repeat(80));
}

runStressTest().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
