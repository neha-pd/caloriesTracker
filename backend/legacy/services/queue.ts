import { Queue } from 'bullmq';
import { redis } from './redis.js';

export const visionQueue = new Queue('vision-jobs', {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: { count: 100 },
    removeOnFail:     { count: 200 },
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  },
});

export default visionQueue;
