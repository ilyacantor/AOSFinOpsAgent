import { storage } from '../storage';
import { InsertAwsResource } from '@shared/schema';

interface SyntheticResourcePattern {
  baseUtilization: number;
  variability: number; // How much it can vary
  trend: 'increasing' | 'decreasing' | 'stable' | 'cyclic';
  cyclePeriod?: number; // Days for cyclic patterns
}

export class SyntheticDataGenerator {
  private resourcePatterns = new Map<string, SyntheticResourcePattern>();
  private startTime = Date.now();

  // Generate initial synthetic dataset
  async generateInitialDataset() {
    console.log('📊 Generating initial synthetic dataset...');

    const syntheticResources: InsertAwsResource[] = [
      // Redshift clusters with different patterns
      // Pricing: dc2.large ~$0.25/hr/node, dc2.8xlarge ~$4.80/hr/node, ra3.4xlarge ~$3.26/hr/node
      {
        tenantId: 'default-tenant',
        resourceId: 'redshift-prod-analytics',
        resourceType: 'Redshift',
        region: 'us-east-1',
        currentConfig: {
          nodeType: 'dc2.8xlarge',
          numberOfNodes: 4,
          clusterIdentifier: 'redshift-prod-analytics'
        },
        utilizationMetrics: {
          cpuUtilization: 35,
          diskUtilization: 45,
          queryCount: 15000
        },
        monthlyCost: 13824, // 4 nodes * $4.80/hr * 720hrs = $13,824/mo
        lastAnalyzed: new Date()
      },
      {
        tenantId: 'default-tenant',
        resourceId: 'redshift-dev-testing',
        resourceType: 'Redshift',
        region: 'us-west-2',
        currentConfig: {
          nodeType: 'dc2.large',
          numberOfNodes: 2,
          clusterIdentifier: 'redshift-dev-testing'
        },
        utilizationMetrics: {
          cpuUtilization: 18,
          diskUtilization: 30,
          queryCount: 2000
        },
        monthlyCost: 360, // 2 nodes * $0.25/hr * 720hrs = $360/mo
        lastAnalyzed: new Date()
      },
      {
        tenantId: 'default-tenant',
        resourceId: 'redshift-data-warehouse',
        resourceType: 'Redshift',
        region: 'eu-west-1',
        currentConfig: {
          nodeType: 'ra3.4xlarge',
          numberOfNodes: 6,
          clusterIdentifier: 'redshift-data-warehouse'
        },
        utilizationMetrics: {
          cpuUtilization: 72,
          diskUtilization: 65,
          queryCount: 48000
        },
        monthlyCost: 14083, // 6 nodes * $3.26/hr * 720hrs = $14,083/mo
        lastAnalyzed: new Date()
      },
      // EC2 instances
      // Pricing: t3.xlarge ~$0.1664/hr, m5.2xlarge ~$0.384/hr (on-demand us-east-1)
      {
        tenantId: 'default-tenant',
        resourceId: 'i-0a1b2c3d4e5f6g7h8',
        resourceType: 'EC2',
        region: 'us-east-1',
        currentConfig: {
          instanceType: 't3.xlarge',
          state: 'running'
        },
        utilizationMetrics: {
          cpuUtilization: 45, // HEALTHY - won't trigger (spec: CPU < 20 AND memory < 20)
          memoryUtilization: 55,
          networkIn: 1024000,
          networkOut: 512000
        },
        monthlyCost: 120, // $0.1664/hr * 720hrs = ~$120/mo
        lastAnalyzed: new Date()
      },
      {
        tenantId: 'default-tenant',
        resourceId: 'i-9h8g7f6e5d4c3b2a1',
        resourceType: 'EC2',
        region: 'us-west-2',
        currentConfig: {
          instanceType: 'm5.2xlarge',
          state: 'running'
        },
        utilizationMetrics: {
          cpuUtilization: 12, // WASTEFUL - both CPU AND memory < 20% (spec page 14)
          memoryUtilization: 8,
          networkIn: 512000,
          networkOut: 256000
        },
        monthlyCost: 277, // $0.384/hr * 720hrs = ~$277/mo
        lastAnalyzed: new Date()
      },
      // RDS instances
      // Pricing: db.r5.2xlarge ~$1.008/hr, db.r5.xlarge ~$0.504/hr + storage ($0.115/GB-month)
      {
        tenantId: 'default-tenant',
        resourceId: 'rds-prod-mysql',
        resourceType: 'RDS',
        region: 'us-east-1',
        currentConfig: {
          instanceClass: 'db.r5.2xlarge',
          engine: 'mysql',
          allocatedStorage: 1000
        },
        utilizationMetrics: {
          cpuUtilization: 38, // HEALTHY - won't trigger (spec: CPU < 20%)
          connectionCount: 145,
          readIOPS: 8500,
          writeIOPS: 3200
        },
        monthlyCost: 841, // $1.008/hr * 720hrs + 1000GB * $0.115 = $726 + $115 = ~$841/mo
        lastAnalyzed: new Date()
      },
      {
        tenantId: 'default-tenant',
        resourceId: 'rds-dev-postgres',
        resourceType: 'RDS',
        region: 'us-west-2',
        currentConfig: {
          instanceClass: 'db.r5.xlarge',
          engine: 'postgres',
          allocatedStorage: 500
        },
        utilizationMetrics: {
          cpuUtilization: 8, // WASTEFUL - CPU < 20% (spec page 14: RDS is CPU-only check)
          connectionCount: 3,
          readIOPS: 200,
          writeIOPS: 50
        },
        monthlyCost: 420, // $0.504/hr * 720hrs + 500GB * $0.115 = $363 + $57 = ~$420/mo
        lastAnalyzed: new Date()
      },
      // ========== NEW RESOURCE TYPES ==========

      // EBS Volumes
      // Pricing: gp3 $0.08/GB + IOPS/throughput, io2 $0.125/GB + $0.065/IOPS
      {
        tenantId: 'default-tenant',
        resourceId: 'vol-0abc123def456gh78',
        resourceType: 'EBS',
        region: 'us-east-1',
        currentConfig: {
          volumeType: 'gp3',
          size: 500,
          iops: 3000,
          throughput: 125,
          state: 'available', // UNATTACHED - waste indicator
          attachedTo: null
        },
        utilizationMetrics: {
          readOps: 0,
          writeOps: 0,
          readBytes: 0,
          writeBytes: 0
        },
        monthlyCost: 40, // 500GB * $0.08/GB = $40/mo (gp3 base, 3000 IOPS and 125 MiB/s included free)
        lastAnalyzed: new Date()
      },
      {
        tenantId: 'default-tenant',
        resourceId: 'vol-0xyz789abc012de34',
        resourceType: 'EBS',
        region: 'us-west-2',
        currentConfig: {
          volumeType: 'io2',
          size: 1000,
          iops: 16000,
          state: 'in-use',
          attachedTo: 'i-0a1b2c3d4e5f6g7h8'
        },
        utilizationMetrics: {
          readOps: 150,
          writeOps: 80,
          iopsUtilization: 8, // Only 8% of provisioned IOPS used - over-provisioned
          throughputUtilization: 12
        },
        monthlyCost: 1165, // 1000GB * $0.125 + 16000 IOPS * $0.065 = $125 + $1040 = $1,165/mo
        lastAnalyzed: new Date()
      },

      // EBS Snapshots
      // Pricing: $0.05/GB-month (incremental storage)
      {
        tenantId: 'default-tenant',
        resourceId: 'snap-0old123snapshot456',
        resourceType: 'EBS_Snapshot',
        region: 'us-east-1',
        currentConfig: {
          volumeId: 'vol-deleted',
          volumeSize: 2000,
          encrypted: true,
          ownerId: '123456789012',
          createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year old
        },
        utilizationMetrics: {
          ageInDays: 365,
          sourceVolumeExists: false, // Orphaned snapshot
          lastAccessed: null
        },
        monthlyCost: 100, // 2000GB * $0.05/GB = $100/mo (full snapshot, no incremental)
        lastAnalyzed: new Date()
      },
      {
        tenantId: 'default-tenant',
        resourceId: 'snap-0recent789snap012',
        resourceType: 'EBS_Snapshot',
        region: 'us-west-2',
        currentConfig: {
          volumeId: 'vol-0xyz789abc012de34',
          volumeSize: 1000,
          encrypted: true,
          createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString() // 6 months old
        },
        utilizationMetrics: {
          ageInDays: 180,
          sourceVolumeExists: true,
          lastAccessed: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
        },
        monthlyCost: 50, // 1000GB * $0.05/GB = $50/mo
        lastAnalyzed: new Date()
      },

      // Elastic IPs
      // Pricing: $0.005/hr when NOT associated with running instance = $3.60/mo
      {
        tenantId: 'default-tenant',
        resourceId: 'eipalloc-0unassoc123abc456',
        resourceType: 'ElasticIP',
        region: 'us-east-1',
        currentConfig: {
          publicIp: '52.1.2.3',
          domain: 'vpc',
          associationId: null, // UNASSOCIATED - waste indicator
          instanceId: null,
          networkInterfaceId: null
        },
        utilizationMetrics: {
          isAssociated: false,
          idleDays: 45
        },
        monthlyCost: 4, // $0.005/hr * 720hrs = $3.60/mo (rounded)
        lastAnalyzed: new Date()
      },
      {
        tenantId: 'default-tenant',
        resourceId: 'eipalloc-0unassoc789def012',
        resourceType: 'ElasticIP',
        region: 'eu-west-1',
        currentConfig: {
          publicIp: '52.4.5.6',
          domain: 'vpc',
          associationId: null,
          instanceId: null
        },
        utilizationMetrics: {
          isAssociated: false,
          idleDays: 90
        },
        monthlyCost: 4, // $0.005/hr * 720hrs = $3.60/mo (rounded)
        lastAnalyzed: new Date()
      },

      // NAT Gateways
      // Pricing: $0.045/hr = $32.40/mo base + $0.045/GB data processed
      {
        tenantId: 'default-tenant',
        resourceId: 'nat-0idle123gateway456',
        resourceType: 'NATGateway',
        region: 'us-east-1',
        currentConfig: {
          state: 'available',
          subnetId: 'subnet-abc123',
          vpcId: 'vpc-prod123',
          connectivityType: 'public'
        },
        utilizationMetrics: {
          bytesProcessed: 1024, // 1KB processed - essentially idle
          packetsDropped: 0,
          activeConnections: 0,
          idleTimePercent: 98
        },
        monthlyCost: 32, // $0.045/hr * 720hrs = $32.40/mo (rounded)
        lastAnalyzed: new Date()
      },
      {
        tenantId: 'default-tenant',
        resourceId: 'nat-0lowuse789gateway012',
        resourceType: 'NATGateway',
        region: 'us-west-2',
        currentConfig: {
          state: 'available',
          subnetId: 'subnet-def456',
          vpcId: 'vpc-dev456',
          connectivityType: 'public'
        },
        utilizationMetrics: {
          bytesProcessed: 50 * 1024 * 1024, // 50MB - very low
          packetsDropped: 0,
          activeConnections: 2,
          idleTimePercent: 85
        },
        monthlyCost: 35, // $32.40 base + ~$2.25 for 50MB data = ~$35/mo
        lastAnalyzed: new Date()
      },

      // Load Balancers
      // Pricing: ALB $0.0225/hr = $16.20/mo + LCU ($0.008/LCU-hr), NLB $0.0225/hr + NLCU
      {
        tenantId: 'default-tenant',
        resourceId: 'arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/idle-alb/abc123',
        resourceType: 'LoadBalancer',
        region: 'us-east-1',
        currentConfig: {
          type: 'application',
          scheme: 'internet-facing',
          state: 'active',
          availabilityZones: ['us-east-1a', 'us-east-1b'],
          targetGroups: 1
        },
        utilizationMetrics: {
          requestCount: 0, // WASTEFUL - spec: "RequestCount = 0 for 7+ days"
          activeConnectionCount: 0,
          healthyHostCount: 0, // No healthy targets!
          unhealthyHostCount: 2,
          processedBytes: 0
        },
        monthlyCost: 16, // $0.0225/hr * 720hrs = $16.20/mo (rounded)
        lastAnalyzed: new Date()
      },
      {
        tenantId: 'default-tenant',
        resourceId: 'arn:aws:elasticloadbalancing:us-west-2:123456789012:loadbalancer/net/low-nlb/def456',
        resourceType: 'LoadBalancer',
        region: 'us-west-2',
        currentConfig: {
          type: 'network',
          scheme: 'internal',
          state: 'active',
          availabilityZones: ['us-west-2a'],
          targetGroups: 2
        },
        utilizationMetrics: {
          requestCount: 5000, // HEALTHY - has traffic
          activeConnectionCount: 15,
          healthyHostCount: 2,
          unhealthyHostCount: 0,
          processedBytes: 10 * 1024 * 1024 // 10MB
        },
        monthlyCost: 22, // $16.20 base + ~$6 LCU for light traffic = ~$22/mo
        lastAnalyzed: new Date()
      },

      // S3 Buckets
      // Pricing: STANDARD $0.023/GB, GLACIER $0.004/GB, Deep Archive $0.00099/GB
      {
        tenantId: 'default-tenant',
        resourceId: 'logs-archive-bucket-2019',
        resourceType: 'S3',
        region: 'us-east-1',
        currentConfig: {
          storageClass: 'STANDARD', // Should be GLACIER
          versioning: true,
          hasLifecyclePolicy: false, // WASTEFUL - spec: "No lifecycle policy"
          encryption: 'AES256'
        },
        utilizationMetrics: {
          sizeBytes: 5 * 1024 * 1024 * 1024 * 1024, // 5TB
          objectCount: 50000000,
          avgObjectAgeDays: 730, // 2 years old on average
          accessFrequency: 'rare', // Rarely accessed
          lastAccessDays: 180,
          hasLifecyclePolicy: false // Also in metrics for detection
        },
        monthlyCost: 115, // 5TB = 5120GB * $0.023/GB = $117.76 ~= $115/mo
        lastAnalyzed: new Date()
      },
      {
        tenantId: 'default-tenant',
        resourceId: 'dev-temp-bucket-unused',
        resourceType: 'S3',
        region: 'us-west-2',
        currentConfig: {
          storageClass: 'STANDARD',
          versioning: false,
          hasLifecyclePolicy: false, // WASTEFUL - no lifecycle policy
          encryption: 'AES256'
        },
        utilizationMetrics: {
          sizeBytes: 500 * 1024 * 1024 * 1024, // 500GB
          objectCount: 100000,
          avgObjectAgeDays: 400,
          accessFrequency: 'none',
          lastAccessDays: 365, // Not accessed in a year
          hasLifecyclePolicy: false
        },
        monthlyCost: 12, // 500GB * $0.023/GB = $11.50/mo (rounded)
        lastAnalyzed: new Date()
      },

      // Lambda Functions
      // Pricing: $0.0000166667/GB-second + $0.20/1M requests
      // 1M invocations at 3008MB * 150ms = 1M * 3.008GB * 0.15s = 451,200 GB-sec = $7.52 + $0.20 = ~$8/mo
      {
        tenantId: 'default-tenant',
        resourceId: 'arn:aws:lambda:us-east-1:123456789012:function:overprovisioned-processor',
        resourceType: 'Lambda',
        region: 'us-east-1',
        currentConfig: {
          runtime: 'nodejs18.x',
          memorySize: 3008, // Max memory - likely over-provisioned
          timeout: 300,
          codeSize: 5242880
        },
        utilizationMetrics: {
          invocations: 1000000, // HIGH invocations, but...
          avgDurationMs: 150,
          maxMemoryUsedMB: 256, // Only uses 256MB of 3008MB allocated
          memoryUtilization: 8.5, // WASTEFUL - spec: "memory used < 50% of allocated"
          errors: 50,
          throttles: 0
        },
        monthlyCost: 8, // 1M * 3.008GB * 0.15s * $0.0000166667 + $0.20 = $7.52 + $0.20 = ~$8/mo (rounded)
        lastAnalyzed: new Date()
      },
      {
        tenantId: 'default-tenant',
        resourceId: 'arn:aws:lambda:us-west-2:123456789012:function:idle-cron-handler',
        resourceType: 'Lambda',
        region: 'us-west-2',
        currentConfig: {
          runtime: 'python3.11',
          memorySize: 1024,
          timeout: 60,
          codeSize: 1048576
        },
        utilizationMetrics: {
          invocations: 0, // WASTEFUL - spec: "Invocations = 0 for 30+ days"
          avgDurationMs: 0,
          maxMemoryUsedMB: 0,
          memoryUtilization: 0,
          errors: 0,
          throttles: 0
        },
        monthlyCost: 0, // Zero invocations = $0 (Lambda only charges for usage)
        lastAnalyzed: new Date()
      }
    ];

    // Define behavior patterns for each resource
    this.resourcePatterns.set('redshift-prod-analytics', {
      baseUtilization: 35,
      variability: 15,
      trend: 'stable',
    });

    this.resourcePatterns.set('redshift-dev-testing', {
      baseUtilization: 18,
      variability: 8,
      trend: 'cyclic',
      cyclePeriod: 7 // Weekly cycle
    });

    this.resourcePatterns.set('redshift-data-warehouse', {
      baseUtilization: 72,
      variability: 10,
      trend: 'increasing',
    });

    this.resourcePatterns.set('i-0a1b2c3d4e5f6g7h8', {
      baseUtilization: 22,
      variability: 12,
      trend: 'decreasing',
    });

    this.resourcePatterns.set('i-9h8g7f6e5d4c3b2a1', {
      baseUtilization: 15,
      variability: 10,
      trend: 'stable',
    });

    this.resourcePatterns.set('rds-prod-mysql', {
      baseUtilization: 38,
      variability: 18,
      trend: 'cyclic',
      cyclePeriod: 1 // Daily cycle
    });

    this.resourcePatterns.set('rds-dev-postgres', {
      baseUtilization: 8, // WASTEFUL - CPU < 20%
      variability: 5,
      trend: 'stable'
    });

    // ========== NEW RESOURCE TYPE PATTERNS ==========

    // EBS Volumes
    this.resourcePatterns.set('vol-0abc123def456gh78', {
      baseUtilization: 0, // Unattached - always 0
      variability: 0,
      trend: 'stable'
    });

    this.resourcePatterns.set('vol-0xyz789abc012de34', {
      baseUtilization: 8, // Low IOPS utilization
      variability: 5,
      trend: 'stable'
    });

    // EBS Snapshots (utilization = inverse of age desirability)
    this.resourcePatterns.set('snap-0old123snapshot456', {
      baseUtilization: 5, // Old orphaned snapshot - wasteful
      variability: 0,
      trend: 'stable'
    });

    this.resourcePatterns.set('snap-0recent789snap012', {
      baseUtilization: 15,
      variability: 0,
      trend: 'stable'
    });

    // Elastic IPs (0 = unassociated = wasteful)
    this.resourcePatterns.set('eipalloc-0unassoc123abc456', {
      baseUtilization: 0,
      variability: 0,
      trend: 'stable'
    });

    this.resourcePatterns.set('eipalloc-0unassoc789def012', {
      baseUtilization: 0,
      variability: 0,
      trend: 'stable'
    });

    // NAT Gateways
    this.resourcePatterns.set('nat-0idle123gateway456', {
      baseUtilization: 2, // Essentially idle
      variability: 2,
      trend: 'stable'
    });

    this.resourcePatterns.set('nat-0lowuse789gateway012', {
      baseUtilization: 15,
      variability: 10,
      trend: 'cyclic',
      cyclePeriod: 1
    });

    // Load Balancers
    this.resourcePatterns.set('arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/idle-alb/abc123', {
      baseUtilization: 2, // No healthy targets
      variability: 1,
      trend: 'stable'
    });

    this.resourcePatterns.set('arn:aws:elasticloadbalancing:us-west-2:123456789012:loadbalancer/net/low-nlb/def456', {
      baseUtilization: 20,
      variability: 15,
      trend: 'cyclic',
      cyclePeriod: 1
    });

    // S3 Buckets (utilization = access frequency)
    this.resourcePatterns.set('logs-archive-bucket-2019', {
      baseUtilization: 5, // Rarely accessed
      variability: 3,
      trend: 'stable'
    });

    this.resourcePatterns.set('dev-temp-bucket-unused', {
      baseUtilization: 0, // Never accessed
      variability: 0,
      trend: 'stable'
    });

    // Lambda Functions (utilization = memory utilization)
    this.resourcePatterns.set('arn:aws:lambda:us-east-1:123456789012:function:overprovisioned-processor', {
      baseUtilization: 8.5, // Over-provisioned memory
      variability: 3,
      trend: 'stable'
    });

    this.resourcePatterns.set('arn:aws:lambda:us-west-2:123456789012:function:idle-cron-handler', {
      baseUtilization: 12.5,
      variability: 5,
      trend: 'stable'
    });

    // Store all resources (create new or update existing)
    for (const resource of syntheticResources) {
      try {
        await storage.createAwsResource(resource, 'default-tenant');
      } catch (error) {
        // Resource already exists, update it with enterprise-scale costs
        console.log(`Updating existing resource: ${resource.resourceId}`);
        await storage.updateAwsResource(resource.resourceId, {
          monthlyCost: resource.monthlyCost,
          utilizationMetrics: resource.utilizationMetrics,
          currentConfig: resource.currentConfig,
          lastAnalyzed: new Date()
        }, 'default-tenant');
      }
    }

    console.log(`✅ Generated ${syntheticResources.length} synthetic resources`);
  }

