import cron from 'node-cron';
import { awsService } from './aws';
import { sendOptimizationRecommendation, sendOptimizationComplete } from './slack';
import { storage } from '../storage';
import { configService } from './config';
import { geminiAI } from './gemini-ai';
import { syntheticDataGenerator } from './synthetic-data';

// Scheduler is a system service that operates in the default tenant context
const SYSTEM_TENANT_ID = 'default-tenant';

export class SchedulerService {
  private continuousSimulationInterval: NodeJS.Timeout | null = null;
  private isSimulationRunning: boolean = false;
  private simulationCycleCount: number = 0;

  constructor() {
    // NOTE: Cron job registration moved to initialize() to prevent race condition
    // where jobs fire before config is loaded
  }

  async initialize() {
    await this.initializeConfiguration();
    await this.initializeSyntheticData();
    this.initializeScheduledTasks(); // Now safe - config is loaded
    this.startContinuousSimulation();
  }

  private async initializeConfiguration() {
    try {
      await configService.initializeDefaults();
      console.log('✅ Agent configuration initialized');
    } catch (error) {
      console.error('❌ Failed to initialize agent configuration:', error);
    }
  }

  private async initializeSyntheticData() {
    try {
      const config = await configService.getAgentConfig();
      if (config.simulationMode) {
        console.log('📊 Simulation Mode is ON - initializing synthetic dataset...');
        await syntheticDataGenerator.generateInitialDataset();
        
        // Check if cost reports exist - if not, generate them
        const existingReports = await storage.getCostReports(SYSTEM_TENANT_ID);
        if (existingReports.length === 0) {
          console.log('📈 No cost reports found - generating historical cost data...');
          const { DataGenerator } = await import('./data-generator.js');
          const generator = new DataGenerator(storage);
          await generator.generateCostData();
          console.log('✅ Historical cost data generated (6 months)');
        }
      }
    } catch (error) {
      console.error('❌ Failed to initialize synthetic data:', error);
    }
  }

  private startContinuousSimulation() {
    console.log('⚡ Demo Mode Active — 3s scan interval');
    console.log('💰 Enterprise-scale monetary values (millions in savings)');
    
    this.continuousSimulationInterval = setInterval(async () => {
      // Guard against overlapping executions
      if (this.isSimulationRunning) {
        return;
      }

      this.isSimulationRunning = true;
      try {
        const config = await configService.getAgentConfig();
        if (config.simulationMode) {
          // Evolve resource utilization data
          await syntheticDataGenerator.evolveResources();
          
          // Increment cycle counter
          this.simulationCycleCount++;
          
          // Generate heuristic recommendations every cycle (3s)
          await this.generateHeuristicRecommendations();
        }
      } catch (error) {
        console.error('Error in continuous simulation loop:', error);
      } finally {
        this.isSimulationRunning = false;
      }
    }, 3000);
  }

  private initializeScheduledTasks() {
    // NOTE: Continuous simulation loop now handles real-time synthetic data evolution (every 5s)
    // The 30-minute cron has been replaced with continuous simulation
    
    // Resource analysis every 6 hours - checks Prod Mode to decide AI vs Heuristics
    cron.schedule('0 */6 * * *', async () => {
      await this.runResourceAnalysis();
    });

    // Sync cost data daily at 2 AM
    cron.schedule('0 2 * * *', async () => {
      console.log('Running daily cost data sync...');
      await this.syncCostData();
    });

    // Check Trusted Advisor recommendations weekly
    cron.schedule('0 3 * * 0', async () => {
      console.log('Running weekly Trusted Advisor check...');
      await this.checkTrustedAdvisor();
    });
  }

  // Determines which analysis method to use based on Prod Mode configuration
  private async runResourceAnalysis() {
    // Layer 2 Defense: Check environment variable first (bootstrap failsafe)
    const envSimulationMode = process.env.SIMULATION_MODE?.toLowerCase() === 'true';
    if (envSimulationMode) {
      console.log('⚡ [ENV:SIMULATION_MODE] Skipping AWS analysis - using continuous simulation loop');
      return;
    }
    
    const config = await configService.getAgentConfig();
    
    // Skip AWS API calls if simulation mode is enabled
    if (config.simulationMode) {
      console.log('⚡ [SIMULATION MODE] Skipping AWS analysis - using continuous simulation loop');
      return;
    }
    
    if (config.prodMode) {
      console.log('🚀 [PROD MODE ON] Running AI-powered analysis with Gemini 2.5 Flash + RAG...');
      await this.analyzeWithAI();
    } else {
      console.log('⚙️ [PROD MODE OFF] Running heuristics-based analysis...');
      await this.analyzeAWSResources();
    }
  }

