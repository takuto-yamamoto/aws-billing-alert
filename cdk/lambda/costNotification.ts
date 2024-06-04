import {
  CostExplorerClient,
  GetCostAndUsageCommand,
  GetCostAndUsageCommandOutput,
  Granularity,
  Group,
  GroupDefinitionType,
  Metric,
} from '@aws-sdk/client-cost-explorer';
import axios from 'axios';
import dayjs, { Dayjs } from 'dayjs';

export const handler = async () => {
  try {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      throw new Error('SLACK_WEBHOOK_URLが環境変数に設定されていません');
    }

    const start = dayjs().add(9, 'hours').startOf('month');
    const end = dayjs().add(9, 'hours');
    const monthlyCost = await getAccountCost(start, end);

    const { title, details } = createMessage(monthlyCost, start, end);
    await sendMessage(webhookUrl, title, details);

    console.info(`コスト通知に成功しました！`);
  } catch (error) {
    console.log(error);
    throw new Error(`コスト通知に失敗しました: ${error}`);
  }
};

const getAccountCost = async (start: Dayjs, end: Dayjs) => {
  const client = new CostExplorerClient({ region: 'ap-northeast-1' });

  const response = await client.send(
    new GetCostAndUsageCommand({
      TimePeriod: {
        Start: start.format('YYYY-MM-DD'),
        End: end.format('YYYY-MM-DD'),
      },
      Granularity: Granularity.MONTHLY,
      Metrics: [Metric.UNBLENDED_COST],
      GroupBy: [
        {
          Type: GroupDefinitionType.DIMENSION,
          Key: 'SERVICE',
        },
      ],
    })
  );

  return response;
};

const createMessage = (
  monthlyCost: GetCostAndUsageCommandOutput,
  start: Dayjs,
  end: Dayjs
) => {
  // 全グループ（AWSサービス）の合計月間利用金額を取得
  const getGroupCost = (group: Group) =>
    parseFloat(group.Metrics?.UnblendedCost.Amount ?? '0');
  const groups = monthlyCost.ResultsByTime?.[0].Groups ?? [];
  const monthlyTotalCost = groups
    .reduce((acc, group) => acc + getGroupCost(group), 0)
    .toFixed(2);
  const title = `${start.format('MM-DD')}～${end.format('MM-DD')}の請求額は、${monthlyTotalCost} USDです。`; // prettier-ignore

  // 各グループ（AWSサービス）の月間利用金額を取得（上位10サービス、0.005ドル未満切り捨て）
  const totalCostsByGroup = groups
    .map((group) => ({
      serviceName: group.Keys?.join('/') ?? '不明なサービス',
      serviceCost: getGroupCost(group),
    }))
    .filter(({ serviceCost }) => serviceCost >= 0.005)
    .sort((a, b) => b.serviceCost - a.serviceCost)
    .slice(0, 10);
  const details = totalCostsByGroup
    .map(
      ({ serviceName, serviceCost }) =>
        `  ・${serviceName}: ${serviceCost.toFixed(2)} USD`
    )
    .join('\n');

  return { title, details };
};

const sendMessage = async (
  webhookUrl: string,
  title: string,
  details: string
) => {
  const payload = {
    attachments: [
      {
        color: '#36a64f',
        pretext: title,
        text: details,
      },
    ],
  };

  await axios.post(webhookUrl, payload);
};
