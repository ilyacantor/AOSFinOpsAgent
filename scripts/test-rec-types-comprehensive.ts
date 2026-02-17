/**
 * RECOMMENDATION TYPE ASSIGNMENT TEST
 * =====================================
 *
 * Tests that the recommendation type assigned to each resource type
 * makes business sense and follows the spec.
 *
 * Run with: npx tsx scripts/test-rec-types-comprehensive.ts
 */

// Recommendation type logic (extracted from scheduler.ts)
function getRecommendationType(resource: any): string {
  const metrics = resource.utilizationMetrics as any;
  const config = resource.currentConfig as any;

  switch (resource.resourceType) {
    case 'EBS':
      if (config?.state === 'available' || !config?.attachedTo) {
        return 'delete-unattached';
      }
      return 'volume-rightsizing';

    case 'EBS_Snapshot':
      if (metrics?.sourceVolumeExists === false) {
        return 'delete-orphaned';
      }
      return 'snapshot-cleanup';

    case 'ElasticIP':
      return 'release-eip';

    case 'NATGateway':
      if (metrics?.idleTimePercent > 90) {
        return 'delete-unused';
      }
      return 'nat-consolidation';

    case 'LoadBalancer':
      if (metrics?.healthyHostCount === 0) {
        return 'delete-unused';
      }
      return 'lb-consolidation';

    case 'S3':
      return 'storage-tiering';

    case 'Lambda':
      if (metrics?.invocations < 100) {
        return 'delete-unused';
      }
      return 'lambda-rightsizing';

    case 'EC2':
      return 'rightsizing';

    case 'RDS':
      return 'rightsizing';

    case 'Redshift':
      return Math.random() < 0.7 ? 'rightsizing' : 'scheduling';

    default:
      return 'rightsizing';
  }
}

// Define which recommendation types are valid for each resource type
const VALID_TYPES: Record<string, string[]> = {
  'EC2': ['rightsizing'],
  'RDS': ['rightsizing'],
  'Redshift': ['rightsizing', 'scheduling'],
  'EBS': ['delete-unattached', 'volume-rightsizing'],
  'EBS_Snapshot': ['delete-orphaned', 'snapshot-cleanup'],
  'ElasticIP': ['release-eip'],
  'NATGateway': ['delete-unused', 'nat-consolidation'],
  'LoadBalancer': ['delete-unused', 'lb-consolidation'],
  'S3': ['storage-tiering'],
  'Lambda': ['delete-unused', 'lambda-rightsizing'],
};

// Test cases
interface TestCase {
  name: string;
  resource: any;
  expectedTypes: string[]; // One or more valid types
}

