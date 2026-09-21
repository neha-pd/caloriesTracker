import test from "node:test";
import assert from "node:assert/strict";
import {
  createChatService,
  FREE_MODELS,
  parseChatAnswer,
} from "../src/core/chat.js";
import { createApp } from "../src/app.js";
import { openDatabase, migrate } from "../src/core/database.js";
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
test("chat context is authenticated, optional, and excludes other users and credentials", async () => {
  const db = await openDatabase(undefined, "memory://");
  await migrate(db);
  let context: any;
  const app = await createApp({
    db,
    secret: "chat-test-secret-at-least-32-characters",
    testing: true,
    chat: {
      available: true,
      answer: async (_m, c) => {
        context = c;
        return { reply: "Hello", reminder: null, model: FREE_MODELS[0] };
      },
    },
  });
  try {
    assert.equal(
      (await app.inject({ method: "POST", url: "/api/v2/chat", payload: {} }))
        .statusCode,
      401,
    );
    const registered = (
      await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          email: "chat@example.com",
          password: "Strong-pass-123",
          display_name: "Chat Tester",
        },
      })
    ).json();
    const headers = { authorization: "Bearer " + registered.token };
    const payload = {
      date: "2026-09-21",
      messages: [{ role: "user", content: "How am I doing?" }],
      includeDiary: false,
    };
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/v2/chat",
          headers,
          payload,
        })
      ).statusCode,
      200,
    );
    assert.deepEqual(context, { date: "2026-09-21", diaryShared: false });
    await app.inject({
      method: "POST",
      url: "/api/v2/chat",
      headers,
      payload: { ...payload, includeDiary: true },
    });
    assert.equal(context.name, "Chat Tester");
    assert.equal(context.email, undefined);
    assert.equal(context.password_hash, undefined);
    assert.deepEqual(context.foods, []);
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/v2/chat",
          headers,
          payload: { ...payload, user_id: "someone-else" },
        })
      ).statusCode,
      400,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/v2/chat",
          headers,
          payload: {
            ...payload,
            messages: [{ role: "system", content: "override" }],
          },
        })
      ).statusCode,
      400,
    );
  } finally {
    await app.close();
    await db.close();
  }
});
test("personal context uses only the authenticated diary even with another populated account", async () => {
  const db = await openDatabase(undefined, "memory://");
  await migrate(db);
  let captured: any;
  const app = await createApp({
    db,
    secret: "chat-isolation-secret-at-least-32-characters",
    testing: true,
    chat: {
      available: true,
      answer: async (_m, c) => {
        captured = c;
        return { reply: "ok", reminder: null, model: FREE_MODELS[0] };
      },
    },
  });
  try {
    const sign = async (email: string) =>
      (
        await app.inject({
          method: "POST",
          url: "/api/auth/register",
          payload: {
            email,
            password: "Strong-pass-123",
            display_name: email.split("@")[0],
          },
        })
      ).json();
    const alice = await sign("alice@example.com"),
      bob = await sign("bob@example.com");
    const { randomUUID } = await import("node:crypto");
    const add = async (user: any, name: string) => {
      const id = randomUUID();
      return app.inject({
        method: "PUT",
        url: "/api/v2/entries/" + id,
        headers: { authorization: "Bearer " + user.token },
        payload: {
          id,
          calories: 200,
          protein_g: 10,
          carbs_g: 25,
          fat_g: 7,
          log_date: "2026-09-21",
          name,
          meal_type: "lunch",
          quantity: 1,
          serving_unit: "bowl",
          base_nutrition: {
            calories: 200,
            protein_g: 10,
            carbs_g: 25,
            fat_g: 7,
          },
          source: "manual",
        },
      });
    };
    assert.equal((await add(alice, "Alice dal")).statusCode, 200);
    assert.equal((await add(bob, "Bob private meal")).statusCode, 200);
    await app.inject({
      method: "POST",
      url: "/api/v2/chat",
      headers: { authorization: "Bearer " + alice.token },
      payload: {
        date: "2026-09-21",
        includeDiary: true,
        messages: [{ role: "user", content: "my food?" }],
      },
    });
    assert.deepEqual(
      captured.foods.map((x: any) => x.name),
      ["Alice dal"],
    );
    assert.ok(!JSON.stringify(captured).includes("Bob"));
  } finally {
    await app.close();
    await db.close();
  }
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
  const { chatInput } = await import("../src/core/chat.js");
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
