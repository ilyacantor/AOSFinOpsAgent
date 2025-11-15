import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrencyCompact } from "@/lib/currency";
import { TrendingUp, TrendingDown } from "lucide-react";

interface MetricsSummary {
  monthlySpend: number;
  ytdSpend: number;
  identifiedSavingsAwaitingApproval: number;
  realizedSavingsYTD: number;
  wastePercentOptimizedYTD: number;
  monthlySpendChange: number;
  ytdSpendChange: number;
}

export function MetricsCards() {
  const { data: metrics, isLoading } = useQuery<MetricsSummary>({
    queryKey: ['/api/metrics/summary'],
    refetchInterval: 3000, // Refresh every 3 seconds
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-20 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6">
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            No metrics available
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderChangeIndicator = (change: number) => {
    if (change === 0) return null;
    const isPositive = change > 0;
    const Icon = isPositive ? TrendingUp : TrendingDown;
    const colorClass = isPositive ? "text-destructive" : "text-green-500";
    
    return (
      <div className={`flex items-center gap-1 text-sm ${colorClass} mt-1`}>
        <Icon className="w-3.5 h-3.5" />
        <span>{Math.abs(change).toFixed(1)}% vs last period</span>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6">
      <Card className="hover:shadow-lg transition-all duration-200 hover:-translate-y-1" data-testid="card-monthly-spend">
        <CardContent className="p-6">
          <div className="flex flex-col justify-center">
            <p className="text-sm font-medium text-muted-foreground">Monthly AWS Spend</p>
            <p className="text-3xl font-bold text-foreground mt-2" data-testid="monthly-spend-amount">
              {formatCurrencyCompact(metrics.monthlySpend)}
            </p>
            {renderChangeIndicator(metrics.monthlySpendChange)}
          </div>
        </CardContent>
      </Card>

      <Card className="hover:shadow-lg transition-all duration-200 hover:-translate-y-1" data-testid="card-ytd-spend">
        <CardContent className="p-6">
          <div className="flex flex-col justify-center">
            <p className="text-sm font-medium text-muted-foreground">YTD AWS Spend</p>
            <p className="text-3xl font-bold text-foreground mt-2" data-testid="ytd-spend-amount">
              {formatCurrencyCompact(metrics.ytdSpend)}
            </p>
            {renderChangeIndicator(metrics.ytdSpendChange)}
          </div>
        </CardContent>
      </Card>

      <Card className="hover:shadow-lg transition-all duration-200 hover:-translate-y-1" data-testid="card-identified-savings">
        <CardContent className="p-6">
          <div className="flex flex-col justify-center">
            <p className="text-sm font-medium text-muted-foreground">Identified Savings</p>
            <p className="text-3xl font-bold text-accent mt-2" data-testid="identified-savings-amount">
              {formatCurrencyCompact(metrics.identifiedSavingsAwaitingApproval)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Awaiting Approval
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="hover:shadow-lg transition-all duration-200 hover:-translate-y-1" data-testid="card-realized-savings">
        <CardContent className="p-6">
          <div className="flex flex-col justify-center">
            <p className="text-sm font-medium text-muted-foreground">Realized Savings YTD</p>
            <p className="text-3xl font-bold text-green-500 mt-2" data-testid="realized-savings-amount">
              {formatCurrencyCompact(metrics.realizedSavingsYTD)}
            </p>
            <p className="text-sm text-green-500 mt-1">
              Year to Date
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="hover:shadow-lg transition-all duration-200 hover:-translate-y-1" data-testid="card-waste-optimized">
        <CardContent className="p-6">
          <div className="flex flex-col justify-center">
            <p className="text-sm font-medium text-muted-foreground">Waste % Optimized</p>
            <p className="text-3xl font-bold text-chart-3 mt-2" data-testid="waste-optimized-amount">
              {metrics.wastePercentOptimizedYTD.toFixed(1)}%
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              YTD Performance
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
