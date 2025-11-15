import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { useAgentConfig } from "@/hooks/use-agent-config";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpCircle } from "lucide-react";
import { useEffect, useState } from "react";

export default function FAQ() {
  const { agentConfig, updateProdMode } = useAgentConfig();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    document.title = "FAQ - FinOps Autopilot | Frequently Asked Questions";
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute(
        "content",
        "Get answers to frequently asked questions about FinOps Autopilot, Prod Mode, Heuristic Mode, and cost optimization features."
      );
    } else {
      const meta = document.createElement('meta');
      meta.name = "description";
      meta.content = "Get answers to frequently asked questions about FinOps Autopilot, Prod Mode, Heuristic Mode, and cost optimization features.";
      document.head.appendChild(meta);
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopNav 
        lastSync="Just now"
        prodMode={agentConfig?.prodMode || false}
        onProdModeChange={updateProdMode}
        onMenuClick={() => setIsMobileSidebarOpen(true)}
      />
      <div className="flex-1 flex pt-[60px]">
        <Sidebar 
          isMobileOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />
        <main className="flex-1 overflow-hidden w-full">
          <div className="p-4 sm:p-6 h-full overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center gap-3 mb-6">
                <HelpCircle className="w-8 h-8 text-primary" />
                <h1 className="text-3xl font-bold" data-testid="faq-heading">
                  Frequently Asked Questions
                </h1>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Learn About FinOps Autopilot</CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full" data-testid="faq-accordion">
                    <AccordionItem value="item-1" data-testid="faq-item-what-is-finops">
                      <AccordionTrigger className="text-left">
                        What is FinOps Autopilot?
                      </AccordionTrigger>
                      <AccordionContent>
                        <p className="text-muted-foreground">
                          FinOps Autopilot is an intelligent cloud cost optimization platform that continuously monitors 
                          your AWS infrastructure, identifies cost-saving opportunities, and can automatically execute 
                          optimizations based on your configuration. It combines heuristic analysis with AI-powered 
                          recommendations using Gemini 2.0 Flash and RAG (Retrieval-Augmented Generation) to provide 
                          context-aware cost optimization strategies.
                        </p>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="item-2" data-testid="faq-item-prod-mode">
                      <AccordionTrigger className="text-left">
                        What is Prod Mode?
                      </AccordionTrigger>
                      <AccordionContent>
                        <p className="text-muted-foreground mb-3">
                          Prod Mode enables AI-powered analysis using Gemini 2.0 Flash with RAG (Retrieval-Augmented 
                          Generation). When enabled, the system:
                        </p>
                        <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                          <li>Uses advanced AI models to analyze resource utilization patterns</li>
                          <li>Leverages historical optimization data through RAG for context-aware recommendations</li>
                          <li>Generates more sophisticated and personalized cost optimization strategies</li>
                          <li>Automatically reverts to Heuristic Mode after 5 minutes to manage AI costs</li>
                        </ul>
                        <p className="text-muted-foreground mt-3">
                          <strong>Note:</strong> Prod Mode has higher API costs due to AI model usage, which is why 
                          it automatically reverts to Heuristic Mode.
                        </p>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="item-3" data-testid="faq-item-heuristic-mode">
                      <AccordionTrigger className="text-left">
                        What is Heuristic Mode?
                      </AccordionTrigger>
                      <AccordionContent>
                        <p className="text-muted-foreground mb-3">
                          Heuristic Mode is the default operating mode that uses rule-based analysis to identify 
                          cost optimization opportunities. This mode:
                        </p>
                        <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                          <li>Analyzes resource utilization metrics using predefined thresholds</li>
                          <li>Identifies common cost optimization patterns (underutilized instances, oversized resources, etc.)</li>
                          <li>Operates continuously without additional AI API costs</li>
                          <li>Provides reliable, consistent recommendations based on industry best practices</li>
                        </ul>
                        <p className="text-muted-foreground mt-3">
                          Heuristic Mode is cost-effective and runs 24/7, making it ideal for continuous monitoring.
                        </p>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="item-4" data-testid="faq-item-simulation-data">
                      <AccordionTrigger className="text-left">
                        What data is simulated?
                      </AccordionTrigger>
                      <AccordionContent>
                        <p className="text-muted-foreground mb-3">
                          The system can operate with simulated data for demonstration and testing purposes. 
                          Simulated data includes:
                        </p>
                        <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                          <li><strong>AWS Resources:</strong> EC2 instances, RDS databases, Redshift clusters, and S3 buckets</li>
                          <li><strong>Utilization Metrics:</strong> CPU, memory, storage, and network usage patterns</li>
                          <li><strong>Cost Data:</strong> Historical monthly spending across different services</li>
                          <li><strong>Recommendations:</strong> Cost optimization opportunities based on simulated resource usage</li>
                          <li><strong>Optimization History:</strong> Past executions and their results</li>
                        </ul>
                        <p className="text-muted-foreground mt-3">
                          The simulation evolves dynamically over time, with resources showing changing utilization 
                          patterns and new recommendations being generated continuously.
                        </p>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="item-5" data-testid="faq-item-auto-vs-manual">
                      <AccordionTrigger className="text-left">
                        What are Auto-Optimizations vs Human-Approved Optimizations?
                      </AccordionTrigger>
                      <AccordionContent>
                        <p className="text-muted-foreground mb-3">
                          FinOps Autopilot supports two execution modes:
                        </p>
                        <div className="space-y-4">
                          <div>
                            <h4 className="font-semibold text-foreground mb-2">Auto-Optimizations (Autonomous Mode)</h4>
                            <p className="text-muted-foreground mb-2">
                              When Autonomous Mode is enabled, the system can automatically execute optimizations that meet these criteria:
                            </p>
                            <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                              <li>Risk level is below the configured threshold (default: 5%)</li>
                              <li>Annual savings are below the approval threshold (default: $10,000)</li>
                              <li>Optimization type is in the auto-execute list (e.g., resize, storage-class changes)</li>
                            </ul>
                          </div>
                          <div>
                            <h4 className="font-semibold text-foreground mb-2">Human-Approved Optimizations</h4>
                            <p className="text-muted-foreground mb-2">
                              Higher-risk or high-impact optimizations require manual approval:
                            </p>
                            <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                              <li>High-risk operations (e.g., terminating resources)</li>
                              <li>Large cost impact (above approval threshold)</li>
                              <li>Changes to production-critical resources</li>
                              <li>Any optimization when Autonomous Mode is disabled</li>
                            </ul>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="item-6" data-testid="faq-item-metrics-update">
                      <AccordionTrigger className="text-left">
                        How often are metrics updated?
                      </AccordionTrigger>
                      <AccordionContent>
                        <p className="text-muted-foreground mb-3">
                          Metrics are updated on different schedules based on their type:
                        </p>
                        <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                          <li><strong>Dashboard Metrics:</strong> Auto-refresh every 10 seconds via polling</li>
                          <li><strong>Resource Analysis:</strong> Runs every 6 hours to check for new optimization opportunities</li>
                          <li><strong>Cost Data Sync:</strong> Daily at 2 AM to pull latest AWS billing data</li>
                          <li><strong>Resource Utilization:</strong> Evolves every 30 minutes in simulation mode</li>
                          <li><strong>Trusted Advisor:</strong> Weekly checks every Sunday at 3 AM</li>
                        </ul>
                        <p className="text-muted-foreground mt-3">
                          The system operates continuously in the background, ensuring you always have up-to-date 
                          information for making cost optimization decisions.
                        </p>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="item-7" data-testid="faq-item-data-storage">
                      <AccordionTrigger className="text-left">
                        Where is data stored?
                      </AccordionTrigger>
                      <AccordionContent>
                        <p className="text-muted-foreground mb-3">
                          FinOps Autopilot uses a multi-layered data storage architecture:
                        </p>
                        <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                          <li><strong>PostgreSQL Database:</strong> Stores all resource metadata, recommendations, optimization 
                            history, cost reports, and system configuration</li>
                          <li><strong>Pinecone Vector Database:</strong> Stores embeddings of recommendations and optimization 
                            history for RAG-powered AI analysis</li>
                          <li><strong>In-Memory Cache:</strong> Caches system configuration for fast access</li>
                          <li><strong>Session Storage:</strong> Manages user authentication and session data</li>
                        </ul>
                        <p className="text-muted-foreground mt-3">
                          All data is stored securely with proper encryption and access controls. The system supports 
                          both development and production database environments with automatic backups and rollback capabilities.
                        </p>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