  // Evolve resource data based on time and patterns
  async evolveResources() {
    console.log('🔄 Evolving synthetic resource data...');

    const resources = await storage.getAllAwsResources('default-tenant');
    const elapsedMinutes = (Date.now() - this.startTime) / (1000 * 60);
    const elapsedDays = elapsedMinutes / (60 * 24);

    for (const resource of resources) {
      const pattern = this.resourcePatterns.get(resource.resourceId);
      if (!pattern) continue;

      const currentMetrics = resource.utilizationMetrics as any;
      let newUtilization = pattern.baseUtilization;

      // Apply trend and time-based evolution
      switch (pattern.trend) {
        case 'increasing':
          newUtilization += (elapsedDays * 2); // Gradual increase
          break;
        case 'decreasing':
          newUtilization -= (elapsedDays * 1.5); // Gradual decrease
          break;
        case 'cyclic':
          if (pattern.cyclePeriod) {
            const cyclePosition = (elapsedDays % pattern.cyclePeriod) / pattern.cyclePeriod;
            const cycleOffset = Math.sin(cyclePosition * 2 * Math.PI) * (pattern.variability / 2);
            newUtilization += cycleOffset;
          }
          break;
        case 'stable':
          // Just add some random noise
          break;
      }

      // Add random variability
      const randomVariation = (Math.random() - 0.5) * pattern.variability;
      newUtilization += randomVariation;

      // Clamp between 5 and 95
      newUtilization = Math.max(5, Math.min(95, newUtilization));

      // Update resource metrics
      const updatedMetrics = {
        ...currentMetrics,
        cpuUtilization: Math.round(newUtilization),
      };

      // Cost can vary slightly based on usage
      const costVariation = 1 + (Math.random() - 0.5) * 0.1; // ±5% variation
      const updatedCost = Math.round((resource.monthlyCost || 0) * costVariation);

      // Update the resource
      await storage.updateAwsResource(resource.id, {
        utilizationMetrics: updatedMetrics,
        monthlyCost: updatedCost,
        lastAnalyzed: new Date()
      }, 'default-tenant');

      console.log(`  Updated ${resource.resourceId}: ${currentMetrics.cpuUtilization}% → ${Math.round(newUtilization)}%`);
    }

    console.log('✅ Resource evolution complete');
  }