  private async analyzeAWSResources() {
    try {
      // Analyze Redshift clusters
      const clusters = await awsService.getRedshiftClusters();
      
      for (const cluster of clusters) {
        if (!cluster.ClusterIdentifier) continue;
        
        const analysis = await awsService.analyzeRedshiftClusterOptimization(cluster.ClusterIdentifier);
        
        if (analysis.recommendation) {
          // Check if we already have a pending recommendation for this resource
          const existingRecommendations = await storage.getRecommendations(SYSTEM_TENANT_ID, 'pending');
          const hasExisting = existingRecommendations.some(r => r.resourceId === cluster.ClusterIdentifier);
          
          if (!hasExisting) {
            // Create new recommendation
            const riskLevel = analysis.recommendation.avgUtilization < 25 ? 5 : 10;
            const recommendation = await storage.createRecommendation({
              tenantId: SYSTEM_TENANT_ID,
              resourceId: cluster.ClusterIdentifier,
              type: 'resize',
              priority: analysis.recommendation.avgUtilization < 25 ? 'critical' : 'high',
              title: 'Redshift Cluster Over-provisioned',
              description: `Cluster running at ${analysis.recommendation.avgUtilization.toFixed(1)}% average utilization. Recommend resizing from ${analysis.recommendation.currentNodeType} to ${analysis.recommendation.recommendedNodeType}.`,
              currentConfig: {
                nodeType: analysis.recommendation.currentNodeType,
                numberOfNodes: analysis.recommendation.currentNodes,
                utilization: analysis.recommendation.avgUtilization
              },
              recommendedConfig: {
                nodeType: analysis.recommendation.recommendedNodeType,
                numberOfNodes: analysis.recommendation.recommendedNodes
              },
              projectedMonthlySavings: Number(analysis.recommendation.projectedSavings.monthly),
              riskLevel: riskLevel,
              executionMode: riskLevel <= 5 ? 'autonomous' : 'hitl'
            }, SYSTEM_TENANT_ID);

            // Check if we can execute autonomously
            const canExecuteAutonomously = await configService.canExecuteAutonomously({
              type: recommendation.type,
              riskLevel: recommendation.riskLevel ?? 0,
              projectedMonthlySavings: recommendation.projectedMonthlySavings
            });

            if (canExecuteAutonomously) {
              // Execute immediately in autonomous mode
              try {
                await this.executeOptimization(recommendation);
                await storage.updateRecommendationStatus(recommendation.id, 'executed', SYSTEM_TENANT_ID);

                // Send Slack notification about autonomous execution
                await sendOptimizationComplete({
                  title: `[AUTONOMOUS] ${recommendation.title}`,
                  resourceId: recommendation.resourceId,
                  actualSavings: recommendation.projectedMonthlySavings,
                  status: 'success'
                });

                console.log(`🤖 Autonomously executed recommendation: ${recommendation.title}`);
              } catch (error) {
                await storage.updateRecommendationStatus(recommendation.id, 'failed', SYSTEM_TENANT_ID);
                
                // Create failed optimization history entry
                await storage.createOptimizationHistory({
                  tenantId: SYSTEM_TENANT_ID,
                  recommendationId: recommendation.id,
                  executedBy: 'autonomous-agent',
                  executionDate: new Date(),
                  beforeConfig: recommendation.currentConfig as any,
                  afterConfig: recommendation.recommendedConfig as any,
                  status: 'failed',
                  errorMessage: error instanceof Error ? error.message : String(error)
                }, SYSTEM_TENANT_ID);

                // Send failure notification
                await sendOptimizationComplete({
                  title: `[AUTONOMOUS] ${recommendation.title}`,
                  resourceId: recommendation.resourceId,
                  actualSavings: 0,
                  status: 'failed'
                });

                console.error(`❌ Autonomous execution failed for ${recommendation.id}:`, error);
              }
            } else {
              // Send traditional notification requiring approval
              await sendOptimizationRecommendation({
                title: recommendation.title,
                description: recommendation.description,
                resourceId: recommendation.resourceId,
                projectedMonthlySavings: recommendation.projectedMonthlySavings,
                priority: recommendation.priority,
                recommendationId: recommendation.id
              });
            }
          }
        }

        // Update resource in database
        await storage.createAwsResource({
          tenantId: SYSTEM_TENANT_ID,
          resourceId: cluster.ClusterIdentifier,
          resourceType: 'Redshift',
          region: cluster.AvailabilityZone?.slice(0, -1) || 'us-east-1',
          currentConfig: {
            nodeType: cluster.NodeType,
            numberOfNodes: cluster.NumberOfNodes,
            clusterStatus: cluster.ClusterStatus
          },
          utilizationMetrics: {
            avgCpuUtilization: analysis.utilization
          },
          monthlyCost: analysis.recommendation?.projectedSavings ? 
            (analysis.recommendation.projectedSavings.monthly * 2) : 
            undefined
        }, SYSTEM_TENANT_ID);
      }
    } catch (error) {
      console.error('Error analyzing AWS resources:', error);
    }
  }

