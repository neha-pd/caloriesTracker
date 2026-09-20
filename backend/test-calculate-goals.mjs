#!/usr/bin/env node
/**
 * ─────────────────────────────────────────────────────────────────────────────
 * FitLens — Auto-Calculate Goals Feature Test Suite
 * Feature: GET /api/users/me/goals/calculate
 *
 * Tests:
 *  1.  Auth guard — 401 without token
 *  2.  422 when profile is incomplete (no age/height/weight)
 *  3.  Happy path — male, moderately active, maintain
 *  4.  Happy path — female, lightly active, lose_weight
 *  5.  Happy path — male, very active, gain_muscle
 *  6.  Goal type query param override (no DB patch needed)
 *  7.  BMR math accuracy (Mifflin-St Jeor manual check)
 *  8.  AMDR macro calorie balance (P+C+F ≈ TDEE ± 5%)
 *  9.  TDEE clamp — extreme params never produce negative/tiny goal
 * 10.  Female micronutrients (iron=18, fiber=25)
 * 11.  Senior micronutrients (age>=50 → calcium=1200, age>=70 → vitD=800)
 * 12.  Non-binary / other gender → averaged DRI values
 * 13.  Save goals then verify dashboard cache invalidated (immediate re-read)
 * 14.  Goal type stored after PATCH /me/goals
 * 15.  Missing weight only → 422
 *
 * Usage:
 *   node test-calculate-goals.mjs
 *   BASE_URL=http://192.168.1.x:3000 node test-calculate-goals.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const TAG  = `test_goals_${Date.now()}`;

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
let passed = 0, failed = 0;

function assert(name, condition, detail = '') {
  if (condition) {
    console.log(`  ✅  ${name}`);
    passed++;
  } else {
    console.error(`  ❌  ${name}${detail ? `\n      → ${detail}` : ''}`);
    failed++;
  }
}

async function req(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json;
  try { json = await res.json(); } catch { json = {}; }
  return { status: res.status, body: json };
}

async function register(email) {
  return req('POST', '/api/auth/register', {
    email,
    password: 'TestPass123!',
    display_name: 'Test User',
  });
}

async function setProfile(token, profile) {
  return req('PATCH', '/api/users/me', profile, token);
}

async function calculate(token, queryGoalType) {
  const qs = queryGoalType ? `?goal_type=${queryGoalType}` : '';
  return req('GET', `/api/users/me/goals/calculate${qs}`, null, token);
}

// Manual Mifflin-St Jeor for male
function bmrMale(w, h, a)   { return 10 * w + 6.25 * h - 5 * a + 5; }
function bmrFemale(w, h, a) { return 10 * w + 6.25 * h - 5 * a - 161; }
const MULTIPLIERS = {
  sedentary: 1.2, lightly_active: 1.375, moderately_active: 1.55,
  very_active: 1.725, extra_active: 1.9,
};

/* ─── Test Runners ────────────────────────────────────────────────────────── */

