import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';

export class CostNotificationStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      throw new Error('SLACK_WEBHOOK_URL を /.env に記載してください');
    }

    // コスト通知lambda
    const costNotificationLambda = new NodejsFunction(
      this,
      'CostNotificationLambda',
      {
        runtime: Runtime.NODEJS_20_X,
        entry: './lambda/costNotification.ts',
        timeout: Duration.minutes(15),
        environment: {
          SLACK_WEBHOOK_URL: webhookUrl,
        },
      }
    );
    costNotificationLambda.addToRolePolicy(
      new PolicyStatement({ actions: ['ce:GetCostAndUsage'], resources: ['*'] })
    );

    // 毎日通知するcronジョブの作成
    const scheduledEventBridge = new Rule(this, 'ScheduledEventBridge', {
      schedule: Schedule.cron({ hour: '0', minute: '0' }), // 毎日日本時間9時(GMT0時)に送信
    });
    scheduledEventBridge.addTarget(new LambdaFunction(costNotificationLambda));
  }
}
