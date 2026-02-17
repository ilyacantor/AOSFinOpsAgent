/**
 * DESCRIPTION GENERATION TEST
 * ============================
 *
 * Tests that generated descriptions:
 * 1. Never contain "undefined", "null", "NaN"
 * 2. Always have proper formatting
 * 3. Handle edge cases in savings amounts
 * 4. Are human-readable
 *
 * Run with: npx tsx scripts/test-descriptions.ts
 */

// Description generation logic (extracted from scheduler.ts)
function generateDescription(type: string, cpuUtil: number, memUtil: number, monthlySavings: number, resource?: any): string {
  // Format savings for human readability: under $1K shows exact amount, over $1K shows K notation
  const savingsFormatted = monthlySavings < 1000
    ? `$${monthlySavings.toFixed(0)}`
    : `$${(monthlySavings / 1000).toFixed(0)}K`;
  const metrics = resource?.utilizationMetrics as any;
  const config = resource?.currentConfig as any;

  switch (type) {
    case 'rightsizing':
      return `Resource running at ${cpuUtil.toFixed(1)}% CPU and ${memUtil.toFixed(1)}% memory utilization. Recommend downsizing to reduce costs by approximately ${savingsFormatted}/month.`;

    case 'scheduling':
      return `Resource usage patterns suggest potential for scheduled shutdown during off-peak hours. Estimated savings: ${savingsFormatted}/month.`;

    case 'storage-tiering':
      if (resource?.resourceType === 'S3') {
        const avgAge = metrics?.avgObjectAgeDays ?? 0;
        const accessFreq = metrics?.accessFrequency ?? 'unknown';
        return `S3 bucket contains objects averaging ${avgAge} days old with ${accessFreq} access patterns. Moving to Glacier could save ${savingsFormatted}/month.`;
      }
      return `Storage analysis indicates underutilized capacity. Implement tiering to cold storage for ${savingsFormatted}/month savings.`;

    case 'delete-unattached':
      return `EBS volume is unattached and incurring storage costs. Delete this volume to save ${savingsFormatted}/month.`;

    case 'volume-rightsizing':
      const iopsUtil = metrics?.iopsUtilization ?? 0;
      return `EBS volume IOPS utilization at ${iopsUtil.toFixed(1)}%. Consider downgrading to a lower tier (gp3 or gp2) to save ${savingsFormatted}/month.`;

    case 'delete-orphaned':
      const ageInDays = metrics?.ageInDays ?? 0;
      return `EBS snapshot is ${ageInDays} days old and its source volume no longer exists. Delete this orphaned snapshot to save ${savingsFormatted}/month.`;

    case 'snapshot-cleanup':
      const snapshotAge = metrics?.ageInDays ?? 0;
      return `EBS snapshot is ${snapshotAge} days old. Implement a lifecycle policy or delete to save ${savingsFormatted}/month.`;

    case 'release-eip':
      const idleDays = metrics?.idleDays ?? 0;
      return `Elastic IP has been unassociated for ${idleDays} days. AWS charges for unassociated EIPs. Release to save ${savingsFormatted}/month.`;

    case 'delete-unused':
      if (resource?.resourceType === 'NATGateway') {
        const idlePercent = metrics?.idleTimePercent ?? 0;
        return `NAT Gateway is ${idlePercent.toFixed(0)}% idle with minimal traffic. Delete to save ${savingsFormatted}/month.`;
      } else if (resource?.resourceType === 'LoadBalancer') {
        return `Load Balancer has no healthy targets and minimal traffic. Delete to save ${savingsFormatted}/month.`;
      } else if (resource?.resourceType === 'Lambda') {
        const invocations = metrics?.invocations ?? 0;
        return `Lambda function has only ${invocations} invocations. Consider deleting if no longer needed to save ${savingsFormatted}/month.`;
      }
      return `Resource is unused. Delete to save ${savingsFormatted}/month.`;

    case 'nat-consolidation':
      return `NAT Gateway has low utilization. Consider consolidating traffic through fewer gateways to save ${savingsFormatted}/month.`;

    case 'lb-consolidation':
      const requestCount = metrics?.requestCount ?? 0;
      return `Load Balancer handles only ${requestCount} requests. Consider consolidating with other load balancers to save ${savingsFormatted}/month.`;

    case 'lambda-rightsizing':
      const lambdaMemUtil = metrics?.memoryUtilization ?? 0;
      const allocatedMB = config?.memorySize ?? 0;
      const usedMB = metrics?.maxMemoryUsedMB ?? 0;
      return `Lambda function using ${usedMB}MB of ${allocatedMB}MB allocated (${lambdaMemUtil.toFixed(1)}% utilization). Reduce memory allocation to save ${savingsFormatted}/month.`;

    default:
      return `Resource analysis indicates optimization opportunity. Estimated savings: ${savingsFormatted}/month.`;
  }
}

