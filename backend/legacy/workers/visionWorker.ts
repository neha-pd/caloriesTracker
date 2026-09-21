import { Worker, Job } from 'bullmq';
import { redis } from '../services/redis.js';
import { analyzeImageWithGemini } from '../services/gemini.js';
import { getNutrientsForItems }   from '../services/usda.js';
import { wsEmitter }              from '../services/wsEmitter.js';
import { getOrCreateDailyLog }    from '../services/logHelpers.js';
import db                         from '../db/client.js';

interface VisionJobData {
  vision_job_id: string;
  log_entry_id:  string;
  user_id:       string;
  image_url:     string;
  daily_log_id:  string;
}

async function processVisionJob(job: Job<VisionJobData>) {
  const { vision_job_id, log_entry_id, user_id, image_url } = job.data;
  const startedAt = Date.now();

  console.log(`🔍 [VisionWorker] Processing job ${job.id} for entry ${log_entry_id}`);

  // Mark job as processing
  await db`
    UPDATE vision_jobs
    SET status = 'processing', started_at = NOW(), attempts = attempts + 1
    WHERE id = ${vision_job_id}
  `;

  await db`
    UPDATE log_entries SET status = 'processing', updated_at = NOW()
    WHERE id = ${log_entry_id}
  `;

  // ── Step 1: Gemini Vision Analysis ──────────────────────────────────────
  let geminiResult;
  try {
    geminiResult = await analyzeImageWithGemini(image_url);
  } catch (err: any) {
    throw new Error(`Gemini analysis failed: ${err.message}`);
  }

  if (!geminiResult.items || geminiResult.items.length === 0) {
    throw new Error('No food items detected in image');
  }

  // ── Step 2: Nutritionix NLP lookup (single batch call) ──────────────────
  let nutrients;
  try {
    nutrients = await getNutrientsForItems(
      geminiResult.items.map(item => ({
        name:     item.name,
        quantity: item.quantity,
        unit:     item.unit,
      }))
    );
  } catch (err: any) {
    throw new Error(`Nutritionix lookup failed: ${err.message}`);
  }

  // ── Step 3: Aggregate totals ─────────────────────────────────────────────
  const totalCalories  = nutrients.reduce((sum, n) => sum + n.calories,  0);
  const totalProtein   = nutrients.reduce((sum, n) => sum + n.protein_g, 0);
  const totalCarbs     = nutrients.reduce((sum, n) => sum + n.carbs_g,   0);
  const totalFat       = nutrients.reduce((sum, n) => sum + n.fat_g,     0);
  const processingMs   = Date.now() - startedAt;

  // ── Step 4: Update log_entry with results ────────────────────────────────
  await db`
    UPDATE log_entries SET
      status               = 'complete',
      calories             = ${+totalCalories.toFixed(2)},
      protein_g            = ${+totalProtein.toFixed(2)},
      carbs_g              = ${+totalCarbs.toFixed(2)},
      fat_g                = ${+totalFat.toFixed(2)},
      ai_confidence        = ${geminiResult.overall_confidence},
      ai_raw_response      = ${JSON.stringify(geminiResult)},
      ai_identified_items  = ${JSON.stringify(
        geminiResult.items.map((item, i) => ({
          ...item,
          calories:  nutrients[i]?.calories  ?? 0,
          protein_g: nutrients[i]?.protein_g ?? 0,
          carbs_g:   nutrients[i]?.carbs_g   ?? 0,
          fat_g:     nutrients[i]?.fat_g     ?? 0,
        }))
      )},
      updated_at = NOW()
    WHERE id = ${log_entry_id}
  `;

  // ── Step 5: Mark vision_job as succeeded ─────────────────────────────────
  await db`
    UPDATE vision_jobs SET
      status               = 'succeeded',
      completed_at         = NOW(),
      gemini_response      = ${JSON.stringify(geminiResult)},
      nutritionix_response = ${JSON.stringify(nutrients)},
      processing_ms        = ${processingMs}
    WHERE id = ${vision_job_id}
  `;

  // ── Step 6: Invalidate dashboard cache ───────────────────────────────────
  await redis.del(`dashboard:today:${user_id}`);

  // ── Step 7: Push result to WebSocket subscribers ─────────────────────────
  const pushPayload = {
    type:             'nutrition_complete',
    log_entry_id,
    calories:         +totalCalories.toFixed(2),
    protein_g:        +totalProtein.toFixed(2),
    carbs_g:          +totalCarbs.toFixed(2),
    fat_g:            +totalFat.toFixed(2),
    ai_confidence:    geminiResult.overall_confidence,
    identified_items: geminiResult.items,
    processing_ms:    processingMs,
  };

  wsEmitter.emit(`log:${log_entry_id}`, pushPayload);
  console.log(`✅ [VisionWorker] Job ${job.id} done in ${processingMs}ms`);
}

async function handleFailedJob(job: Job<VisionJobData> | undefined, err: Error) {
  if (!job) return;
  const { vision_job_id, log_entry_id, user_id } = job.data;

  console.error(`❌ [VisionWorker] Job ${job.id} failed: ${err.message}`);

  // On final failure — set status to 'failed' and push fallback to client
  if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
    await db`
      UPDATE log_entries SET status = 'failed', updated_at = NOW()
      WHERE id = ${log_entry_id}
    `.catch(() => {});

    await db`
      UPDATE vision_jobs SET status = 'failed', completed_at = NOW(), error_message = ${err.message}
      WHERE id = ${vision_job_id}
    `.catch(() => {});

    // Tell the client to fall back to manual entry
    wsEmitter.emit(`log:${log_entry_id}`, {
      type:         'nutrition_failed',
      log_entry_id,
      error:        'Could not identify food. Please enter manually.',
    });
  }
}

export function startVisionWorker() {
  const worker = new Worker<VisionJobData>(
    'vision-jobs',
    processVisionJob,
    {
      connection: redis,
      concurrency: 5, // process up to 5 images simultaneously
    }
  );

  worker.on('completed', (job) => {
    console.log(`✅ [VisionWorker] Job ${job.id} completed`);
  });

  worker.on('failed', handleFailedJob);

  worker.on('error', (err) => {
    console.error('[VisionWorker] Worker error:', err.message);
  });

  return worker;
}
