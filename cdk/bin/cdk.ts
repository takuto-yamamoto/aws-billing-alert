#!/usr/bin/env node
import 'source-map-support/register';
import * as path from 'path';

import * as cdk from 'aws-cdk-lib';
import * as dotenv from 'dotenv';

import { CostNotificationStack } from '../lib/cost-notification-stack';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const app = new cdk.App();

new CostNotificationStack(app, 'CostNotificationStack');
