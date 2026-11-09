import type {
  FullResult,
  Reporter,
  TestCase,
  TestResult
} from '@playwright/test/reporter';

interface SlackMessage {
  text: string;
  blocks?: Array<{
    type: string;
    text?: {
      type: string;
      text: string;
    };
    fields?: Array<{
      type: string;
      text: string;
    }>;
  }>;
}

class SlackReporter implements Reporter {
  private webhookUrl: string;
  private startTime: number = 0;
  private results: {
    passed: number;
    failed: number;
    skipped: number;
    flaky: number;
  } = { passed: 0, failed: 0, skipped: 0, flaky: 0 };

  constructor() {
    this.webhookUrl = process.env.SLACK_WEBHOOK_URL || '';
    if (!this.webhookUrl) {
      console.warn('SLACK_WEBHOOK_URL not set, Slack notifications disabled');
    }
  }

  onBegin() {
    this.startTime = Date.now();
    console.log('🚀 Starting E2E tests with real Holochain data...');
  }

  onTestEnd(test: TestCase, result: TestResult) {
    switch (result.status) {
      case 'passed':
        this.results.passed++;
        break;
      case 'failed':
        this.results.failed++;
        break;
      case 'skipped':
        this.results.skipped++;
        break;
      case 'timedOut':
        this.results.failed++;
        break;
    }

    if (result.status === 'failed' && result.retry < test.retries) {
      this.results.flaky++;
    }
  }

  async onEnd(result: FullResult) {
    if (!this.webhookUrl) return;

    const duration = Date.now() - this.startTime;
    const durationMinutes = Math.round(duration / 60000);
    const total = this.results.passed + this.results.failed + this.results.skipped;

    const isSuccess = result.status === 'passed';
    const emoji = isSuccess ? '✅' : '❌';

    const message: SlackMessage = {
      text: `${emoji} E2E Tests ${isSuccess ? 'Passed' : 'Failed'}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${emoji} Holochain E2E Test Results`
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Status:* ${isSuccess ? 'Passed ✅' : 'Failed ❌'}`
            },
            {
              type: 'mrkdwn',
              text: `*Duration:* ${durationMinutes}m`
            },
            {
              type: 'mrkdwn',
              text: `*Total Tests:* ${total}`
            },
            {
              type: 'mrkdwn',
              text: `*Environment:* ${process.env.TEST_ENV || 'development'}`
            }
          ]
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Passed:* ${this.results.passed} ✅`
            },
            {
              type: 'mrkdwn',
              text: `*Failed:* ${this.results.failed} ❌`
            },
            {
              type: 'mrkdwn',
              text: `*Skipped:* ${this.results.skipped} ⏭️`
            },
            {
              type: 'mrkdwn',
              text: `*Flaky:* ${this.results.flaky} ⚠️`
            }
          ]
        }
      ]
    };

    // Add failure details if there are failures
    if (this.results.failed > 0) {
      message.blocks?.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Failed Tests:* ${this.results.failed} tests failed. Check the CI logs for details.`
        }
      });
    }

    // Add CI information if available
    if (process.env.GITHUB_RUN_ID) {
      const runUrl = `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
      message.blocks?.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `<${runUrl}|View CI Run>`
        }
      });
    }

    try {
      await this.sendSlackMessage(message);
      console.log('✅ Slack notification sent successfully');
    } catch (error) {
      console.error('❌ Failed to send Slack notification:', error);
    }
  }

  private async sendSlackMessage(message: SlackMessage): Promise<void> {
    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status} ${response.statusText}`);
    }
  }
}

export default SlackReporter;
