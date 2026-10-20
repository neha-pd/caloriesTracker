import test from "node:test";
import assert from "node:assert/strict";
import {
  createChatService,
  FREE_MODELS,
  parseChatAnswer,
} from "../shared/chat.js";
test("chat uses only free routes, bounded output and safe reminder drafts", async () => {
  let request: any;
  const fetcher = async (url: any, options: any) => {
    assert.equal(url, "https://openrouter.ai/api/v1/chat/completions");
    request = JSON.parse(options.body);
    return new Response(
      JSON.stringify({
        model: FREE_MODELS[1],
        choices: [
          {
            message: {
              content: JSON.stringify({
                reply: "Done, scheduled!",
                reminder: {
                  title: "Water",
                  body: "Take a sip",
                  hour: 8,
                  minute: 0,
                  cadence: "daily",
                  quietHours: true,
                  intervalHours: 2,
                },
              }),
            },
          },
        ],
      }),
      { status: 200 },
    );
  };
  const result = await createChatService(
    "test",
    fetcher as typeof fetch,
  ).answer([{ role: "user", content: "Water every two hours" }], {});
  assert.deepEqual(request.models, FREE_MODELS);
  assert.ok(request.models.every((m: string) => m.endsWith(":free")));
  assert.deepEqual(request.provider.max_price, {
    prompt: 0,
    completion: 0,
    request: 0,
  });
  assert.equal(result.reminder?.intervalHours, 2);
  assert.match(result.reply, /Nothing is scheduled/);
  assert.ok(!result.reply.includes("Done"));
  assert.equal(
    parseChatAnswer('{"reply":"Hello","reminder":{"hour":99}}').reminder,
    null,
  );
  await assert.rejects(
    () =>
      createChatService(undefined).answer(
        [{ role: "user", content: "Hi" }],
        {},
      ),
    /not connected/,
  );
  await assert.rejects(
    () =>
      createChatService(
        "test",
        async () => new Response("{}", { status: 429 }),
      ).answer([{ role: "user", content: "Hi" }], {}),
    /shared free AI quota/,
  );
  await assert.rejects(
    () =>
      createChatService(
        "test",
        async () =>
          new Response(JSON.stringify({ model: "paid", choices: [] })),
      ).answer([{ role: "user", content: "Hi" }], {}),
    /usable reply/,
  );
});
test("native tool-call syntax never appears as a conversational reply", async () => {
  const raw =
    "<|tool_call_start|>reminder(title='Meal Reminders', body='Time to eat', hour=8, minute=0, cadence='daily', quietHours=True)<|tool_call_end|>";
  for (const output of [
    raw,
    "Sure! " + raw,
    "reminder(title='Meals', hour=8)",
    JSON.stringify({ reply: raw, reminder: null }),
    '{"reply":"\\u003c|tool_call_start|>reminder(title=x)","reminder":null}',
  ]) {
    assert.throws(() => parseChatAnswer(output), /Unusable response/);
  }
  assert.equal(
    parseChatAnswer("What times do you prefer for breakfast, lunch and dinner?")
      .reminder,
    null,
  );
  const service = createChatService(
    "test",
    async () =>
      new Response(
        JSON.stringify({
          model: FREE_MODELS[1],
          choices: [{ message: { content: raw } }],
        }),
      ),
  );
  await assert.rejects(
    () => service.answer([{ role: "user", content: "Yes" }], {}),
    (error) =>
      error instanceof Error &&
      /usable reply/.test(error.message) &&
      !error.message.includes("tool_call"),
  );
});
test("activity context requires a matching day and bounded device values", async () => {
  const { chatInput } = await import("../shared/chat.js");
  const b = {
    date: "2026-09-21",
    messages: [{ role: "user", content: "How much did I burn?" }],
    includeDiary: true,
    activity: {
      date: "2026-09-21",
      activeCalories: 400,
      totalCalories: 2100,
      restingCalories: 1700,
      steps: 7000,
      exerciseMinutes: 45,
      source: "Health Connect",
      readAt: "2026-09-21T15:00:00.000Z",
    },
  };
  assert.equal(chatInput.parse(b).activity?.totalCalories, 2100);
  assert.throws(() =>
    chatInput.parse({ ...b, activity: { ...b.activity, date: "2026-09-20" } }),
  );
  assert.throws(() =>
    chatInput.parse({ ...b, activity: { ...b.activity, activeCalories: -1 } }),
  );
});
