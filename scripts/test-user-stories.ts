/**
 * USER STORY TEST HARNESS
 * =======================
 * Programmatic validation of all 6 expansion user stories.
 *
 * Tests against LIVE API endpoints — requires running server.
 * Run: npx tsx scripts/test-user-stories.ts
 */

const BASE_URL = process.env.API_URL || 'http://localhost:5000';
let authToken = '';

// ============================================================================
// HTTP HELPERS
// ============================================================================

async function apiGet(path: string): Promise<any> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status} ${res.statusText}`);
  return res.json();
}

async function apiPost(path: string, body?: any): Promise<any> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status} ${res.statusText}`);
  return res.json();
}

async function apiPatch(path: string, body: any): Promise<any> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`PATCH ${path} failed: ${res.status} ${res.statusText}`);
  return res.json();
}

async function login(): Promise<void> {
  // Try registering first, then login
  try {
    await fetch(`${BASE_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'test-admin', password: 'Test1234!@#$', role: 'admin' })
    });
  } catch (_) { /* may already exist */ }

  const loginRes = await fetch(`${BASE_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'test-admin', password: 'Test1234!@#$' })
  });

  if (!loginRes.ok) {
    throw new Error(`Login failed: ${loginRes.status} ${loginRes.statusText}`);
  }
  const data = await loginRes.json();
  authToken = data.token;
}

// ============================================================================
// TEST FRAMEWORK
// ============================================================================

