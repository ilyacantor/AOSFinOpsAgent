import { WebClient, type ChatPostMessageArguments } from "@slack/web-api";

// Check if Slack is properly configured
const isSlackEnabled = Boolean(process.env.SLACK_BOT_TOKEN && process.env.SLACK_CHANNEL_ID);
const SLACK_CHANNEL_ID = process.env.SLACK_CHANNEL_ID || "C1234567890";

// Log warning in development mode
if (!isSlackEnabled) {
  console.warn("⚠️ Running in development mode. Slack notifications will be disabled.");
}

const slack = isSlackEnabled ? new WebClient(process.env.SLACK_BOT_TOKEN!) : null;

export async function sendSlackMessage(
  message: ChatPostMessageArguments
): Promise<string | undefined> {
  if (!isSlackEnabled || !slack) {
    console.log('Slack disabled - skipping message');
    return undefined;
  }
  
  try {
    const response = await slack.chat.postMessage(message);
    return response.ts;
  } catch (error) {
    console.error('Error sending Slack message:', error);
    throw error;
  }
}

export async function sendOptimizationRecommendation(recommendation: {
  title: string;
  description: string;
  resourceId: string;
  projectedMonthlySavings: number;
  priority: string;
  recommendationId: string;
}) {
  const channel = SLACK_CHANNEL_ID;
  
  const priorityEmoji = {
    critical: '🚨',
    high: '⚠️',
    medium: '📊',
    low: 'ℹ️'
  };

  const message = {
    channel,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${priorityEmoji[recommendation.priority as keyof typeof priorityEmoji]} New Cost Optimization Opportunity`
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Resource:* ${recommendation.resourceId}`
          },
          {
            type: 'mrkdwn',
            text: `*Priority:* ${recommendation.priority.toUpperCase()}`
          },
          {
            type: 'mrkdwn',
            text: `*Monthly Savings:* $${recommendation.projectedMonthlySavings.toLocaleString()}`
          }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${recommendation.title}*\n${recommendation.description}`
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Review in Dashboard'
            },
            style: 'primary',
            url: `${process.env.REPLIT_DOMAINS || 'http://localhost:5000'}`,
            action_id: 'review_recommendation'
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Approve'
            },
            style: 'primary',
            action_id: 'approve_recommendation',
            value: recommendation.recommendationId
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Reject'
            },
            style: 'danger',
            action_id: 'reject_recommendation',
            value: recommendation.recommendationId
          }
        ]
      }
    ]
  };

  return await sendSlackMessage(message);
}

export async function sendOptimizationComplete(optimization: {
  title: string;
  resourceId: string;
  actualSavings: number;
  status: string;
}) {
  const channel = SLACK_CHANNEL_ID;
  
  const statusEmoji = optimization.status === 'success' ? '✅' : '❌';
  
  const message = {
    channel,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${statusEmoji} Optimization ${optimization.status === 'success' ? 'Completed' : 'Failed'}`
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Resource:* ${optimization.resourceId}`
          },
          {
            type: 'mrkdwn',
            text: `*Status:* ${optimization.status.toUpperCase()}`
          }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${optimization.title}*`
        }
      }
    ]
  };

  if (optimization.status === 'success' && optimization.actualSavings) {
    message.blocks.splice(2, 0, {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `💰 *Monthly Savings Realized:* $${optimization.actualSavings.toLocaleString()}`
      }
    });
  }

  return await sendSlackMessage(message);
}
