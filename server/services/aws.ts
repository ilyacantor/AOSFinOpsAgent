import AWS from 'aws-sdk';

export class AWSService {
  private costExplorer?: AWS.CostExplorer;
  private cloudWatch?: AWS.CloudWatch;
  private redshift?: AWS.Redshift;
  private support?: AWS.Support;
  private s3?: AWS.S3;
  private initialized = false;
  private initializationFailed = false;
  private lastInitAttempt = 0;

  constructor() {
    // Don't instantiate AWS clients in constructor - use lazy initialization
  }

  private hasAWSCredentials(): boolean {
    return !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
  }

  /**
   * Layer 3 Defense: Centralized guard for AWS client availability
   * Returns true if clients are ready, false otherwise
   * NEVER throws - safe to call from any context
   */
  private isReady(): boolean {
    // First check: already initialized and all clients exist
    if (this.initialized && this.costExplorer && this.cloudWatch && this.redshift && this.support && this.s3) {
      return true;
    }
    
    // Second check: if initialization previously failed, don't retry immediately (cooldown: 30 seconds)
    const now = Date.now();
    if (this.initializationFailed && (now - this.lastInitAttempt) < 30000) {
      return false;
    }
    
    // Third check: try to initialize if credentials available
    if (!this.initialized && this.hasAWSCredentials()) {
      this.lastInitAttempt = now;
      this.initializeClients(); // Never throws
      return this.initialized;
    }
    
    // Final fallback: not ready (no credentials or initialization failed)
    return false;
  }

  /**
   * Layer 3 Defense: Initialize AWS clients - NEVER throws
   * Sets initialized=true on success, initializationFailed=true on failure
   */
  private initializeClients() {
    if (this.initialized) return;

    try {
      if (!this.hasAWSCredentials()) {
        // Layer 3 Defense: Gracefully handle missing credentials
        const simulationMode = process.env.SIMULATION_MODE?.toLowerCase() === 'true';
        console.warn(`⚠️  [AWS Service] No credentials available${simulationMode ? ' (simulation mode enabled)' : ''} - AWS clients not initialized`);
        this.initializationFailed = true;
        return; // Graceful exit - DO NOT THROW
      }

      // Configure AWS SDK only when we have credentials
      AWS.config.update({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'us-east-1'
      });

      this.costExplorer = new AWS.CostExplorer({ region: 'us-east-1' });
      this.cloudWatch = new AWS.CloudWatch();
      this.redshift = new AWS.Redshift();
      this.support = new AWS.Support({ region: 'us-east-1' });
      this.s3 = new AWS.S3();
      this.initialized = true;
      this.initializationFailed = false;
      console.log('✅ [AWS Service] AWS clients initialized successfully');
    } catch (error) {
      console.error('⚠️  [AWS Service] Failed to initialize AWS clients:', error);
      this.initializationFailed = true;
      // DO NOT THROW - graceful failure
    }
  }

  async getCostAndUsageReports(startDate: string, endDate: string) {
    // Layer 3 Defense: Centralized guard - never throws
    if (!this.isReady()) {
      console.warn('⚠️  [AWS Service] getCostAndUsageReports - clients not available, returning empty array');
      return [];
    }
    
    try {
      const params = {
        TimePeriod: {
          Start: startDate,
          End: endDate
        },
        Granularity: 'DAILY',
        Metrics: ['BlendedCost', 'UsageQuantity'],
        GroupBy: [
          {
            Type: 'DIMENSION',
            Key: 'SERVICE'
          }
        ]
      };

      const result = await this.costExplorer.getCostAndUsage(params).promise();
      return result.ResultsByTime || [];
    } catch (error) {
      console.error('Error fetching cost and usage reports:', error);
      throw error;
    }
  }

  async getCloudWatchMetrics(resourceId: string, metricName: string, namespace: string, startTime: Date, endTime: Date) {
    // Layer 3 Defense: Centralized guard - never throws
    if (!this.isReady()) {
      console.warn('⚠️  [AWS Service] getCloudWatchMetrics - clients not available, returning empty array');
      return [];
    }
    
    try {
      const params = {
        MetricName: metricName,
        Namespace: namespace,
        StartTime: startTime,
        EndTime: endTime,
        Period: 3600, // 1 hour
        Statistics: ['Average', 'Maximum'],
        Dimensions: [
          {
            Name: 'DBInstanceIdentifier',
            Value: resourceId
          }
        ]
      };

      const result = await this.cloudWatch.getMetricStatistics(params).promise();
      return result.Datapoints || [];
    } catch (error) {
      console.error('Error fetching CloudWatch metrics:', error);
      throw error;
    }
  }

  async getTrustedAdvisorChecks() {
    // Layer 3 Defense: Centralized guard - never throws
    if (!this.isReady()) {
      console.warn('⚠️  [AWS Service] getTrustedAdvisorChecks - clients not available, returning empty array');
      return [];
    }
    
    try {
      const checks = await this.support.describeTrustedAdvisorChecks({ language: 'en' }).promise();
      
      const costOptimizationChecks = checks.checks.filter(check => 
        check.category === 'cost_optimizing'
      );

      const results = [];
      for (const check of costOptimizationChecks) {
        try {
          const checkResult = await this.support.describeTrustedAdvisorCheckResult({
            checkId: check.id,
            language: 'en'
          }).promise();
          
          results.push({
            checkId: check.id,
            name: check.name,
            description: check.description,
            category: check.category,
            result: checkResult.result
          });
        } catch (error) {
          console.error(`Error fetching Trusted Advisor check ${check.id}:`, error);
        }
      }

      return results;
    } catch (error) {
      console.error('Error fetching Trusted Advisor checks:', error);
      throw error;
    }
  }

