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
      {
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
        monthlyCost: 960000000, // $960,000 (BASE $96k × 10)
        lastAnalyzed: new Date()
      },
      {
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
        monthlyCost: 72000000, // $72,000 (BASE $7.2k × 10)
        lastAnalyzed: new Date()
      },
      {
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
        monthlyCost: 2160000000, // $2,160,000 (BASE $216k × 10)
        lastAnalyzed: new Date()
      },
      // EC2 instances
      {
        resourceId: 'i-0a1b2c3d4e5f6g7h8',
        resourceType: 'EC2',
        region: 'us-east-1',
        currentConfig: {
          instanceType: 't3.xlarge',
          state: 'running'
        },
        utilizationMetrics: {
          cpuUtilization: 22,
          networkIn: 1024000,
          networkOut: 512000
        },
        monthlyCost: 12100000, // $12,100 (BASE $1.21k × 10)
        lastAnalyzed: new Date()
      },
      {
        resourceId: 'i-9h8g7f6e5d4c3b2a1',
        resourceType: 'EC2',
        region: 'us-west-2',
        currentConfig: {
          instanceType: 'm5.2xlarge',
          state: 'running'
        },
        utilizationMetrics: {
          cpuUtilization: 15,
          networkIn: 512000,
          networkOut: 256000
        },
        monthlyCost: 28000000, // $28,000 (BASE $2.8k × 10)
        lastAnalyzed: new Date()
      },
      // RDS instances
      {
        resourceId: 'rds-prod-mysql',
        resourceType: 'RDS',
        region: 'us-east-1',
        currentConfig: {
          instanceClass: 'db.r5.2xlarge',
          engine: 'mysql',
          allocatedStorage: 1000
        },
        utilizationMetrics: {
          cpuUtilization: 38,
          connectionCount: 145,
          readIOPS: 8500,
          writeIOPS: 3200
        },
        monthlyCost: 87600000, // $87,600 (BASE $8.76k × 10)
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

    // Store all resources (create new or update existing)
    for (const resource of syntheticResources) {
      try {
        await storage.createAwsResource(resource, 'default-tenant');
      } catch (error) {
        // Resource already exists, update it with new 10× multiplied costs
        console.log(`Updating existing resource: ${resource.resourceId}`);
        await storage.updateAwsResource(resource.resourceId, {
          monthlyCost: resource.monthlyCost,
          utilizationMetrics: resource.utilizationMetrics,
          currentConfig: resource.currentConfig,
          lastAnalyzed: new Date()
        });
      }
    }

    console.log(`✅ Generated ${syntheticResources.length} synthetic resources`);
  }

  // Evolve resource data based on time and patterns
  async evolveResources() {
    console.log('🔄 Evolving synthetic resource data...');

    const resources = await storage.getAllAwsResources();
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
      });

      console.log(`  Updated ${resource.resourceId}: ${currentMetrics.cpuUtilization}% → ${Math.round(newUtilization)}%`);
    }

    console.log('✅ Resource evolution complete');
  }

  // Add a new resource to simulate environment growth
  async addNewResource() {
    const newResourceTemplates: InsertAwsResource[] = [
      {
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
        monthlyCost: Math.round(500000 + Math.random() * 500000),
        lastAnalyzed: new Date()
      },
      {
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
        monthlyCost: Math.round(30000 + Math.random() * 50000),
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
    const resources = await storage.getAllAwsResources();
    
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
        });
        this.resourcePatterns.delete(resource.resourceId);
        console.log(`✅ Marked resource as terminated: ${resource.resourceId}`);
        break; // Only mark one at a time
      }
    }
  }
}

export const syntheticDataGenerator = new SyntheticDataGenerator();