  // Public method to trigger analysis manually - respects Prod Mode setting
  public async triggerAnalysis() {
    await this.runResourceAnalysis();
  }

  // Backward compatibility: public method to trigger AI analysis manually
  public async triggerAIAnalysis() {
    await this.analyzeWithAI();
  }

  private async analyzeWithAI() {
    let historyId: string | undefined;
    const startTime = new Date();
    
    try {
      console.log('⚡ Prod Mode (RAG) triggered – auto-revert in 5 minutes');
      console.log('🤖 Starting AI-powered resource analysis with Gemini 2.5 Flash...');
      
      // Create AI mode history entry to track this run
      const historyEntry = await storage.createAiModeHistory({
        tenantId: SYSTEM_TENANT_ID,
        startTime,
        status: 'running',
        summary: 'AI-powered analysis with Gemini 2.5 Flash + Pinecone RAG',
        triggeredBy: 'user'
      }, SYSTEM_TENANT_ID);
      historyId = historyEntry.id;
      
      // Get all AWS resources from database
      const allResources = await storage.getAllAwsResources(SYSTEM_TENANT_ID);
      
      if (allResources.length === 0) {
        console.log('No resources found to analyze');
        await storage.updateAiModeHistory(historyId, {
          endTime: new Date(),
          status: 'success',
          summary: 'No resources found to analyze',
          recommendationsGenerated: 0,
          totalSavingsIdentified: 0
        }, SYSTEM_TENANT_ID);
        return;
      }

      console.log(`Analyzing ${allResources.length} resources with AI...`);
      
      // Use Gemini AI to analyze resources and generate recommendations
      // Pass the history ID to link recommendations to this AI run
      const aiRecommendations = await geminiAI.analyzeResourcesForOptimization(allResources, historyId);
      
      console.log(`🎯 AI generated ${aiRecommendations.length} recommendations`);
      
      for (const aiRec of aiRecommendations) {
        // Check if we already have a pending recommendation for this resource
        const existingRecommendations = await storage.getRecommendations(SYSTEM_TENANT_ID, 'pending');
        const hasExisting = existingRecommendations.some(r => r.resourceId === aiRec.resourceId);
        
        if (!hasExisting) {
          // Create new AI-powered recommendation
          const recommendation = await storage.createRecommendation(aiRec, SYSTEM_TENANT_ID);
          
          console.log(`✨ Created AI recommendation: ${recommendation.title}`);

          // Check if we can execute autonomously
          const canExecuteAutonomously = await configService.canExecuteAutonomously({
            type: recommendation.type,
            riskLevel: recommendation.riskLevel ?? 0,
            projectedMonthlySavings: recommendation.projectedMonthlySavings
          });

          if (canExecuteAutonomously) {
            // Execute immediately in autonomous mode
            try {
              await this.executeOptimization(recommendation);
              await storage.updateRecommendationStatus(recommendation.id, 'executed', SYSTEM_TENANT_ID);

              // Send Slack notification about autonomous execution
              await sendOptimizationComplete({
                title: `[AI AUTONOMOUS] ${recommendation.title}`,
                resourceId: recommendation.resourceId,
                actualSavings: recommendation.projectedMonthlySavings,
                status: 'success'
              });

              console.log(`🤖 AI-powered autonomous execution: ${recommendation.title}`);
            } catch (error) {
              await storage.updateRecommendationStatus(recommendation.id, 'failed', SYSTEM_TENANT_ID);
              
              // Create failed optimization history entry
              await storage.createOptimizationHistory({
                tenantId: SYSTEM_TENANT_ID,
                recommendationId: recommendation.id,
                executedBy: 'gemini-ai-agent',
                executionDate: new Date(),
                beforeConfig: recommendation.currentConfig as any,
                afterConfig: recommendation.recommendedConfig as any,
                status: 'failed',
                errorMessage: error instanceof Error ? error.message : String(error)
              }, SYSTEM_TENANT_ID);

              console.error(`❌ AI autonomous execution failed for ${recommendation.id}:`, error);
            }
          } else {
            // Send notification requiring approval
            await sendOptimizationRecommendation({
              title: `[AI] ${recommendation.title}`,
              description: recommendation.description,
              resourceId: recommendation.resourceId,
              projectedMonthlySavings: recommendation.projectedMonthlySavings,
              priority: recommendation.priority,
              recommendationId: recommendation.id
            });
            
            console.log(`📧 Sent AI recommendation for approval: ${recommendation.title}`);
          }
        }
      }
      
      // Update AI mode history with results
      if (historyId) {
        const totalSavings = aiRecommendations.reduce((sum, rec) => 
          sum + (rec.projectedMonthlySavings || 0), 0
        );
        
        await storage.updateAiModeHistory(historyId, {
          endTime: new Date(),
          status: 'success',
          summary: `AI analysis complete: ${aiRecommendations.length} recommendations generated`,
          recommendationsGenerated: aiRecommendations.length,
          totalSavingsIdentified: totalSavings
        }, SYSTEM_TENANT_ID);
        console.log('🧠 AI history updated');
      }
      
      console.log('✅ AI analysis completed successfully');
    } catch (error) {
      console.error('❌ Error in AI-powered analysis:', error);
      
      // Update AI mode history with error
      if (historyId) {
        await storage.updateAiModeHistory(historyId, {
          endTime: new Date(),
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : String(error)
        }, SYSTEM_TENANT_ID);
      }
    }
  }

