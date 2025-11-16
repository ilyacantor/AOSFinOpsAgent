import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AwsResource, Recommendation } from "@shared/schema";
import { storage, pineconeCircuitBreaker } from "../storage.js";
import { pineconeService } from "./pinecone.js";

export class GeminiAIService {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private contextCache: {
    data: any;
    timestamp: number;
  } | null = null;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }
    
    this.genAI = new GoogleGenerativeAI(apiKey);
    // Use Gemini 2.5 Flash for optimal speed
    this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  }

  async analyzeResourcesForOptimization(resources: AwsResource[], historicalMetrics?: any): Promise<any[]> {
    // RAG: Retrieve historical context for better AI recommendations
    const historicalContext = await this.retrieveHistoricalContext();
    
    const prompt = this.buildAnalysisPrompt(resources, historicalContext);
    
    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Parse the AI response into structured recommendations
      const recommendations = this.parseRecommendations(text, resources);
      
      // Invalidate cache after generating new recommendations (for fresh RAG on next run)
      this.invalidateCache();
      
      return recommendations;
    } catch (error) {
      console.error("Error generating AI recommendations:", error);
      throw error;
    }
  }

  // Invalidate cache to ensure fresh data on next retrieval
  public invalidateCache(): void {
    this.contextCache = null;
    console.log('🔄 RAG cache invalidated');
  }

  // RAG: Retrieve historical context from Pinecone vector database (Optimized with caching)
  private async retrieveHistoricalContext(): Promise<{
    pastRecommendations: any[];
    optimizationHistory: any[];
    successPatterns: any;
  }> {
    try {
      // Check cache first
      const now = Date.now();
      if (this.contextCache && (now - this.contextCache.timestamp) < this.CACHE_TTL) {
        console.log('📦 Using cached RAG context from Pinecone (performance optimization)');
        return this.contextCache.data;
      }

      // Use Pinecone for semantic search of relevant historical context with circuit breaker protection
      const query = "AWS resource optimization recommendations and execution history";
      const relevantContext = await pineconeCircuitBreaker.executeWithFallback(
        () => pineconeService.retrieveRelevantContext(query, 20),
        [] // Fallback to empty array if circuit is open
      ) || [];
      
      // Separate recommendations from optimization history
      const pastRecommendations = relevantContext
        .filter(ctx => ctx.type === 'recommendation')
        .slice(0, 10);
      
      const optimizationHistory = relevantContext
        .filter(ctx => ctx.type === 'optimization_history')
        .slice(0, 10);
      
      // Calculate success patterns
      const successPatterns = this.analyzeSuccessPatterns(optimizationHistory);
      
      const result = {
        pastRecommendations,
        optimizationHistory,
        successPatterns
      };

      // Update cache
      this.contextCache = {
        data: result,
        timestamp: now
      };

      console.log('✨ RAG context fetched from Pinecone and cached');
      
      return result;
    } catch (error) {
      console.error("Error retrieving historical context from Pinecone:", error);
      return {
        pastRecommendations: [],
        optimizationHistory: [],
        successPatterns: {}
      };
    }
  }

  private analyzeSuccessPatterns(history: any[]): any {
    const successfulOptimizations = history.filter(h => h.status === 'success');
    const failedOptimizations = history.filter(h => h.status === 'failed');
    
    return {
      totalOptimizations: history.length,
      successCount: successfulOptimizations.length,
      failureCount: failedOptimizations.length,
      successRate: history.length > 0 ? (successfulOptimizations.length / history.length * 100).toFixed(1) : '0',
      commonSuccessTypes: this.getCommonTypes(successfulOptimizations),
      commonFailureTypes: this.getCommonTypes(failedOptimizations)
    };
  }

  private getCommonTypes(optimizations: any[]): string[] {
    const typeCounts: Record<string, number> = {};
    optimizations.forEach(opt => {
      const type = opt.beforeConfig?.type || 'unknown';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });
    
    return Object.entries(typeCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([type]) => type);
  }

  private buildAnalysisPrompt(resources: AwsResource[], historicalContext?: any): string {
    const resourceSummary = resources.map(r => ({
      id: r.resourceId,
      type: r.resourceType,
      config: r.currentConfig,
      cost: r.monthlyCost || 0,
      utilization: r.utilizationMetrics
    }));

    // Include RAG context if available
    const ragContext = historicalContext ? `

HISTORICAL CONTEXT (RAG - Learn from Past Optimizations):
${JSON.stringify({
  successRate: historicalContext.successPatterns?.successRate + '%' || 'N/A',
  totalOptimizations: historicalContext.successPatterns?.totalOptimizations || 0,
  successfulTypes: historicalContext.successPatterns?.commonSuccessTypes || [],
  failedTypes: historicalContext.successPatterns?.commonFailureTypes || [],
  recentRecommendations: historicalContext.pastRecommendations?.map((r: any) => ({
    type: r.type,
    status: r.status,
    savings: r.projectedMonthlySavings
  })) || []
}, null, 2)}

LESSONS FROM HISTORY:
- Past successful optimization types: ${historicalContext.successPatterns?.commonSuccessTypes?.join(', ') || 'None yet'}
- Past failed optimization types: ${historicalContext.successPatterns?.commonFailureTypes?.join(', ') || 'None yet'}
- Overall success rate: ${historicalContext.successPatterns?.successRate || '0'}%

Use this historical data to:
1. Favor optimization types that have succeeded before
2. Be cautious with types that have failed previously
3. Learn from past savings patterns
4. Avoid repeating past mistakes
` : '';

    return `You are an expert AWS FinOps consultant analyzing cloud infrastructure for cost optimization opportunities.

RESOURCES TO ANALYZE:
${JSON.stringify(resourceSummary, null, 2)}
${ragContext}

TASK:
Analyze these AWS resources and identify cost optimization opportunities. For each recommendation:
1. Consider actual utilization patterns, not just static thresholds
2. Assess business impact and risk level
3. Provide contextual reasoning for why this optimization makes sense
4. Consider resource relationships and dependencies
5. Calculate realistic savings projections
6. LEARN from historical optimization patterns above (RAG context)

RESPONSE FORMAT (JSON array):
[
  {
    "resourceId": "resource-id",
    "type": "resize|storage-class|reserved-instance|terminate|schedule",
    "priority": "critical|high|medium|low",
    "title": "Brief recommendation title",
    "description": "Detailed explanation with contextual reasoning",
    "currentConfig": {...},
    "recommendedConfig": {...},
    "projectedMonthlySavings": 0,
    "projectedAnnualSavings": 0,
    "riskLevel": "0-100",
    "reasoning": "Why this optimization makes sense for this specific resource"
  }
]

IMPORTANT RULES:
- Only recommend optimizations with clear cost savings (> $10/month)
- Risk levels: 0-5 (very safe), 5-15 (low risk), 15-30 (moderate), 30+ (high risk)
- Consider business context from tags (production vs development)
- Savings must be realistic based on AWS pricing
- All monetary values should be integers (multiply by 1000, no decimal places)
- Provide specific, actionable recommendations
- Use historical success patterns to guide your recommendations

Generate recommendations now:`;
  }

  private parseRecommendations(aiResponse: string, resources: AwsResource[]): any[] {
    try {
      // Extract JSON from the response (AI might wrap it in markdown)
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error("No JSON array found in AI response");
        return [];
      }

      const recommendations = JSON.parse(jsonMatch[0]);
      
      // Validate and normalize recommendations
      return recommendations.map((rec: any) => ({
        resourceId: rec.resourceId,
        type: rec.type || 'resize',
        priority: rec.priority || 'medium',
        title: rec.title || 'AI-Generated Optimization',
        description: rec.description || rec.reasoning || '',
        currentConfig: typeof rec.currentConfig === 'string' 
          ? rec.currentConfig 
          : JSON.stringify(rec.currentConfig),
        recommendedConfig: typeof rec.recommendedConfig === 'string'
          ? rec.recommendedConfig
          : JSON.stringify(rec.recommendedConfig),
        projectedMonthlySavings: Math.round(rec.projectedMonthlySavings * 1000), // Convert to integer * 1000
        projectedAnnualSavings: Math.round(rec.projectedAnnualSavings * 1000), // Convert to integer * 1000
        riskLevel: rec.riskLevel?.toString() || '10',
        status: 'pending'
      }));
    } catch (error) {
      console.error("Error parsing AI recommendations:", error);
      console.error("AI Response:", aiResponse);
      return [];
    }
  }

  async explainRecommendation(recommendation: any, resource: AwsResource): Promise<string> {
    const prompt = `As an AWS FinOps expert, provide a clear, concise explanation for this optimization recommendation:

RESOURCE:
- ID: ${resource.resourceId}
- Type: ${resource.resourceType}
- Current Config: ${JSON.stringify(resource.currentConfig)}
- Monthly Cost: $${(resource.monthlyCost || 0) / 1000}
- Utilization: ${JSON.stringify(resource.utilizationMetrics)}

RECOMMENDATION:
- Type: ${recommendation.type}
- Current: ${recommendation.currentConfig}
- Recommended: ${recommendation.recommendedConfig}
- Projected Savings: $${recommendation.projectedMonthlySavings / 1000}/month
- Risk Level: ${recommendation.riskLevel}%

Explain in 2-3 sentences why this optimization is recommended and what the business impact would be.`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error("Error generating explanation:", error);
      return "Unable to generate explanation at this time.";
    }
  }

  async assessRisk(recommendation: any, resource: AwsResource): Promise<{
    riskScore: number;
    riskFactors: string[];
    mitigationSteps: string[];
  }> {
    const prompt = `Assess the risk of implementing this AWS optimization:

RESOURCE: ${resource.resourceType} (${resource.resourceId})
OPTIMIZATION: ${recommendation.type}
FROM: ${recommendation.currentConfig}
TO: ${recommendation.recommendedConfig}

Provide a JSON response:
{
  "riskScore": 0-100,
  "riskFactors": ["factor1", "factor2"],
  "mitigationSteps": ["step1", "step2"]
}`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error("Error assessing risk:", error);
    }

    return {
      riskScore: 50,
      riskFactors: ["Unable to assess risk automatically"],
      mitigationSteps: ["Review change manually before implementing"]
    };
  }
}

export const geminiAI = new GeminiAIService();