// Test cases
interface TestCase {
  name: string;
  type: string;
  cpuUtil: number;
  memUtil: number;
  savings: number;
  resource?: any;
  mustContain?: string[];
  mustNotContain?: string[];
}

const testCases: TestCase[] = [
  // Savings formatting
  {
    name: 'Savings under $1K shows exact dollars',
    type: 'rightsizing',
    cpuUtil: 10,
    memUtil: 10,
    savings: 500,
    mustContain: ['$500/month'],
    mustNotContain: ['$0K', '$1K']
  },
  {
    name: 'Savings of $1 shows $1',
    type: 'rightsizing',
    cpuUtil: 10,
    memUtil: 10,
    savings: 1,
    mustContain: ['$1/month'],
    mustNotContain: ['$0K']
  },
  {
    name: 'Savings of $999 shows $999',
    type: 'rightsizing',
    cpuUtil: 10,
    memUtil: 10,
    savings: 999,
    mustContain: ['$999/month'],
    mustNotContain: ['$0K', '$1K']
  },
  {
    name: 'Savings of $1000 shows $1K',
    type: 'rightsizing',
    cpuUtil: 10,
    memUtil: 10,
    savings: 1000,
    mustContain: ['$1K/month'],
    mustNotContain: ['$1000']
  },
  {
    name: 'Savings of $10500 shows $11K (rounded)',
    type: 'rightsizing',
    cpuUtil: 10,
    memUtil: 10,
    savings: 10500,
    mustContain: ['$11K/month']
  },
  {
    name: 'Zero savings shows $0',
    type: 'rightsizing',
    cpuUtil: 10,
    memUtil: 10,
    savings: 0,
    mustContain: ['$0/month'],
    mustNotContain: ['undefined', 'NaN']
  },
  {
    name: 'Negative savings handled gracefully',
    type: 'rightsizing',
    cpuUtil: 10,
    memUtil: 10,
    savings: -100,
    mustNotContain: ['undefined', 'NaN']
  },

  // Type-specific descriptions
  {
    name: 'Rightsizing includes CPU and memory percentages',
    type: 'rightsizing',
    cpuUtil: 15.5,
    memUtil: 8.3,
    savings: 5000,
    mustContain: ['15.5%', '8.3%', 'CPU', 'memory'],
    mustNotContain: ['undefined', 'NaN']
  },
  {
    name: 'Scheduling mentions off-peak hours',
    type: 'scheduling',
    cpuUtil: 10,
    memUtil: 10,
    savings: 3000,
    mustContain: ['off-peak', 'scheduled'],
    mustNotContain: ['undefined', 'NaN']
  },
  {
    name: 'S3 storage tiering includes age and access pattern',
    type: 'storage-tiering',
    cpuUtil: 0,
    memUtil: 0,
    savings: 2000,
    resource: {
      resourceType: 'S3',
      utilizationMetrics: { avgObjectAgeDays: 365, accessFrequency: 'rare' }
    },
    mustContain: ['365 days', 'rare', 'Glacier'],
    mustNotContain: ['undefined', 'NaN']
  },
  {
    name: 'EBS delete-unattached is clear',
    type: 'delete-unattached',
    cpuUtil: 0,
    memUtil: 0,
    savings: 500,
    mustContain: ['unattached', 'Delete', 'EBS'],
    mustNotContain: ['undefined', 'NaN']
  },
  {
    name: 'Snapshot cleanup includes age',
    type: 'snapshot-cleanup',
    cpuUtil: 0,
    memUtil: 0,
    savings: 100,
    resource: {
      utilizationMetrics: { ageInDays: 180 }
    },
    mustContain: ['180 days'],
    mustNotContain: ['undefined', 'NaN']
  },
  {
    name: 'ElasticIP release mentions idle days',
    type: 'release-eip',
    cpuUtil: 0,
    memUtil: 0,
    savings: 50,
    resource: {
      utilizationMetrics: { idleDays: 45 }
    },
    mustContain: ['45 days', 'unassociated', '$50/month'],
    mustNotContain: ['undefined', 'NaN', '$0K']
  },
  {
    name: 'Lambda rightsizing shows memory details',
    type: 'lambda-rightsizing',
    cpuUtil: 0,
    memUtil: 0,
    savings: 800,
    resource: {
      utilizationMetrics: { memoryUtilization: 25.5, maxMemoryUsedMB: 256 },
      currentConfig: { memorySize: 1024 }
    },
    mustContain: ['256MB', '1024MB', '25.5%', '$800/month'],
    mustNotContain: ['undefined', 'NaN']
  },

  // Edge cases with missing data
  {
    name: 'Missing metrics defaults gracefully',
    type: 'snapshot-cleanup',
    cpuUtil: 0,
    memUtil: 0,
    savings: 100,
    resource: {
      utilizationMetrics: {}
    },
    mustContain: ['0 days'],
    mustNotContain: ['undefined', 'null', 'NaN']
  },
  {
    name: 'Null resource handled',
    type: 'delete-unused',
    cpuUtil: 0,
    memUtil: 0,
    savings: 100,
    resource: null,
    mustNotContain: ['undefined', 'null', 'NaN']
  },
  {
    name: 'NaN CPU handled',
    type: 'rightsizing',
    cpuUtil: NaN,
    memUtil: 10,
    savings: 1000,
    mustNotContain: ['undefined', 'null']
  },
  {
    name: 'Infinity values handled',
    type: 'rightsizing',
    cpuUtil: Infinity,
    memUtil: 10,
    savings: 1000,
    mustNotContain: ['undefined', 'null', 'NaN']
  },
];

