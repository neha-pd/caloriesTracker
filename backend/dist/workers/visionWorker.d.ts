import { Worker } from 'bullmq';
interface VisionJobData {
    vision_job_id: string;
    log_entry_id: string;
    user_id: string;
    image_url: string;
    daily_log_id: string;
}
export declare function startVisionWorker(): Worker<VisionJobData, any, string>;
export {};
//# sourceMappingURL=visionWorker.d.ts.map