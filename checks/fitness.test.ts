import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  energyForDay,
  periodDates,
  summarize,
} from "../mobile/src/features/fitness/domain";
import { emptyHealthDay } from "../mobile/src/features/health/domain";
import { parseChatAnswer } from "../shared/chat";
const workout = {
  id: "test",
  version: 1,
  kind: "workout" as const,
  log_date: "2026-09-20",
  name: "Walk",
  start: "2026-09-20T10:00:00.000Z",
  minutes: 30,
  calories: 150,
  energyPolicy: "auto" as const,
  notes: "",
};
test("manual movement counts once, unknown burn remains unknown, period coverage is explicit", () => {
  const day = {
    ...emptyHealthDay(workout.log_date, "test"),
    activeCalories: 400,
    totalCalories: 2100,
    exerciseMinutes: 45,
  };
  assert.equal(
    energyForDay(workout.log_date, [workout], day).activeCalories,
    400,
  );
  assert.equal(energyForDay(workout.log_date, [workout]).activeCalories, 150);
  assert.equal(energyForDay(workout.log_date, [workout]).totalCalories, null);
  assert.equal(
    energyForDay(
      workout.log_date,
      [{ ...workout, energyPolicy: "additional" }],
      day,
    ).totalCalories,
    2250,
  );
  assert.equal(
    energyForDay(workout.log_date, [{ ...workout, calories: null }])
      .activeCalories,
    null,
  );
  assert.equal(
    energyForDay(workout.log_date, [{ ...workout, deleted_at: "now" }])
      .activeCalories,
    null,
  );
  assert.equal(periodDates("2024-02-12", "month").length, 29);
  assert.equal(periodDates("2024-02-12", "year").length, 366);
  const s = summarize(periodDates(workout.log_date, "month"), [], [workout], {
    [workout.log_date]: day,
  });
  assert.equal(s.totalBurn, 2100);
  assert.equal(s.burnDays, 1);
  assert.equal(s.foodDays, 0);
});
test("three meal drafts remain separate and tool markers never become actions", () => {
  const reminders = [8, 13, 19].map((hour, i) => ({
    title: ["Breakfast", "Lunch", "Dinner"][i],
    body: "Time for a meal",
    hour,
    minute: i === 2 ? 30 : 0,
    cadence: "daily",
    quietHours: true,
  }));
  const result = parseChatAnswer(JSON.stringify({ reply: "Ready", reminders }));
  assert.equal(result.reminders.length, 3);
  assert.equal(result.reminders[2].minute, 30);
  assert.throws(() =>
    parseChatAnswer("<|tool_call_start|>reminder(hour=8)<|tool_call_end|>"),
  );
});
test('an unusable free-model answer receives one bounded free-only retry',async()=>{
 const {createChatService,FREE_MODELS}=await import('../shared/chat');
 const calls:any[]=[];
 const answer=await createChatService('test',async(_url,options)=>{
  const body=JSON.parse(String(options?.body));calls.push(body);
  return new Response(JSON.stringify({model:FREE_MODELS[calls.length-1],choices:[{message:{content:calls.length===1?'<|tool_call_start|>reminder(hour=8)<|tool_call_end|>':JSON.stringify({reply:'Which time would you prefer?',reminder:null})}}]}));
 }).answer([{role:'user',content:'Remind me'}],{});
 assert.equal(calls.length,2);assert.equal(calls[1].models[0],FREE_MODELS[1]);assert.equal(calls[1].provider.max_price.completion,0);assert.equal(answer.reply,'Which time would you prefer?');
});
