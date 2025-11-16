import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, CheckCircle2, XCircle, Clock } from "lucide-react";
import { formatCurrencyK } from "@/lib/currency";
import { useState } from "react";
import { AiHistoryDetailsModal } from "@/components/modals/ai-history-details-modal";

interface AiModeHistoryEntry {
  id: string;
  startTime: string;
  endTime: string | null;
  status: 'running' | 'success' | 'failed';
  summary: string;
  recommendationsGenerated?: number;
  totalSavingsIdentified?: number;
  errorMessage?: string;
  triggeredBy: string;
}

export function AiModeHistory() {
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: history, isLoading } = useQuery<AiModeHistoryEntry[]>({
    queryKey: ['/api/ai-mode-history'],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const handleCardClick = (id: string) => {
    setSelectedHistoryId(id);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedHistoryId(null);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDuration = (start: string, end: string | null) => {
    if (!end) return 'In progress...';
    const duration = (new Date(end).getTime() - new Date(start).getTime()) / 1000;
    return `${duration.toFixed(1)}s`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'running':
        return <Clock className="w-4 h-4 text-cyan-500 animate-spin" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      success: 'default',
      failed: 'destructive',
      running: 'outline'
    } as const;
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || 'outline'}>
        {status}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card className="bg-[#1B1E23] border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-cyan-400" />
            AI Mode History
          </CardTitle>
          <CardDescription className="text-gray-400">
            Loading history...
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-[#1B1E23] border-gray-800" data-testid="ai-mode-history-panel">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-cyan-400" />
            AI Mode History
          </CardTitle>
          <CardDescription className="text-gray-400">
            Last {history?.length || 0} RAG analysis runs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!history || history.length === 0 ? (
            <p className="text-gray-500 text-sm">No AI analysis runs yet</p>
          ) : (
            <div className="space-y-3">
              {history.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => handleCardClick(entry.id)}
                  className="w-full p-3 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-cyan-400 hover:bg-gray-800/70 transition-colors cursor-pointer text-left"
                  data-testid={`ai-history-card-clickable-${entry.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1">
                      {getStatusIcon(entry.status)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">
                          {entry.summary}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatDate(entry.startTime)} • {formatDuration(entry.startTime, entry.endTime)}
                        </p>
                        {entry.status === 'success' && entry.recommendationsGenerated !== undefined && (
                          <p className="text-xs text-cyan-400 mt-1">
                            {entry.recommendationsGenerated} recommendations • 
                            {formatCurrencyK(entry.totalSavingsIdentified || 0)} savings
                          </p>
                        )}
                        {entry.status === 'failed' && entry.errorMessage && (
                          <p className="text-xs text-red-400 mt-1 truncate">
                            Error: {entry.errorMessage}
                          </p>
                        )}
                      </div>
                    </div>
                    {getStatusBadge(entry.status)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AiHistoryDetailsModal 
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        aiHistoryId={selectedHistoryId}
      />
    </>
  );
}