async function runTests() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  FitLens — Auto-Calculate Goals Test Suite');
  console.log(`  Server: ${BASE}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // ── Register test users ──────────────────────────────────────────────────
  const r1 = await register(`${TAG}_m@test.com`);   // male, general
  const r2 = await register(`${TAG}_f@test.com`);   // female
  const r3 = await register(`${TAG}_nb@test.com`);  // non-binary
  const r4 = await register(`${TAG}_sr@test.com`);  // senior
  const r5 = await register(`${TAG}_np@test.com`);  // no profile (incomplete)

  const tokM  = r1.body.token;
  const tokF  = r2.body.token;
  const tokNB = r3.body.token;
  const tokSr = r4.body.token;
  const tokNP = r5.body.token;

  assert('Registration — all 5 test users created',
    [r1,r2,r3,r4,r5].every(r => r.status === 201));

  // ── Set physical profiles ────────────────────────────────────────────────
  await setProfile(tokM, {
    age: 28, gender: 'male', height_cm: 175, weight_kg: 75,
    activity_level: 'moderately_active',
  });
  await setProfile(tokF, {
    age: 30, gender: 'female', height_cm: 162, weight_kg: 58,
    activity_level: 'lightly_active',
  });
  await setProfile(tokNB, {
    age: 25, gender: 'other', height_cm: 170, weight_kg: 65,
    activity_level: 'moderately_active',
  });
  await setProfile(tokSr, {
    age: 72, gender: 'female', height_cm: 155, weight_kg: 60,
    activity_level: 'sedentary',
  });
  // tokNP — intentionally left without profile (no age/height/weight)

  /* ── Test 1: Auth guard ─────────────────────────────────────────────── */
  console.log('── Test 1: Auth guard ──────────────────────────────────');
  const noAuth = await calculate(null);
  assert('401 when no token provided', noAuth.status === 401);

  /* ── Test 2: 422 when profile incomplete ────────────────────────────── */
  console.log('\n── Test 2: 422 when profile incomplete ─────────────────');
  const incomplete = await calculate(tokNP);
  assert('422 returned for user with no physical stats', incomplete.status === 422);
  assert('Error message is descriptive', incomplete.body.error?.toLowerCase().includes('profile'));

  /* ── Test 3: Happy path — male, moderately active, maintain ─────────── */
  console.log('\n── Test 3: Male, moderately active, maintain ───────────');
  const male = await calculate(tokM);
  assert('200 OK', male.status === 200);
  assert('Has tdee', typeof male.body.tdee === 'number');
  assert('Has calorie_goal matching tdee', male.body.calorie_goal === male.body.tdee);
  assert('Has protein_g', typeof male.body.protein_g === 'number');
  assert('Has carbs_g',   typeof male.body.carbs_g   === 'number');
  assert('Has fat_g',     typeof male.body.fat_g     === 'number');

  // Manual check: BMR = 10*75 + 6.25*175 - 5*28 + 5 = 750+1093.75-140+5 = 1708.75
  const expectedBmrM  = bmrMale(75, 175, 28);       // 1708.75
  const expectedTdeeM = Math.round(expectedBmrM * MULTIPLIERS.moderately_active); // 2649
  assert('TDEE matches manual Mifflin-St Jeor calculation',
    male.body.tdee === expectedTdeeM,
    `Expected ${expectedTdeeM}, got ${male.body.tdee}`);

  /* ── Test 4: Female, lightly active, lose_weight ───────────────────── */
  console.log('\n── Test 4: Female, lightly active, lose_weight ─────────');
  const femLose = await calculate(tokF, 'lose_weight');
  assert('200 OK', femLose.status === 200);

  const expectedBmrF    = bmrFemale(58, 162, 30);    // 1291.5
  const expectedTdeeF   = Math.round(expectedBmrF * MULTIPLIERS.lightly_active); // 1776
  const expectedDeficit = Math.max(500, Math.round(expectedTdeeF * 0.85));
  assert('Lose weight applies 15% deficit',
    femLose.body.tdee === expectedDeficit,
    `Expected ${expectedDeficit}, got ${femLose.body.tdee}`);
  assert('TDEE is never below 500', femLose.body.tdee >= 500);

  /* ── Test 5: Male, very active, gain_muscle ────────────────────────── */
  console.log('\n── Test 5: Male, very active, gain_muscle ──────────────');
  await setProfile(tokM, { activity_level: 'very_active' });
  const maleGain = await calculate(tokM, 'gain_muscle');
  assert('200 OK', maleGain.status === 200);
  // Recalc with very_active multiplier
  const tdeeVA = Math.round(expectedBmrM * MULTIPLIERS.very_active); // 2947
  const expectedGain = Math.round(tdeeVA * 1.10);
  assert('Gain muscle applies 10% surplus',
    maleGain.body.tdee === expectedGain,
    `Expected ${expectedGain}, got ${maleGain.body.tdee}`);
  // Reset back
  await setProfile(tokM, { activity_level: 'moderately_active' });

  /* ── Test 6: Goal type query param override ─────────────────────────── */
  console.log('\n── Test 6: Goal type query param override ───────────────');
  const maintainR = await calculate(tokM);           // default maintain
  const loseR     = await calculate(tokM, 'lose_weight');
  const gainR     = await calculate(tokM, 'gain_muscle');

  assert('maintain TDEE > lose_weight TDEE', maintainR.body.tdee > loseR.body.tdee,
    `maintain=${maintainR.body.tdee}, lose=${loseR.body.tdee}`);
  assert('gain_muscle TDEE > maintain TDEE', gainR.body.tdee > maintainR.body.tdee,
    `gain=${gainR.body.tdee}, maintain=${maintainR.body.tdee}`);
  assert('Query param does not persist to DB (recalculate without param = maintain)',
    maintainR.body.tdee === (await calculate(tokM)).body.tdee);

  /* ── Test 7: BMR math accuracy (already checked in test 3 & 4) ──────── */
  console.log('\n── Test 7: BMR math accuracy ───────────────────────────');
  assert('Male BMR formula correct (tested in Test 3)', male.body.tdee === expectedTdeeM);

  /* ── Test 8: AMDR macro calorie balance ─────────────────────────────── */
  console.log('\n── Test 8: AMDR macro calorie balance ──────────────────');
  const { tdee, protein_g, carbs_g, fat_g } = maintainR.body;
  const macroKcal = protein_g * 4 + carbs_g * 4 + fat_g * 9;
  const tolerance = tdee * 0.05;  // 5% tolerance for rounding
  assert(`Macro kcal sum (${macroKcal}) within 5% of TDEE (${tdee})`,
    Math.abs(macroKcal - tdee) <= tolerance,
    `Diff: ${Math.abs(macroKcal - tdee)}, tolerance: ${tolerance.toFixed(0)}`);
  assert('Protein ~25% of TDEE (within 2%)',
    Math.abs(protein_g * 4 / tdee - 0.25) < 0.02);
  assert('Carbs ~45% of TDEE (within 2%)',
    Math.abs(carbs_g * 4 / tdee - 0.45) < 0.02);
  assert('Fat ~30% of TDEE (within 2%)',
    Math.abs(fat_g * 9 / tdee - 0.30) < 0.02);

  /* ── Test 9: TDEE clamp for extreme params ───────────────────────────── */
  console.log('\n── Test 9: TDEE clamp — extreme params ─────────────────');
  // Register a user with extreme params (tiny + old → negative BMR)
  const rEx = await register(`${TAG}_ex@test.com`);
  const tokEx = rEx.body.token;
  await setProfile(tokEx, {
    age: 99, gender: 'female', height_cm: 52, weight_kg: 12, activity_level: 'sedentary',
  });
  const extreme = await calculate(tokEx);
  assert('200 OK even with extreme params', extreme.status === 200);
  assert('TDEE clamped to minimum 500 kcal', extreme.body.tdee >= 500,
    `Got tdee=${extreme.body.tdee}`);
  assert('Macros are positive', extreme.body.protein_g > 0 && extreme.body.carbs_g > 0 && extreme.body.fat_g > 0);

  /* ── Test 10: Female micronutrients ─────────────────────────────────── */
  console.log('\n── Test 10: Female micronutrients ──────────────────────');
  const femR = await calculate(tokF);
  assert('Female iron = 18 mg (pre-menopausal, age 30)', femR.body.iron_mg === 18,
    `Got ${femR.body.iron_mg}`);
  assert('Female fiber = 25 g', femR.body.fiber_g === 25,
    `Got ${femR.body.fiber_g}`);
  assert('Female vitaminC = 75 mg', femR.body.vitaminC_mg === 75,
    `Got ${femR.body.vitaminC_mg}`);
  assert('Female magnesium (age 30, <31) = 310 mg', femR.body.magnesium_mg === 310,
    `Got ${femR.body.magnesium_mg}`);

  /* ── Test 11: Senior micronutrients ─────────────────────────────────── */
  console.log('\n── Test 11: Senior micronutrients (age 72) ─────────────');
  const srR = await calculate(tokSr);
  assert('Calcium = 1200 mg (age >= 50)', srR.body.calcium_mg === 1200,
    `Got ${srR.body.calcium_mg}`);
  assert('VitaminD = 800 IU (age >= 70)', srR.body.vitaminD_iu === 800,
    `Got ${srR.body.vitaminD_iu}`);
  assert('Iron = 8 mg (female, post-menopausal age 72)', srR.body.iron_mg === 8,
    `Got ${srR.body.iron_mg}`);

  /* ── Test 12: Non-binary / other gender — averaged DRI ─────────────── */
  console.log('\n── Test 12: Non-binary gender — averaged DRI ───────────');
  const nbR = await calculate(tokNB);
  assert('200 OK', nbR.status === 200);
  assert('Non-binary iron = 13 mg (averaged, age < 51)', nbR.body.iron_mg === 13,
    `Got ${nbR.body.iron_mg}`);
  assert('Non-binary fiber = 32 g (averaged)', nbR.body.fiber_g === 32,
    `Got ${nbR.body.fiber_g}`);
  assert('Non-binary vitaminC = 83 mg (averaged)', nbR.body.vitaminC_mg === 83,
    `Got ${nbR.body.vitaminC_mg}`);
  assert('Non-binary magnesium (age 25, <31) = 355 mg', nbR.body.magnesium_mg === 355,
    `Got ${nbR.body.magnesium_mg}`);

  /* ── Test 13: Dashboard cache invalidated after PATCH /me/goals ─────── */
  console.log('\n── Test 13: Dashboard cache invalidation after goal save ─');
  // 1. Get dashboard (warms cache)
  await req('GET', '/api/dashboard/today', null, tokM);

  // 2. Save a new goal
  const newCalGoal = 1800;
  const saveR = await req('PATCH', '/api/users/me/goals', {
    calorie_goal: newCalGoal,
    protein_goal_g: 113, carbs_goal_g: 203, fat_goal_g: 60,
  }, tokM);
  assert('Goals saved successfully (200)', saveR.status === 200,
    JSON.stringify(saveR.body));

  // 3. Re-read dashboard — must reflect new goal immediately (cache cleared on save)
  // Dashboard returns: { goals: { calories, protein_g, carbs_g, fat_g }, ... }
  const dash2 = await req('GET', '/api/dashboard/today', null, tokM);
  const newGoal = dash2.body?.goals?.calories;
  assert(`Dashboard goals.calories updated to ${newCalGoal} immediately`,
    newGoal === newCalGoal,
    `Got ${newGoal} — dashboard shape: ${JSON.stringify(Object.keys(dash2.body ?? {}))}`);


  /* ── Test 14: goal_type stored after PATCH /me/goals ───────────────── */
  console.log('\n── Test 14: goal_type persisted after save ──────────────');
  const saveType = await req('PATCH', '/api/users/me/goals', {
    goal_type: 'lose_weight', calorie_goal: 1800,
  }, tokM);
  const meAfter = await req('GET', '/api/users/me', null, tokM);
  assert('goal_type=lose_weight persisted in users table',
    meAfter.body?.user?.goal_type === 'lose_weight',
    `Got ${meAfter.body?.user?.goal_type}`);

  /* ── Test 15: Missing weight only → 422 ─────────────────────────────── */
  console.log('\n── Test 15: Missing weight only → 422 ──────────────────');
  const rMW = await register(`${TAG}_mw@test.com`);
  const tokMW = rMW.body.token;
  await setProfile(tokMW, { age: 28, gender: 'male', height_cm: 175 }); // no weight
  const mwR = await calculate(tokMW);
  assert('422 when only weight is missing', mwR.status === 422,
    `Got ${mwR.status}`);

  /* ── Summary ─────────────────────────────────────────────────────────── */
  const total = passed + failed;
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Results: ${passed}/${total} passed  |  ${failed} failed`);
  if (failed === 0) {
    console.log('  🎉 All tests passed!');
  } else {
    console.log('  ⚠️  Some tests failed — check output above');
    process.exitCode = 1;
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

runTests().catch(err => {
  console.error('\n💥 Test runner crashed:', err.message);
  process.exit(1);
});