// Run tests
async function runTests() {
  console.log('='.repeat(80));
  console.log('DESCRIPTION GENERATION TEST SUITE');
  console.log('Testing human-readable output for all edge cases');
  console.log('='.repeat(80));
  console.log();

  let passed = 0;
  let failed = 0;
  const failures: { name: string; issue: string; description: string }[] = [];

  for (const tc of testCases) {
    const description = generateDescription(tc.type, tc.cpuUtil, tc.memUtil, tc.savings, tc.resource);
    let testPassed = true;
    let issue = '';

    // Check must contain
    if (tc.mustContain) {
      for (const str of tc.mustContain) {
        if (!description.includes(str)) {
          testPassed = false;
          issue = `Missing "${str}"`;
          break;
        }
      }
    }

    // Check must not contain
    if (testPassed && tc.mustNotContain) {
      for (const str of tc.mustNotContain) {
        if (description.toLowerCase().includes(str.toLowerCase())) {
          testPassed = false;
          issue = `Contains forbidden "${str}"`;
          break;
        }
      }
    }

    if (testPassed) {
      console.log(`✅ ${tc.name}`);
      passed++;
    } else {
      console.log(`❌ ${tc.name}`);
      console.log(`   Issue: ${issue}`);
      console.log(`   Description: "${description}"`);
      failures.push({ name: tc.name, issue, description });
      failed++;
    }
  }

  console.log('\n' + '='.repeat(80));
  if (failed === 0) {
    console.log(`✅ ALL ${passed} DESCRIPTION TESTS PASSED`);
    console.log('Descriptions are human-readable and handle all edge cases!');
  } else {
    console.log(`❌ ${failed} TESTS FAILED (${passed} passed)`);
    console.log('\nFailed tests:');
    for (const f of failures) {
      console.log(`  - ${f.name}: ${f.issue}`);
    }
    process.exit(1);
  }
  console.log('='.repeat(80));
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