const testCases: TestCase[] = [
  // EC2 - always rightsizing
  {
    name: 'EC2: Low utilization gets rightsizing',
    resource: { resourceType: 'EC2', utilizationMetrics: { cpuUtilization: 5, memoryUtilization: 5 } },
    expectedTypes: ['rightsizing']
  },
  {
    name: 'EC2: No metrics still gets rightsizing',
    resource: { resourceType: 'EC2', utilizationMetrics: {} },
    expectedTypes: ['rightsizing']
  },

  // RDS - always rightsizing
  {
    name: 'RDS: Low CPU gets rightsizing',
    resource: { resourceType: 'RDS', utilizationMetrics: { cpuUtilization: 8 } },
    expectedTypes: ['rightsizing']
  },

  // Redshift - rightsizing or scheduling
  {
    name: 'Redshift: Gets rightsizing or scheduling',
    resource: { resourceType: 'Redshift', utilizationMetrics: { cpuUtilization: 15 } },
    expectedTypes: ['rightsizing', 'scheduling']
  },

  // EBS - depends on attachment state
  {
    name: 'EBS: Unattached (state=available) gets delete-unattached',
    resource: {
      resourceType: 'EBS',
      utilizationMetrics: {},
      currentConfig: { state: 'available', volumeType: 'gp3' }
    },
    expectedTypes: ['delete-unattached']
  },
  {
    name: 'EBS: Attached gets volume-rightsizing',
    resource: {
      resourceType: 'EBS',
      utilizationMetrics: {},
      currentConfig: { state: 'in-use', attachedTo: 'i-123', volumeType: 'gp3' }
    },
    expectedTypes: ['volume-rightsizing']
  },
  {
    name: 'EBS: No attachedTo gets delete-unattached',
    resource: {
      resourceType: 'EBS',
      utilizationMetrics: {},
      currentConfig: { state: 'in-use', volumeType: 'gp3' }
    },
    expectedTypes: ['delete-unattached']
  },

  // EBS_Snapshot - depends on source volume
  {
    name: 'EBS_Snapshot: Orphaned gets delete-orphaned',
    resource: {
      resourceType: 'EBS_Snapshot',
      utilizationMetrics: { sourceVolumeExists: false, ageInDays: 30 }
    },
    expectedTypes: ['delete-orphaned']
  },
  {
    name: 'EBS_Snapshot: Source exists gets snapshot-cleanup',
    resource: {
      resourceType: 'EBS_Snapshot',
      utilizationMetrics: { sourceVolumeExists: true, ageInDays: 180 }
    },
    expectedTypes: ['snapshot-cleanup']
  },
  {
    name: 'EBS_Snapshot: Missing sourceVolumeExists gets snapshot-cleanup',
    resource: {
      resourceType: 'EBS_Snapshot',
      utilizationMetrics: { ageInDays: 180 }
    },
    expectedTypes: ['snapshot-cleanup']
  },

  // ElasticIP - always release-eip
  {
    name: 'ElasticIP: Always gets release-eip',
    resource: {
      resourceType: 'ElasticIP',
      utilizationMetrics: { isAssociated: false }
    },
    expectedTypes: ['release-eip']
  },

  // NATGateway - depends on idle percentage
  {
    name: 'NATGateway: Very idle (95%) gets delete-unused',
    resource: {
      resourceType: 'NATGateway',
      utilizationMetrics: { idleTimePercent: 95, bytesProcessed: 1000 }
    },
    expectedTypes: ['delete-unused']
  },
  {
    name: 'NATGateway: Moderately idle (80%) gets nat-consolidation',
    resource: {
      resourceType: 'NATGateway',
      utilizationMetrics: { idleTimePercent: 80, bytesProcessed: 1000 }
    },
    expectedTypes: ['nat-consolidation']
  },
  {
    name: 'NATGateway: Missing idleTimePercent gets nat-consolidation',
    resource: {
      resourceType: 'NATGateway',
      utilizationMetrics: { bytesProcessed: 1000 }
    },
    expectedTypes: ['nat-consolidation']
  },

  // LoadBalancer - depends on healthy hosts
  {
    name: 'LoadBalancer: No healthy hosts gets delete-unused',
    resource: {
      resourceType: 'LoadBalancer',
      utilizationMetrics: { healthyHostCount: 0, requestCount: 0 }
    },
    expectedTypes: ['delete-unused']
  },
  {
    name: 'LoadBalancer: Has healthy hosts gets lb-consolidation',
    resource: {
      resourceType: 'LoadBalancer',
      utilizationMetrics: { healthyHostCount: 2, requestCount: 100 }
    },
    expectedTypes: ['lb-consolidation']
  },
  {
    name: 'LoadBalancer: Missing healthyHostCount gets lb-consolidation',
    resource: {
      resourceType: 'LoadBalancer',
      utilizationMetrics: { requestCount: 0 }
    },
    expectedTypes: ['lb-consolidation']
  },

  // S3 - always storage-tiering
  {
    name: 'S3: Always gets storage-tiering',
    resource: {
      resourceType: 'S3',
      utilizationMetrics: { hasLifecyclePolicy: false }
    },
    expectedTypes: ['storage-tiering']
  },

  // Lambda - depends on invocations
  {
    name: 'Lambda: Zero invocations gets delete-unused',
    resource: {
      resourceType: 'Lambda',
      utilizationMetrics: { invocations: 0, memoryUtilization: 50 }
    },
    expectedTypes: ['delete-unused']
  },
  {
    name: 'Lambda: Low invocations (<100) gets delete-unused',
    resource: {
      resourceType: 'Lambda',
      utilizationMetrics: { invocations: 50, memoryUtilization: 50 }
    },
    expectedTypes: ['delete-unused']
  },
  {
    name: 'Lambda: High invocations gets lambda-rightsizing',
    resource: {
      resourceType: 'Lambda',
      utilizationMetrics: { invocations: 1000, memoryUtilization: 30 }
    },
    expectedTypes: ['lambda-rightsizing']
  },
  {
    name: 'Lambda: Exactly 100 invocations gets lambda-rightsizing',
    resource: {
      resourceType: 'Lambda',
      utilizationMetrics: { invocations: 100, memoryUtilization: 30 }
    },
    expectedTypes: ['lambda-rightsizing']
  },

  // Unknown types - should get rightsizing
  {
    name: 'Unknown type gets rightsizing',
    resource: {
      resourceType: 'CustomResource',
      utilizationMetrics: {}
    },
    expectedTypes: ['rightsizing']
  },
];