  async getRedshiftClusters() {
    // Layer 3 Defense: Centralized guard - never throws
    if (!this.isReady()) {
      console.warn('⚠️  [AWS Service] getRedshiftClusters - clients not available, returning empty array');
      return [];
    }
    
    try {
      const result = await this.redshift.describeClusters().promise();
      return result.Clusters || [];
    } catch (error) {
      console.error('Error fetching Redshift clusters:', error);
      throw error;
    }
  }

  async resizeRedshiftCluster(clusterIdentifier: string, nodeType: string, numberOfNodes: number) {
    // Layer 3 Defense: Centralized guard - throw for mutating operations
    if (!this.isReady()) {
      throw new Error('Cannot resize Redshift cluster - AWS credentials not available');
    }
    
    try {
      const params = {
        ClusterIdentifier: clusterIdentifier,
        NodeType: nodeType,
        NumberOfNodes: numberOfNodes
      };

      const result = await this.redshift.resizeCluster(params).promise();
      return result.Cluster;
    } catch (error) {
      console.error('Error resizing Redshift cluster:', error);
      throw error;
    }
  }

  async getRedshiftClusterUtilization(clusterIdentifier: string, startTime: Date, endTime: Date) {
    // Layer 3 Defense: Centralized guard - never throws
    if (!this.isReady()) {
      console.warn('⚠️  [AWS Service] getRedshiftClusterUtilization - clients not available, returning empty utilization');
      return { cpuUtilization: [] };
    }
    
    try {
      const cpuParams = {
        MetricName: 'CPUUtilization',
        Namespace: 'AWS/Redshift',
        StartTime: startTime,
        EndTime: endTime,
        Period: 3600,
        Statistics: ['Average'],
        Dimensions: [
          {
            Name: 'ClusterIdentifier',
            Value: clusterIdentifier
          }
        ]
      };

      const cpuMetrics = await this.cloudWatch.getMetricStatistics(cpuParams).promise();
      
      return {
        cpuUtilization: cpuMetrics.Datapoints || []
      };
    } catch (error) {
      console.error('Error fetching Redshift cluster utilization:', error);
      throw error;
    }
  }

  async analyzeRedshiftClusterOptimization(clusterIdentifier: string) {
    // Layer 3 Defense: Centralized guard - never throws
    if (!this.isReady()) {
      console.warn('⚠️  [AWS Service] analyzeRedshiftClusterOptimization - clients not available, returning no recommendation');
      return { cluster: null, utilization: 0, recommendation: null };
    }
    
    try {
      // Get cluster details (safe to call - isReady() already passed)
      const clusters = await this.getRedshiftClusters();
      const cluster = clusters.find(c => c.ClusterIdentifier === clusterIdentifier);
      
      if (!cluster) {
        throw new Error(`Cluster ${clusterIdentifier} not found`);
      }

      // Get utilization data for the last 30 days
      const endTime = new Date();
      const startTime = new Date();
      startTime.setDate(startTime.getDate() - 30);

      const utilization = await this.getRedshiftClusterUtilization(clusterIdentifier, startTime, endTime);
      
      // Calculate average utilization
      const avgCpuUtilization = utilization.cpuUtilization.reduce((sum, point) => 
        sum + (point.Average || 0), 0) / utilization.cpuUtilization.length;

      // Determine if optimization is needed
      const isUnderUtilized = avgCpuUtilization < 40; // Less than 40% average CPU
      
      let recommendation = null;
      if (isUnderUtilized) {
        // Suggest smaller instance type
        const currentNodeType = cluster.NodeType;
        let recommendedNodeType = currentNodeType;
        
        // Simple node type downgrade logic
        if (currentNodeType?.includes('16xlarge')) {
          recommendedNodeType = currentNodeType.replace('16xlarge', '4xlarge');
        } else if (currentNodeType?.includes('8xlarge')) {
          recommendedNodeType = currentNodeType.replace('8xlarge', '2xlarge');
        } else if (currentNodeType?.includes('4xlarge')) {
          recommendedNodeType = currentNodeType.replace('4xlarge', 'xlarge');
        }

        if (recommendedNodeType !== currentNodeType) {
          recommendation = {
            type: 'resize',
            currentNodeType,
            recommendedNodeType,
            currentNodes: cluster.NumberOfNodes,
            recommendedNodes: cluster.NumberOfNodes,
            avgUtilization: avgCpuUtilization,
            projectedSavings: this.calculateRedshiftSavings(currentNodeType || '', recommendedNodeType || '', cluster.NumberOfNodes || 1)
          };
        }
      }

      return {
        cluster,
        utilization: avgCpuUtilization,
        recommendation
      };
    } catch (error) {
      console.error('Error analyzing Redshift cluster optimization:', error);
      throw error;
    }
  }

  private calculateRedshiftSavings(currentNodeType: string, recommendedNodeType: string, numberOfNodes: number) {
    // Simplified pricing calculation (should use actual AWS pricing API)
    const pricing: { [key: string]: number } = {
      'ra3.xlarge': 3.26,
      'ra3.2xlarge': 6.52,
      'ra3.4xlarge': 13.04,
      'ra3.16xlarge': 52.16
    };

    const currentHourlyCost = (pricing[currentNodeType] || 0) * numberOfNodes;
    const recommendedHourlyCost = (pricing[recommendedNodeType] || 0) * numberOfNodes;
    
    const hourlySavings = currentHourlyCost - recommendedHourlyCost;
    const monthlySavings = hourlySavings * 24 * 30;
    const annualSavings = monthlySavings * 12;

    return {
      hourly: hourlySavings,
      monthly: monthlySavings,
      annual: annualSavings
    };
  }
}

export const awsService = new AWSService();
