import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, MessageSquare } from "lucide-react";
import type { AwsResource } from "@shared/schema";

export function ResourceMonitor() {
  const { data: resources, isLoading } = useQuery<AwsResource[]>({
    queryKey: ['/api/aws-resources'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Resource Utilization</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse space-y-3">
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-2 bg-muted rounded"></div>
                <div className="h-3 bg-muted rounded w-1/3"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!resources || resources.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-foreground">Resource Utilization</CardTitle>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <RotateCcw className="w-4 h-4" />
              <span>Real-time</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">No resources found</p>
            <p className="text-sm text-muted-foreground mt-2">AWS resources will appear here once discovered</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Group resources by type for better display
  const resourcesByType = resources.reduce((acc, resource) => {
    if (!acc[resource.resourceType]) {
      acc[resource.resourceType] = [];
    }
    acc[resource.resourceType].push(resource);
    return acc;
  }, {} as Record<string, AwsResource[]>);

  const getUtilizationData = (resourceType: string, resources: AwsResource[]) => {
    // Calculate average utilization based on resource type - each type has different metrics
    const utilizationValues = resources
      .map(r => r.utilizationMetrics)
      .filter(Boolean)
      .map(metrics => {
        if (typeof metrics !== 'object' || !metrics) return 0;
        const m = metrics as Record<string, unknown>;

        // Different resource types use different utilization metrics
        switch (resourceType) {
          case 'EC2':
          case 'RDS':
          case 'Redshift':
            // Compute resources: use CPU utilization
            return Number(m.avgCpuUtilization ?? m.cpuUtilization ?? 0);

          case 'EBS':
            // Storage: use IOPS utilization or estimate from read/write ops
            if (m.iopsUtilization !== undefined) return Number(m.iopsUtilization);
            // If no IOPS data, estimate based on activity (some activity = some utilization)
            const readOps = Number(m.readOps ?? 0);
            const writeOps = Number(m.writeOps ?? 0);
            return (readOps + writeOps) > 0 ? Math.min(50, (readOps + writeOps) / 1000) : 0;

          case 'EBS_Snapshot':
            // Snapshots: invert age into "freshness" - newer = higher utilization
            const ageInDays = Number(m.ageInDays ?? 0);
            // Snapshots < 30 days = 100%, > 365 days = 0%
            return Math.max(0, Math.min(100, 100 - (ageInDays / 365) * 100));

          case 'ElasticIP':
            // EIPs: associated = 100% utilized, unassociated = 0%
            return m.isAssociated === true ? 100 : 0;

          case 'NATGateway':
            // NAT: invert idle percentage (100% idle = 0% utilization)
            const idlePercent = Number(m.idleTimePercent ?? 0);
            return Math.max(0, 100 - idlePercent);

          case 'LoadBalancer':
            // LB: estimate from request count and healthy hosts
            const requests = Number(m.requestCount ?? 0);
            const healthyHosts = Number(m.healthyHostCount ?? 0);
            if (healthyHosts === 0) return 0;
            // Some requests = some utilization
            return requests > 0 ? Math.min(100, 20 + (requests / 10000) * 80) : 0;

          case 'S3':
            // S3: use access frequency or lifecycle policy as proxy
            const accessFreq = String(m.accessFrequency ?? 'unknown').toLowerCase();
            if (accessFreq === 'frequent') return 80;
            if (accessFreq === 'infrequent') return 40;
            if (accessFreq === 'rare' || accessFreq === 'none') return 10;
            return m.hasLifecyclePolicy ? 60 : 30;

          case 'Lambda':
            // Lambda: use memory utilization or invocation activity
            if (m.memoryUtilization !== undefined) return Number(m.memoryUtilization);
            const invocations = Number(m.invocations ?? 0);
            return invocations > 0 ? Math.min(100, invocations / 100) : 0;

          default:
            // Fallback: try common fields
            return Number(m.avgCpuUtilization ?? m.cpuUtilization ?? m.utilization ?? 0);
        }
      });

    const avgUtilization = utilizationValues.length > 0
      ? utilizationValues.reduce((sum, val) => sum + val, 0) / utilizationValues.length
      : 0;

    const underUtilizedCount = resources.filter(r => {
      const metrics = r.utilizationMetrics;
      if (typeof metrics !== 'object' || !metrics) return false;
      const m = metrics as Record<string, unknown>;

      // Under-utilized threshold varies by resource type
      switch (resourceType) {
        case 'EC2':
        case 'RDS':
        case 'Redshift':
          return Number(m.avgCpuUtilization ?? m.cpuUtilization ?? 0) < 20;
        case 'ElasticIP':
          return m.isAssociated === false;
        case 'Lambda':
          return Number(m.memoryUtilization ?? 100) < 50 || Number(m.invocations ?? 0) === 0;
        default:
          return Number(m.avgCpuUtilization ?? m.cpuUtilization ?? 50) < 50;
      }
    }).length;

    return {
      avgUtilization: Math.round(avgUtilization),
      underUtilizedCount,
      totalCount: resources.length
    };
  };

  const getUtilizationColor = (utilization: number) => {
    if (utilization < 30) return 'bg-destructive';
    if (utilization < 70) return 'bg-chart-3';
    return 'bg-accent';
  };

  const getUtilizationStatus = (utilization: number, underUtilized: number, total: number) => {
    if (utilization > 80) return 'Well optimized';
    if (underUtilized === 0) return 'Optimized';
    return `${underUtilized} of ${total} under-utilized`;
  };

  return (
    <Card data-testid="resource-monitor">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">Resource Utilization</CardTitle>
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <RotateCcw className="w-4 h-4" />
            <span>Real-time</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {Object.entries(resourcesByType).map(([resourceType, typeResources], index) => {
            const utilData = getUtilizationData(resourceType, typeResources);
            
            return (
              <div key={resourceType} data-testid={`resource-type-${index}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground" data-testid={`resource-type-name-${index}`}>
                    {resourceType} {resourceType === 'Redshift' ? 'Clusters' : 'Instances'}
                  </span>
                  <span className="text-sm text-muted-foreground" data-testid={`resource-utilization-${index}`}>
                    {utilData.avgUtilization}% avg utilization
                  </span>
                </div>
                <Progress 
                  value={utilData.avgUtilization} 
                  className="w-full h-2"
                  data-testid={`resource-progress-${index}`}
                />
                <p className="text-xs text-muted-foreground mt-1" data-testid={`resource-status-${index}`}>
                  {getUtilizationStatus(utilData.avgUtilization, utilData.underUtilizedCount, utilData.totalCount)}
                </p>
              </div>
            );
          })}

          <div className="mt-6 p-4 bg-muted/50 rounded-lg" data-testid="slack-integration">
            <div className="flex items-center space-x-2 mb-2">
              <MessageSquare className="w-4 h-4 text-chart-3" />
              <span className="text-sm font-medium text-foreground">Slack Integration</span>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              #finops-alerts channel configured for notifications
            </p>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-accent rounded-full animate-pulse"></div>
                <span className="text-xs text-muted-foreground">Connected</span>
              </div>
              <Button variant="ghost" size="sm" className="text-xs text-primary hover:underline" data-testid="button-configure-slack">
                Configure
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