// Run tests
async function runTests() {
  console.log('='.repeat(80));
  console.log('RECOMMENDATION TYPE ASSIGNMENT TEST SUITE');
  console.log('Testing that recommendation types are sensible for each resource');
  console.log('='.repeat(80));
  console.log();

  let passed = 0;
  let failed = 0;
  const failures: { name: string; expected: string[]; got: string }[] = [];

  for (const tc of testCases) {
    // For Redshift, run multiple times since it's random
    if (tc.resource.resourceType === 'Redshift') {
      let allValid = true;
      const seen = new Set<string>();

      for (let i = 0; i < 100; i++) {
        const recType = getRecommendationType(tc.resource);
        seen.add(recType);
        if (!tc.expectedTypes.includes(recType)) {
          allValid = false;
          failures.push({
            name: tc.name,
            expected: tc.expectedTypes,
            got: recType
          });
          break;
        }
      }

      if (allValid) {
        console.log(`✅ ${tc.name}`);
        console.log(`   Seen types: ${Array.from(seen).join(', ')}`);
        passed++;
      } else {
        console.log(`❌ ${tc.name}`);
        failed++;
      }
    } else {
      const recType = getRecommendationType(tc.resource);
      const isValid = tc.expectedTypes.includes(recType);

      if (isValid) {
        console.log(`✅ ${tc.name}`);
        passed++;
      } else {
        console.log(`❌ ${tc.name}`);
        console.log(`   Expected: ${tc.expectedTypes.join(' or ')}`);
        console.log(`   Got: ${recType}`);
        failures.push({
          name: tc.name,
          expected: tc.expectedTypes,
          got: recType
        });
        failed++;
      }
    }
  }

  // Additional test: run 10000 random resources and verify types are always valid
  console.log('\n' + '-'.repeat(80));
  console.log('STRESS TEST: 10,000 random resources');
  console.log('-'.repeat(80));

  let stressFailures = 0;
  const resourceTypes = Object.keys(VALID_TYPES);

  for (let i = 0; i < 10000; i++) {
    const resourceType = resourceTypes[Math.floor(Math.random() * resourceTypes.length)];
    const resource = {
      resourceType,
      utilizationMetrics: {
        cpuUtilization: Math.random() * 100,
        memoryUtilization: Math.random() * 100,
        idleTimePercent: Math.random() * 100,
        healthyHostCount: Math.floor(Math.random() * 5),
        invocations: Math.floor(Math.random() * 1000),
        sourceVolumeExists: Math.random() < 0.5
      },
      currentConfig: {
        state: Math.random() < 0.5 ? 'available' : 'in-use',
        attachedTo: Math.random() < 0.5 ? 'i-123' : null,
        volumeType: ['gp2', 'gp3', 'io1', 'io2'][Math.floor(Math.random() * 4)]
      }
    };

    const recType = getRecommendationType(resource);
    const validTypes = VALID_TYPES[resourceType];

    if (!validTypes.includes(recType)) {
      stressFailures++;
      if (stressFailures <= 3) {
        console.log(`  Invalid: ${resourceType} got ${recType}, expected ${validTypes.join(' or ')}`);
      }
    }
  }

  if (stressFailures === 0) {
    console.log(`✅ 10,000 random resources all got valid recommendation types`);
  } else {
    console.log(`❌ ${stressFailures} invalid recommendation types`);
    failed += stressFailures;
  }

  console.log('\n' + '='.repeat(80));
  if (failed === 0) {
    console.log(`✅ ALL RECOMMENDATION TYPE TESTS PASSED`);
    console.log('Recommendation types are always sensible for each resource type!');
  } else {
    console.log(`❌ ${failed} TESTS FAILED (${passed} explicit tests passed)`);
    console.log('\nFailed tests:');
    for (const f of failures.slice(0, 10)) {
      console.log(`  - ${f.name}: expected ${f.expected.join(' or ')}, got ${f.got}`);
    }
    process.exit(1);
  }
  console.log('='.repeat(80));
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