  private async syncCostData() {
    try {
      // Layer 2 Defense: Check environment variable first (bootstrap failsafe)
      const envSimulationMode = process.env.SIMULATION_MODE?.toLowerCase() === 'true';
      if (envSimulationMode) {
        console.log('⚡ [ENV:SIMULATION_MODE] Skipping AWS cost data sync - using synthetic data');
        return;
      }
      
      // Skip AWS API calls if simulation mode is enabled
      const config = await configService.getAgentConfig();
      if (config.simulationMode) {
        console.log('⚡ [SIMULATION MODE] Skipping AWS cost data sync - using synthetic data');
        return;
      }
      
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7); // Last 7 days

      const costData = await awsService.getCostAndUsageReports(
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );

      for (const timeResult of costData) {
        if (!timeResult.Groups) continue;
        
        const reportDate = new Date(timeResult.TimePeriod?.Start || '');
        
        for (const group of timeResult.Groups) {
          const service = group.Keys?.[0] || 'Unknown';
          const cost = parseFloat(group.Metrics?.BlendedCost?.Amount || '0');
          const usage = parseFloat(group.Metrics?.UsageQuantity?.Amount || '0');
          
          if (cost > 0) {
            await storage.createCostReport({
              tenantId: SYSTEM_TENANT_ID,
              reportDate,
              serviceCategory: service,
              cost: Math.round(cost), // Direct dollar amounts (enterprise scale)
              usage: usage.toString(),
              usageType: group.Metrics?.UsageQuantity?.Unit || 'Unknown',
              region: 'us-east-1' // Default region
            }, SYSTEM_TENANT_ID);
          }
        }
      }
    } catch (error) {
      console.error('Error syncing cost data:', error);
    }
  }

  private async checkTrustedAdvisor() {
    try {
      // Layer 2 Defense: Check environment variable first (bootstrap failsafe)
      const envSimulationMode = process.env.SIMULATION_MODE?.toLowerCase() === 'true';
      if (envSimulationMode) {
        console.log('⚡ [ENV:SIMULATION_MODE] Skipping AWS Trusted Advisor check - using synthetic data');
        return;
      }
      
      // Skip AWS API calls if simulation mode is enabled
      const config = await configService.getAgentConfig();
      if (config.simulationMode) {
        console.log('⚡ [SIMULATION MODE] Skipping AWS Trusted Advisor check - using synthetic data');
        return;
      }
      
      const checks = await awsService.getTrustedAdvisorChecks();
      
      for (const check of checks) {
        if (check.result && (check.result.status === 'error' || check.result.status === 'warning')) {
          console.log(`Trusted Advisor alert: ${check.name} - ${check.result.status}`);
          
          // Process flagged resources
          if (check.result.flaggedResources) {
            for (const resource of check.result.flaggedResources) {
              // Create recommendations based on Trusted Advisor findings
              // This would need more specific logic based on check type
              console.log('Flagged resource:', resource);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error checking Trusted Advisor:', error);
    }
  }

  // Heuristic recommendation generator - analyzes synthetic resources for waste
  private async generateHeuristicRecommendations() {
    try {
      const config = await configService.getAgentConfig();
      
      // Get all resources from database
      const resources = await storage.getAllAwsResources(SYSTEM_TENANT_ID);
      
      if (resources.length === 0) {
        return;
      }
      
      // Identify underutilized resources (potential waste) - type-specific detection
      // Detection logic follows spec from "FinOps Agent expansion.pdf" page 14 EXACTLY
      const wastefulResources = resources.filter(resource => {
        const metrics = resource.utilizationMetrics as any;
        const config = resource.currentConfig as any;
        if (!metrics) return false;

        // Type-specific waste detection per spec (page 14)
        switch (resource.resourceType) {
          case 'EC2': {
            // SPEC: "Oversized instances: CPU < 20% AND memory < 20% over 7 days"
            // Uses AND logic - BOTH must be low to be considered waste
            const cpuUtil = metrics.avgCpuUtilization ?? metrics.cpuUtilization ?? 0;
            const memUtil = metrics.avgMemoryUtilization ?? metrics.memoryUtilization ?? 100;
            return cpuUtil < 20 && memUtil < 20;
          }

          case 'RDS': {
            // SPEC: "Oversized databases: CPUUtilization < 20% avg over 14 days"
            // CPU only - NO memory check for RDS
            const cpuUtil = metrics.avgCpuUtilization ?? metrics.cpuUtilization ?? 0;
            return cpuUtil < 20;
          }

          case 'Redshift': {
            // SPEC: "Oversized clusters: CPUUtilization < 20% sustained"
            // CPU only - NO memory check for Redshift
            const cpuUtil = metrics.avgCpuUtilization ?? metrics.cpuUtilization ?? 0;
            return cpuUtil < 20;
          }

          case 'EBS': {
            // SPEC: "Unattached volumes: Attachments = []" (primary waste indicator)
            // Also flag gp2 volumes as migration candidates
            const isUnattached = config?.state === 'available' || !config?.attachedTo;
            const isGp2 = config?.volumeType === 'gp2';
            return isUnattached || isGp2;
          }

          case 'EBS_Snapshot': {
            // SPEC: "Old snapshots: age > 90 days" OR "Unattached snapshots: source volume deleted"
            const isOrphaned = metrics.sourceVolumeExists === false;
            const ageInDays = metrics.ageInDays ?? 0;
            return isOrphaned || ageInDays > 90;
          }

          case 'ElasticIP': {
            // SPEC: "Unattached Elastic IPs: InstanceId = null" -> $3.65/month each
            return metrics.isAssociated === false || !config?.associationId;
          }

          case 'NATGateway': {
            // SPEC: "Idle NAT Gateways: BytesProcessed < 1GB/day over 7 days"
            // 1GB = 1,073,741,824 bytes
            const bytesProcessed = metrics.bytesProcessed ?? 0;
            return bytesProcessed < 1073741824; // < 1GB/day
          }

          case 'LoadBalancer': {
            // SPEC: "Idle Load Balancers: RequestCount = 0 for 7+ days"
            const requestCount = metrics.requestCount ?? 0;
            return requestCount === 0;
          }

          case 'S3': {
            // SPEC: "No lifecycle policy: Bucket has no lifecycle rules"
            const hasLifecyclePolicy = config?.hasLifecyclePolicy ?? metrics.hasLifecyclePolicy ?? true;
            return !hasLifecyclePolicy;
          }

          case 'Lambda': {
            // SPEC: "Over-provisioned memory: Max memory used < 50% of allocated"
            // SPEC: "Unused functions: Invocations = 0 for 30+ days"
            const memUtil = metrics.memoryUtilization ?? 100;
            const invocations = metrics.invocations ?? 0;
            return memUtil < 50 || invocations === 0;
          }

          default: {
            // Fallback: use EC2-style detection (conservative)
            const cpuUtil = metrics.avgCpuUtilization ?? metrics.cpuUtilization ?? 0;
            const memUtil = metrics.avgMemoryUtilization ?? metrics.memoryUtilization ?? 100;
            return cpuUtil < 20 && memUtil < 20;
          }
        }
      });
      
      if (wastefulResources.length === 0) {
        return;
      }
      
      // Generate 2-5 recommendations per cycle
      const numRecommendations = Math.min(
        Math.floor(Math.random() * 4) + 2, // 2-5 recommendations
        wastefulResources.length
      );
      
      // Shuffle and pick random resources
      const shuffled = wastefulResources.sort(() => Math.random() - 0.5);
      const selectedResources = shuffled.slice(0, numRecommendations);
      
      let newRecommendationsCount = 0;
      let totalSavings = 0;
      let autoOptimizedCount = 0;
      let autonomousCount = 0;
      let hitlCount = 0;
      
      for (const resource of selectedResources) {
        // Check if we already have a pending recommendation for this resource
        const existingRecommendations = await storage.getRecommendations(SYSTEM_TENANT_ID);
        const hasExisting = existingRecommendations.some(
          r => r.resourceId === resource.resourceId && (r.status === 'pending' || r.status === 'approved')
        );
        
        if (hasExisting) {
          continue;
        }
        
        // FUNDAMENTAL VALIDATION: Skip resources with no cost data
        const resourceMonthlyCost = resource.monthlyCost || 0;
        if (resourceMonthlyCost <= 0) {
          console.warn(`Skipping resource ${resource.resourceId}: no valid cost data`);
          continue;
        }
        
        // Generate type-specific recommendation
        const recType = this.getRecommendationTypeForResource(resource);

        // Assign risk level based on recommendation type (not random!)
        // Low risk (1-3): Deleting clearly unused resources
        // Medium-low risk (4-5): Safe optimizations with minimal impact
        // Medium risk (6): Changes that affect resource configuration
        // Medium-high risk (7-8): Changes that affect infrastructure
        // High risk (9-10): Major changes to production resources
        const riskLevelByType: Record<string, number> = {
          'delete-unattached': 2,    // EBS volume not attached - very safe
          'release-eip': 2,          // Elastic IP not associated - very safe, AWS charges for it
          'delete-orphaned': 3,      // Snapshot source gone - safe to delete
          'delete-unused': 4,        // Lambda/NAT/LB unused - probably safe
          'snapshot-cleanup': 4,     // Old snapshots - might be backups
          'volume-rightsizing': 5,   // Change EBS type - reversible
          'storage-tiering': 4,      // S3 to Glacier - data still accessible
          'lambda-rightsizing': 4,   // Memory change - reversible
          'nat-consolidation': 7,    // Network changes - affects routing
          'lb-consolidation': 7,     // Traffic changes - affects routing
          'rightsizing': 6,          // EC2/RDS resize - affects workloads
          'scheduling': 6,           // Shutdown schedules - affects availability
        };
        const numericRiskLevel = riskLevelByType[recType] ?? 5; // Default to medium-low
        const riskLevel = numericRiskLevel <= 3 ? 'low' : (numericRiskLevel <= 6 ? 'medium' : 'high');

        // Calculate savings based on recommendation type and resource cost
        let savingsPercentage = 0;

        switch (recType) {
          case 'delete-unattached':
          case 'release-eip':
          case 'delete-orphaned':
          case 'delete-unused':
            // Deletion: 100% savings (resource completely removed)
            savingsPercentage = 1.0;
            break;
          case 'snapshot-cleanup':
            // Snapshot cleanup: 100% savings for the snapshot
            savingsPercentage = 1.0;
            break;
          case 'rightsizing':
            // Rightsizing: 30-60% savings (downsize underutilized resources)
            savingsPercentage = 0.30 + Math.random() * 0.30;
            break;
          case 'scheduling':
            // Scheduling: 50-70% savings (shutdown off-hours)
            savingsPercentage = 0.50 + Math.random() * 0.20;
            break;
          case 'storage-tiering':
            // S3 tiering: 60-80% savings (Glacier is much cheaper)
            savingsPercentage = 0.60 + Math.random() * 0.20;
            break;
          case 'volume-rightsizing':
            // EBS type change: 20-40% savings (gp3 vs gp2)
            savingsPercentage = 0.20 + Math.random() * 0.20;
            break;
          case 'lambda-rightsizing':
            // Lambda memory: 30-50% savings
            savingsPercentage = 0.30 + Math.random() * 0.20;
            break;
          case 'nat-consolidation':
          case 'lb-consolidation':
            // Consolidation: 40-60% savings
            savingsPercentage = 0.40 + Math.random() * 0.20;
            break;
          default:
            // Unknown type: 20-40% conservative estimate
            savingsPercentage = 0.20 + Math.random() * 0.20;
        }
        
        const monthlySavings = Math.round(resourceMonthlyCost * savingsPercentage);
        
        // Determine execution mode using configService (consistent with AI flow)
        const executionModeResult = await configService.determineExecutionMode({
          type: recType,
          riskLevel: numericRiskLevel,
          projectedMonthlySavings: monthlySavings
        });
        
        const metrics = resource.utilizationMetrics as any;
        const cpuUtil = metrics?.avgCpuUtilization || metrics?.cpuUtilization || 0;
        const memUtil = metrics?.avgMemoryUtilization || metrics?.memoryUtilization || 0;
        
        // Create recommendation with calculation metadata
        const recommendation = await storage.createRecommendation({
          tenantId: SYSTEM_TENANT_ID,
          resourceId: resource.resourceId,
          type: recType,
          priority: riskLevel === 'high' ? 'critical' : (riskLevel === 'medium' ? 'high' : 'medium'),
          title: this.generateRecommendationTitle(recType, resource.resourceType),
          description: this.generateRecommendationDescription(recType, cpuUtil, memUtil, monthlySavings, resource),
          currentConfig: resource.currentConfig as any,
          recommendedConfig: this.generateRecommendedConfig(recType, resource),
          projectedMonthlySavings: monthlySavings,
          riskLevel: numericRiskLevel,
          executionMode: executionModeResult.executionMode,
          calculationMetadata: {
            resourceMonthlyCost: resourceMonthlyCost,
            savingsPercentage: savingsPercentage * 100, // Convert to percentage
            methodology: 'Heuristics-based analysis using utilization patterns and cost data'
          }
        }, SYSTEM_TENANT_ID);
        
        newRecommendationsCount++;
        totalSavings += monthlySavings;
        
        // Count autonomous vs HITL
        if (executionModeResult.executionMode === 'autonomous') {
          autonomousCount++;
        } else {
          hitlCount++;
        }
        
        // Auto-execute autonomous recommendations (regardless of autonomousMode config)
        if (executionModeResult.executionMode === 'autonomous') {
          try {
            await this.executeSyntheticOptimization(recommendation);
            await storage.updateRecommendationStatus(recommendation.id, 'executed', SYSTEM_TENANT_ID);
            autoOptimizedCount++;
            
            console.log(`✅ Auto-executed: ${recommendation.title} (autonomous)`);
          } catch (error) {
            console.error(`❌ Auto-execution failed for ${recommendation.id}:`, error);
            await storage.updateRecommendationStatus(recommendation.id, 'failed', SYSTEM_TENANT_ID);
          }
        }
      }
      
      if (newRecommendationsCount > 0) {
        console.log(`💡 ${newRecommendationsCount} Recommendation${newRecommendationsCount > 1 ? 's' : ''} (${autonomousCount} Auto | ${hitlCount} HITL)`);
        if (autoOptimizedCount > 0) {
          console.log(`✅ ${autoOptimizedCount} Auto-Optimization${autoOptimizedCount > 1 ? 's' : ''} Executed`);
        }
        if (hitlCount > 0) {
          console.log(`🕒 ${hitlCount} HITL Pending Approval`);
        }
      }
    } catch (error) {
      console.error('Error generating heuristic recommendations:', error);
    }
  }
  
  // Determine the appropriate recommendation type based on resource type and metrics
  private getRecommendationTypeForResource(resource: any): string {
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
        // EC2: Low CPU AND memory = oversized instance → rightsizing
        // Spec page 14: "Oversized instances: CPU < 20% AND memory < 20%"
        return 'rightsizing';

      case 'RDS':
        // RDS: Low CPU = oversized database → rightsizing
        // Spec page 14: "Oversized databases: CPUUtilization < 20%"
        return 'rightsizing';

      case 'Redshift':
        // Redshift: Low CPU = oversized cluster → rightsizing or scheduling
        // Spec page 14: "Oversized clusters: CPUUtilization < 20%"
        // Scheduling makes sense for dev clusters, rightsizing for prod
        return Math.random() < 0.7 ? 'rightsizing' : 'scheduling';

      default:
        // Unknown resource types
        return 'rightsizing';
    }
  }

  private generateRecommendationTitle(type: string, resourceType: string): string {
    const titles: Record<string, string[]> = {
      rightsizing: [
        `Downsize Underutilized ${resourceType} Instance`,
        `${resourceType} Right-Sizing Opportunity`,
        `Reduce ${resourceType} Instance Capacity`
      ],
      scheduling: [
        `Enable Scheduled Shutdown for ${resourceType}`,
        `Implement Auto-Scaling Schedule for ${resourceType}`,
        `Add Off-Hours Scheduling to ${resourceType}`
      ],
      'storage-tiering': [
        `Move ${resourceType} Data to Cold Storage`,
        `Implement Storage Tiering for ${resourceType}`,
        `Archive Unused ${resourceType} Data`
      ],
      // New resource type recommendations
      'delete-unattached': [
        `Delete Unattached EBS Volume`,
        `Remove Orphaned EBS Volume`,
        `Clean Up Unused EBS Storage`
      ],
      'volume-rightsizing': [
        `Reduce Over-Provisioned EBS IOPS`,
        `Downgrade EBS Volume Type`,
        `Right-Size EBS Volume Configuration`
      ],
      'delete-orphaned': [
        `Delete Orphaned EBS Snapshot`,
        `Remove Snapshot with Deleted Source Volume`,
        `Clean Up Stale EBS Snapshot`
      ],
      'snapshot-cleanup': [
        `Archive Old EBS Snapshot`,
        `Implement Snapshot Lifecycle Policy`,
        `Clean Up Aged EBS Snapshots`
      ],
      'release-eip': [
        `Release Unassociated Elastic IP`,
        `Remove Idle Elastic IP Address`,
        `Clean Up Unused Elastic IP`
      ],
      'delete-unused': [
        `Delete Unused ${resourceType}`,
        `Remove Idle ${resourceType}`,
        `Terminate Inactive ${resourceType}`
      ],
      'nat-consolidation': [
        `Consolidate NAT Gateway Traffic`,
        `Optimize NAT Gateway Usage`,
        `Reduce NAT Gateway Footprint`
      ],
      'lb-consolidation': [
        `Consolidate Load Balancer Resources`,
        `Optimize Load Balancer Configuration`,
        `Remove Underutilized Load Balancer`
      ],
      'lambda-rightsizing': [
        `Right-Size Lambda Memory Allocation`,
        `Reduce Over-Provisioned Lambda Memory`,
        `Optimize Lambda Configuration`
      ]
    };

    const options = titles[type] || [`Optimize ${resourceType} Configuration`];
    return options[Math.floor(Math.random() * options.length)];
  }
  
  private generateRecommendationDescription(type: string, cpuUtil: number, memUtil: number, monthlySavings: number, resource?: any): string {
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
  
  private generateRecommendedConfig(type: string, resource: any): any {
    const current = resource.currentConfig || {};
    const metrics = resource.utilizationMetrics as any;

    switch (type) {
      case 'rightsizing':
        return {
          ...current,
          instanceSize: 'reduced',
          recommendation: 'Downsize by 1-2 tiers'
        };

      case 'scheduling':
        return {
          ...current,
          schedule: 'Mon-Fri 8AM-6PM',
          autoShutdown: true
        };

      case 'storage-tiering':
        return {
          ...current,
          storageClass: 'GLACIER',
          tieringEnabled: true,
          lifecycleRules: true
        };

      case 'delete-unattached':
      case 'delete-orphaned':
      case 'delete-unused':
        return {
          action: 'DELETE',
          previousState: current,
          reason: 'Resource is unused/orphaned'
        };

      case 'volume-rightsizing':
        return {
          ...current,
          volumeType: 'gp3',
          iops: Math.min(3000, current.iops || 3000), // Reduce to base gp3
          recommendation: 'Downgrade to gp3 with base IOPS'
        };

      case 'snapshot-cleanup':
        return {
          action: 'DELETE_OR_ARCHIVE',
          lifecyclePolicy: {
            deleteAfterDays: 90,
            archiveAfterDays: 30
          }
        };

      case 'release-eip':
        return {
          action: 'RELEASE',
          previousState: current,
          reason: 'Elastic IP is unassociated'
        };

      case 'nat-consolidation':
        return {
          ...current,
          recommendation: 'Consolidate with other NAT Gateways or use VPC endpoints',
          alternativeOptions: ['VPC Endpoints', 'NAT Instance']
        };

      case 'lb-consolidation':
        return {
          ...current,
          recommendation: 'Consolidate targets or delete if unused',
          alternativeOptions: ['Merge with another ALB', 'Delete']
        };

      case 'lambda-rightsizing':
        const currentMemory = current.memorySize || 1024;
        const usedMemory = metrics?.maxMemoryUsedMB || currentMemory;
        // Recommend 1.5x the used memory with a minimum of 128MB
        const recommendedMemory = Math.max(128, Math.ceil(usedMemory * 1.5 / 64) * 64);
        return {
          ...current,
          memorySize: recommendedMemory,
          recommendation: `Reduce from ${currentMemory}MB to ${recommendedMemory}MB`
        };

      default:
        return {
          ...current,
          optimized: true
        };
    }
  }
  
  // Execute synthetic optimization (simulation only - no real AWS changes)
  private async executeSyntheticOptimization(recommendation: any) {
    try {
      // Record the optimization in history
      await storage.createOptimizationHistory({
        tenantId: SYSTEM_TENANT_ID,
        recommendationId: recommendation.id,
        executedBy: 'heuristic-autopilot',
        executionDate: new Date(),
        beforeConfig: recommendation.currentConfig,
        afterConfig: recommendation.recommendedConfig,
        actualSavings: recommendation.projectedMonthlySavings,
        status: 'success'
      }, SYSTEM_TENANT_ID);
    } catch (error) {
      // Record failed optimization
      await storage.createOptimizationHistory({
        tenantId: SYSTEM_TENANT_ID,
        recommendationId: recommendation.id,
        executedBy: 'heuristic-autopilot',
        executionDate: new Date(),
        beforeConfig: recommendation.currentConfig,
        afterConfig: recommendation.recommendedConfig,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error)
      }, SYSTEM_TENANT_ID);
      
      throw error;
    }
  }

  private async executeOptimization(recommendation: any) {
    try {
      let result;
      
      if (recommendation.type === 'resize' && recommendation.resourceId.includes('redshift')) {
        // Execute Redshift cluster resize
        const config = recommendation.recommendedConfig;
        result = await awsService.resizeRedshiftCluster(
          recommendation.resourceId,
          config.nodeType,
          config.numberOfNodes
        );
        
        // Record the optimization in history
        await storage.createOptimizationHistory({
          tenantId: SYSTEM_TENANT_ID,
          recommendationId: recommendation.id,
          executedBy: 'autonomous-agent',
          executionDate: new Date(),
          beforeConfig: recommendation.currentConfig,
          afterConfig: recommendation.recommendedConfig,
          actualSavings: recommendation.projectedMonthlySavings,
          status: 'success'
        }, SYSTEM_TENANT_ID);
      }
      
      return result;
    } catch (error) {
      // Record failed optimization
      await storage.createOptimizationHistory({
        tenantId: SYSTEM_TENANT_ID,
        recommendationId: recommendation.id,
        executedBy: 'autonomous-agent',
        executionDate: new Date(),
        beforeConfig: recommendation.currentConfig,
        afterConfig: recommendation.recommendedConfig,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error)
      }, SYSTEM_TENANT_ID);

      throw error;
    }
  }
}

export const schedulerService = new SchedulerService();