  // Add a new resource to simulate environment growth
  async addNewResource() {
    const newResourceTemplates: InsertAwsResource[] = [
      {
        tenantId: 'default-tenant',
        resourceId: `redshift-new-${Date.now()}`,
        resourceType: 'Redshift',
        region: 'us-east-1',
        currentConfig: {
          nodeType: 'dc2.large',
          numberOfNodes: 2,
          clusterIdentifier: `redshift-new-${Date.now()}`
        },
        utilizationMetrics: {
          cpuUtilization: Math.round(10 + Math.random() * 30),
          diskUtilization: Math.round(20 + Math.random() * 40),
          queryCount: Math.round(1000 + Math.random() * 5000)
        },
        monthlyCost: Math.round(300 + Math.random() * 200), // dc2.large 2 nodes ~$360/mo + variation
        lastAnalyzed: new Date()
      },
      {
        tenantId: 'default-tenant',
        resourceId: `i-${Math.random().toString(36).substring(2, 15)}`,
        resourceType: 'EC2',
        region: 'us-west-2',
        currentConfig: {
          instanceType: 't3.medium',
          state: 'running'
        },
        utilizationMetrics: {
          cpuUtilization: Math.round(10 + Math.random() * 25),
          networkIn: Math.round(100000 + Math.random() * 500000),
          networkOut: Math.round(50000 + Math.random() * 250000)
        },
        monthlyCost: Math.round(25 + Math.random() * 15), // t3.medium ~$30/mo + variation
        lastAnalyzed: new Date()
      }
    ];

    const randomResource = newResourceTemplates[Math.floor(Math.random() * newResourceTemplates.length)];
    
    await storage.createAwsResource(randomResource, 'default-tenant');
    
    // Add pattern for new resource
    this.resourcePatterns.set(randomResource.resourceId, {
      baseUtilization: (randomResource.utilizationMetrics as any).cpuUtilization,
      variability: 12,
      trend: 'stable',
    });

    console.log(`✅ Added new synthetic resource: ${randomResource.resourceId}`);
  }

  // Mark resources as terminated (update status instead of deleting)
  async markTerminatedResources() {
    const resources = await storage.getAllAwsResources('default-tenant');
    
    // Mark resources with very low utilization as terminated
    for (const resource of resources) {
      const metrics = resource.utilizationMetrics as any;
      const hoursSinceAnalysis = (Date.now() - new Date(resource.lastAnalyzed).getTime()) / (1000 * 60 * 60);
      
      if (metrics?.cpuUtilization < 8 && hoursSinceAnalysis > 24) {
        // Update resource to show terminated state
        await storage.updateAwsResource(resource.resourceId, {
          currentConfig: {
            ...(resource.currentConfig as any),
            state: 'terminated'
          }
        }, 'default-tenant');
        this.resourcePatterns.delete(resource.resourceId);
        console.log(`✅ Marked resource as terminated: ${resource.resourceId}`);
        break; // Only mark one at a time
      }
    }
  }
}

export const syntheticDataGenerator = new SyntheticDataGenerator();