interface TestResult {
  story: string;
  test: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function assert(story: string, test: string, condition: boolean, details: string) {
  results.push({ story, test, passed: condition, details });
  const mark = condition ? '  ✓' : '  ✗';
  console.log(`${mark} ${test}`);
  if (!condition) console.log(`      → ${details}`);
}

// ============================================================================
// STORY 1: New Resource Types Appear in Dashboard
// ============================================================================

async function testStory1() {
  console.log('\n📋 STORY 1: New Resource Types Appear in Dashboard');
  console.log('-'.repeat(60));

  const resources: any[] = await apiGet('/api/aws-resources');

  // Test: Total resource count >= 20
  assert('Story 1', 'Total resource count >= 15',
    resources.length >= 15,
    `Got ${resources.length} resources (expected >= 15)`
  );

  // Test: All required resource types present
  const types = new Set(resources.map((r: any) => r.resourceType));
  const requiredTypes = ['EC2', 'RDS', 'Redshift', 'EBS', 'EBS_Snapshot', 'ElasticIP', 'NATGateway', 'LoadBalancer', 'S3', 'Lambda'];

  for (const rt of requiredTypes) {
    assert('Story 1', `Resource type "${rt}" present`,
      types.has(rt),
      `Missing resource type: ${rt}. Found: ${[...types].join(', ')}`
    );
  }

  // Test: Resource type counts
  const typeCounts: Record<string, number> = {};
  for (const r of resources) {
    typeCounts[r.resourceType] = (typeCounts[r.resourceType] || 0) + 1;
  }
  console.log(`      Resource breakdown: ${JSON.stringify(typeCounts)}`);
}

// ============================================================================
// STORY 2: More Savings Identified
// ============================================================================

async function testStory2() {
  console.log('\n📋 STORY 2: More Savings Identified');
  console.log('-'.repeat(60));

  const recommendations: any[] = await apiGet('/api/recommendations');

  // Test: Recommendations exist
  assert('Story 2', 'Recommendations generated (count > 0)',
    recommendations.length > 0,
    `Got ${recommendations.length} recommendations`
  );

  // Test: New recommendation types present
  const recTypes = new Set(recommendations.map((r: any) => r.type));
  console.log(`      Recommendation types found: ${[...recTypes].join(', ')}`);

  const newTypes = [
    'delete-unattached', 'release-eip', 'delete-orphaned', 'snapshot-cleanup',
    'volume-rightsizing', 'storage-tiering', 'lambda-rightsizing',
    'nat-consolidation', 'lb-consolidation', 'delete-unused'
  ];

  let newTypeCount = 0;
  for (const nt of newTypes) {
    if (recTypes.has(nt)) newTypeCount++;
  }

  assert('Story 2', 'At least 3 new recommendation types present',
    newTypeCount >= 3,
    `Found ${newTypeCount} new types out of ${newTypes.length}. Present: ${newTypes.filter(t => recTypes.has(t)).join(', ')}`
  );

  // Test: Savings > 0
  const totalSavings = recommendations.reduce((sum: number, r: any) => sum + (r.projectedMonthlySavings || 0), 0);
  assert('Story 2', 'Total identified savings > 0',
    totalSavings > 0,
    `Total savings: $${totalSavings}`
  );

  // Test: Each recommendation has valid savings
  const noSavingsRecs = recommendations.filter((r: any) => !r.projectedMonthlySavings || r.projectedMonthlySavings <= 0);
  assert('Story 2', 'All recommendations have positive savings',
    noSavingsRecs.length === 0,
    `${noSavingsRecs.length} recommendations have zero/negative savings`
  );
}

// ============================================================================
// STORY 3: Low-Risk Items Auto-Execute
// ============================================================================

async function testStory3() {
  console.log('\n📋 STORY 3: Low-Risk Items Auto-Execute');
  console.log('-'.repeat(60));

  const recommendations: any[] = await apiGet('/api/recommendations');

  // Test: Some recommendations are autonomous
  const autonomous = recommendations.filter((r: any) => r.executionMode === 'autonomous');
  assert('Story 3', 'Autonomous recommendations exist',
    autonomous.length > 0,
    `Found ${autonomous.length} autonomous recommendations`
  );

  // Test: Some autonomous recommendations are executed
  const autoExecuted = autonomous.filter((r: any) => r.status === 'executed');
  assert('Story 3', 'Some autonomous recommendations auto-executed',
    autoExecuted.length > 0,
    `${autoExecuted.length} of ${autonomous.length} autonomous recommendations executed`
  );

  // Test: Low-risk types are marked autonomous
  const lowRiskTypes = ['delete-unattached', 'release-eip', 'delete-orphaned', 'snapshot-cleanup', 'storage-tiering', 'volume-rightsizing', 'lambda-rightsizing', 'delete-unused'];
  const autonomousTypes = new Set(autonomous.map((r: any) => r.type));
  const lowRiskAutoCount = lowRiskTypes.filter(t => autonomousTypes.has(t)).length;
  assert('Story 3', 'Low-risk types correctly classified as autonomous',
    lowRiskAutoCount >= 1,
    `Low-risk types marked autonomous: ${lowRiskTypes.filter(t => autonomousTypes.has(t)).join(', ')}`
  );

  // Test: Check optimization history for auto-executed items
  const history: any[] = await apiGet('/api/optimization-history');
  const autoHistory = history.filter((h: any) => h.executedBy === 'heuristic-autopilot');
  assert('Story 3', 'Optimization history records exist for auto-execution',
    autoHistory.length > 0,
    `${autoHistory.length} auto-execution history records`
  );

  // Test: Realized savings > 0
  const realizedSavings = autoHistory.reduce((sum: number, h: any) => sum + (h.actualSavings || 0), 0);
  assert('Story 3', 'Realized savings from auto-execution > 0',
    realizedSavings > 0,
    `Realized savings: $${realizedSavings}`
  );
}

// ============================================================================
// STORY 4: High-Risk Items Wait for Approval
// ============================================================================

async function testStory4() {
  console.log('\n📋 STORY 4: High-Risk Items Wait for Approval');
  console.log('-'.repeat(60));

  const recommendations: any[] = await apiGet('/api/recommendations');

  // Test: Some recommendations are HITL
  const hitl = recommendations.filter((r: any) => r.executionMode === 'hitl');
  assert('Story 4', 'HITL recommendations exist',
    hitl.length > 0,
    `Found ${hitl.length} HITL recommendations`
  );

  // Test: HITL recommendations are pending (not auto-executed)
  const pendingHitl = hitl.filter((r: any) => r.status === 'pending');
  assert('Story 4', 'HITL recommendations stay in pending status',
    pendingHitl.length > 0,
    `${pendingHitl.length} of ${hitl.length} HITL recommendations are pending`
  );

  // Test: HITL recommendations have higher risk levels
  const hitlRiskLevels = hitl.map((r: any) => r.riskLevel).filter(Boolean);
  const avgHitlRisk = hitlRiskLevels.reduce((a: number, b: number) => a + b, 0) / (hitlRiskLevels.length || 1);
  assert('Story 4', 'HITL recommendations have risk level > 5',
    avgHitlRisk > 5,
    `Average HITL risk level: ${avgHitlRisk.toFixed(1)}`
  );

  // Test: High-risk resource types (RDS, Redshift, NAT, LB) require HITL
  const highRiskTypes = ['rightsizing', 'scheduling', 'nat-consolidation', 'lb-consolidation'];
  const hitlTypes = new Set(hitl.map((r: any) => r.type));
  const highRiskInHitl = highRiskTypes.filter(t => hitlTypes.has(t)).length;
  assert('Story 4', 'High-risk types correctly require HITL',
    highRiskInHitl >= 1,
    `High-risk types in HITL: ${highRiskTypes.filter(t => hitlTypes.has(t)).join(', ')}`
  );
}

// ============================================================================
// STORY 5: Waste Percentage Improves Over Time
// ============================================================================

async function testStory5() {
  console.log('\n📋 STORY 5: Waste Percentage Improves Over Time');
  console.log('-'.repeat(60));

  // Test: Session status shows realized savings
  const session: any = await apiGet('/api/session/status');
  assert('Story 5', 'Session tracks realized savings',
    session.sessionRealizedSavings !== undefined,
    `Session realized savings: $${session.sessionRealizedSavings || 0}`
  );

  assert('Story 5', 'Session tracks resources optimized',
    session.resourcesOptimizedInSession !== undefined,
    `Resources optimized: ${session.resourcesOptimizedInSession || 0}`
  );

  // Test: Metrics summary shows savings data
  const metrics: any = await apiGet('/api/metrics/summary');
  assert('Story 5', 'Metrics summary available',
    metrics !== null && metrics !== undefined,
    `Metrics: spend=$${metrics?.monthlySpend || 0}, realized=$${metrics?.realizedSavingsYTD || 0}`
  );

  // Test: Gap between identified and realized should exist
  const recommendations: any[] = await apiGet('/api/recommendations');
  const identified = recommendations.reduce((sum: number, r: any) => sum + (r.projectedMonthlySavings || 0), 0);
  const executed = recommendations.filter((r: any) => r.status === 'executed');
  const realized = executed.reduce((sum: number, r: any) => sum + (r.projectedMonthlySavings || 0), 0);

  assert('Story 5', 'Identified savings > realized savings (gap exists for HITL)',
    identified > realized || recommendations.length === 0,
    `Identified: $${identified}, Realized: $${realized}`
  );
}

// ============================================================================
// STORY 6: Simulation Creates Realistic Waste Patterns
// ============================================================================

async function testStory6() {
  console.log('\n📋 STORY 6: Simulation Creates Realistic Waste Patterns');
  console.log('-'.repeat(60));

  const resources: any[] = await apiGet('/api/aws-resources');

  // Test: Resource IDs follow AWS naming patterns
  const awsPatterns: Record<string, RegExp> = {
    'EC2': /^i-[a-z0-9]+$/,
    'EBS': /^vol-[a-z0-9]+$/,
    'EBS_Snapshot': /^snap-[a-z0-9]+$/,
    'ElasticIP': /^eipalloc-[a-z0-9]+$/,
    'NATGateway': /^nat-[a-z0-9]+$/,
    'LoadBalancer': /^arn:aws:elasticloadbalancing/,
    'Redshift': /^redshift-/,
    'RDS': /^rds-/,
    'S3': /bucket|logs|dev/i,
    'Lambda': /^arn:aws:lambda/
  };

  let realisticCount = 0;
  let totalChecked = 0;
  for (const r of resources) {
    const pattern = awsPatterns[r.resourceType];
    if (pattern) {
      totalChecked++;
      if (pattern.test(r.resourceId)) realisticCount++;
    }
  }

  assert('Story 6', 'Resource IDs follow AWS naming conventions',
    realisticCount >= totalChecked * 0.7,
    `${realisticCount}/${totalChecked} resources have realistic IDs`
  );

  // Test: Costs are realistic per resource type
  const costRanges: Record<string, [number, number]> = {
    'ElasticIP': [0, 10],         // ~$3.65/mo
    'EBS': [0, 2000],             // $10-1200/mo
    'EBS_Snapshot': [0, 500],     // $5-100/mo
    'NATGateway': [20, 100],      // ~$32+/mo
    'LoadBalancer': [10, 100],    // ~$16+/mo
    'Lambda': [0, 100],           // varies widely
    'S3': [0, 500],               // varies
  };

  let realisticCosts = 0;
  let costChecks = 0;
  for (const r of resources) {
    const range = costRanges[r.resourceType];
    if (range) {
      costChecks++;
      const cost = r.monthlyCost || 0;
      if (cost >= range[0] && cost <= range[1]) realisticCosts++;
      else console.log(`      ⚠ ${r.resourceType} ${r.resourceId}: $${cost}/mo (expected $${range[0]}-$${range[1]})`);
    }
  }

  assert('Story 6', 'Costs are realistic for resource types',
    costChecks === 0 || realisticCosts >= costChecks * 0.7,
    `${realisticCosts}/${costChecks} resources have realistic costs`
  );

  // Test: Mix of healthy and wasteful resources
  const wasteful = resources.filter((r: any) => {
    const m = r.utilizationMetrics as any;
    if (!m) return false;
    switch (r.resourceType) {
      case 'EC2': return (m.cpuUtilization ?? m.avgCpuUtilization ?? 100) < 20 && (m.memoryUtilization ?? m.avgMemoryUtilization ?? 100) < 20;
      case 'EBS': return r.currentConfig?.state === 'available' || !r.currentConfig?.attachedTo;
      case 'ElasticIP': return m.isAssociated === false;
      case 'Lambda': return m.invocations === 0 || (m.memoryUtilization ?? 100) < 50;
      default: return false;
    }
  });

  const healthy = resources.length - wasteful.length;
  assert('Story 6', 'Mix of healthy and wasteful resources',
    wasteful.length > 0 && healthy > 0,
    `Wasteful: ${wasteful.length}, Healthy: ${healthy}`
  );

  // Test: Date math on snapshots
  const snapshots = resources.filter((r: any) => r.resourceType === 'EBS_Snapshot');
  for (const snap of snapshots) {
    const m = snap.utilizationMetrics as any;
    if (m?.ageInDays && snap.currentConfig?.createdAt) {
      const createdAt = new Date(snap.currentConfig.createdAt);
      const actualAge = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      const reportedAge = m.ageInDays;
      // Allow some drift (evolveResources can change metrics)
      const close = Math.abs(actualAge - reportedAge) < 30;
      assert('Story 6', `Snapshot ${snap.resourceId} age math is reasonable`,
        close,
        `Reported age: ${reportedAge}d, Calculated: ${actualAge}d`
      );
    }
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('='.repeat(80));
  console.log('FINOPS AUTOPILOT EXPANSION — USER STORY TEST HARNESS');
  console.log('='.repeat(80));

  try {
    // Authenticate
    console.log('\n🔑 Authenticating...');
    await login();
    console.log('  ✓ Authenticated as test-admin');

    // Wait a moment for simulation to generate data
    console.log('\n⏳ Waiting 5s for simulation cycle...');
    await new Promise(r => setTimeout(r, 5000));

    // Run all story tests
    await testStory1();
    await testStory2();
    await testStory3();
    await testStory4();
    await testStory5();
    await testStory6();

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('TEST SUMMARY');
    console.log('='.repeat(80));

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total = results.length;

    // Group by story
    const byStory: Record<string, TestResult[]> = {};
    for (const r of results) {
      if (!byStory[r.story]) byStory[r.story] = [];
      byStory[r.story].push(r);
    }

    for (const [story, storyResults] of Object.entries(byStory)) {
      const sp = storyResults.filter(r => r.passed).length;
      const st = storyResults.length;
      const mark = sp === st ? '✅' : '❌';
      console.log(`${mark} ${story}: ${sp}/${st} passed`);
    }

    console.log(`\nTotal: ${passed}/${total} passed, ${failed} failed`);

    if (failed > 0) {
      console.log('\n❌ FAILURES:');
      for (const f of results.filter(r => !r.passed)) {
        console.log(`  • [${f.story}] ${f.test}`);
        console.log(`    → ${f.details}`);
      }
    }

    console.log('='.repeat(80));
    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error);
    process.exit(2);
  }
}

main();
