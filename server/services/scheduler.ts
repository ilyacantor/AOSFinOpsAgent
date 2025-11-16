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
    this.initializeScheduledTasks();
    this.initializeConfiguration();
    this.initializeSyntheticData();
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
    const config = await configService.getAgentConfig();
    
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
              projectedAnnualSavings: Number(analysis.recommendation.projectedSavings.annual),
              riskLevel: analysis.recommendation.avgUtilization < 25 ? 5 : 10
            }, SYSTEM_TENANT_ID);

            // Check if we can execute autonomously
            const canExecuteAutonomously = await configService.canExecuteAutonomously({
              type: recommendation.type,
              riskLevel: recommendation.riskLevel ?? 0,
              projectedAnnualSavings: recommendation.projectedAnnualSavings
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
                projectedAnnualSavings: recommendation.projectedAnnualSavings,
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
      const aiRecommendations = await geminiAI.analyzeResourcesForOptimization(allResources);
      
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
            projectedAnnualSavings: recommendation.projectedAnnualSavings
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
              projectedAnnualSavings: recommendation.projectedAnnualSavings,
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
          sum + (rec.projectedAnnualSavings || 0), 0
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
      
      // Skip if Prod Mode is active (AI takes over)
      if (config.prodMode) {
        return;
      }
      
      // Get all resources from database
      const resources = await storage.getAllAwsResources(SYSTEM_TENANT_ID);
      
      if (resources.length === 0) {
        return;
      }
      
      // Identify underutilized resources (potential waste)
      const wastefulResources = resources.filter(resource => {
        const metrics = resource.utilizationMetrics as any;
        if (!metrics) return false;
        
        // Define waste thresholds
        const cpuUtil = metrics.avgCpuUtilization || metrics.cpuUtilization || 50;
        const memUtil = metrics.avgMemoryUtilization || metrics.memoryUtilization || 50;
        
        // Resource is wasteful if CPU < 30% OR Memory < 40%
        return cpuUtil < 30 || memUtil < 40;
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
        
        // Generate synthetic recommendation
        const recType = ['rightsizing', 'scheduling', 'storage-tiering'][Math.floor(Math.random() * 3)] as any;
        
        // 80% autonomous (low-risk) / 20% HITL (medium+high risk) distribution
        const riskRandom = Math.random();
        const riskLevel = riskRandom < 0.80 ? 'low' : (riskRandom < 0.90 ? 'medium' : 'high');
        const executionMode = riskLevel === 'low' ? 'autonomous' : 'hitl';
        
        // Generate enterprise-scale savings ($250k-$3M monthly)
        const baseSavings = Math.floor(Math.random() * 2750000) + 250000; // $250k-$3M
        const monthlySavings = baseSavings; // Direct dollar amounts (enterprise scale)
        const annualSavings = monthlySavings * 12;
        
        const metrics = resource.utilizationMetrics as any;
        const cpuUtil = metrics?.avgCpuUtilization || metrics?.cpuUtilization || 0;
        const memUtil = metrics?.avgMemoryUtilization || metrics?.memoryUtilization || 0;
        
        // Create recommendation
        const recommendation = await storage.createRecommendation({
          tenantId: SYSTEM_TENANT_ID,
          resourceId: resource.resourceId,
          type: recType,
          priority: riskLevel === 'high' ? 'critical' : (riskLevel === 'medium' ? 'high' : 'medium'),
          title: this.generateRecommendationTitle(recType, resource.resourceType),
          description: this.generateRecommendationDescription(recType, cpuUtil, memUtil, baseSavings),
          currentConfig: resource.currentConfig as any,
          recommendedConfig: this.generateRecommendedConfig(recType, resource),
          projectedMonthlySavings: monthlySavings,
          projectedAnnualSavings: annualSavings,
          riskLevel: riskLevel === 'low' ? 3 : (riskLevel === 'medium' ? 7 : 9),
          executionMode: executionMode
        }, SYSTEM_TENANT_ID);
        
        newRecommendationsCount++;
        totalSavings += annualSavings;
        
        // Count autonomous vs HITL
        if (executionMode === 'autonomous') {
          autonomousCount++;
        } else {
          hitlCount++;
        }
        
        // Auto-optimize autonomous recommendations (low-risk)
        if (executionMode === 'autonomous') {
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
      ]
    };
    
    const options = titles[type] || [`Optimize ${resourceType} Configuration`];
    return options[Math.floor(Math.random() * options.length)];
  }
  
  private generateRecommendationDescription(type: string, cpuUtil: number, memUtil: number, baseSavings: number): string {
    // baseSavings is the raw dollar amount before 10× multiplier, used for narrative text
    if (type === 'rightsizing') {
      return `Resource running at ${cpuUtil.toFixed(1)}% CPU and ${memUtil.toFixed(1)}% memory utilization. Recommend downsizing to reduce costs by approximately $${baseSavings}/month.`;
    } else if (type === 'scheduling') {
      return `Resource usage patterns suggest potential for scheduled shutdown during off-peak hours. Estimated savings: $${baseSavings}/month.`;
    } else {
      return `Storage analysis indicates underutilized capacity. Implement tiering to cold storage for $${baseSavings}/month savings.`;
    }
  }
  
  private generateRecommendedConfig(type: string, resource: any): any {
    const current = resource.currentConfig || {};
    
    if (type === 'rightsizing') {
      return {
        ...current,
        instanceSize: 'reduced',
        recommendation: 'Downsize by 1-2 tiers'
      };
    } else if (type === 'scheduling') {
      return {
        ...current,
        schedule: 'Mon-Fri 8AM-6PM',
        autoShutdown: true
      };
    } else {
      return {
        ...current,
        storageClass: 'GLACIER',
        tieringEnabled: true
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
