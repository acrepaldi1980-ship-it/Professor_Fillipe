// Average AI cost per active user per month against RNF-08 (cost <= 35% of what a paying user pays).
// Usage: node --env-file=.env.local scripts/cost-report.mjs
import { sql } from "./db.mjs";

const PLANS = { plus: 29.9, premium: 49.9 };
const per = await sql(`select count(distinct user_id)::int users, coalesce(sum(cost_brl),0)::float total from usage_counters where day > current_date - 30`);
const msgs = await sql(`select count(*)::int n, coalesce(avg(tokens_in),0)::float tin, coalesce(avg(tokens_out),0)::float tout, coalesce(avg(cost_brl),0)::float cost from messages where role='teacher' and created_at > now() - interval '30 days' and tokens_in is not null`);
const [{ users, total }] = per;
const avg = users ? total / users : 0;
console.log(`active users (30d): ${users}; AI cost recorded: R$ ${total.toFixed(2)}; average per active user: R$ ${avg.toFixed(2)}/month`);
console.log(`answers with tokens: ${msgs[0].n}; avg input ${Math.round(msgs[0].tin)} tok, output ${Math.round(msgs[0].tout)} tok, R$ ${msgs[0].cost.toFixed(4)} per answer`);
for (const [p, price] of Object.entries(PLANS)) {
  const budget = price * 0.35;
  console.log(`RNF-08 ${p}: budget R$ ${budget.toFixed(2)}/month (35% of R$ ${price}); average spend R$ ${avg.toFixed(2)} -> ${avg <= budget ? "OK" : "OVER"}`);
}
// Projection for a heavy user from the per-answer cost: 20 answers/day x 30 days (Free daily limit) and 60/day for a paying user.
for (const perDay of [10, 20, 40]) console.log(`projection: ${perDay} answers/day -> R$ ${(msgs[0].cost * perDay * 30).toFixed(2)}/month`);

// Modeled cost per answer (no real traffic yet). Prices in USD per million tokens, USD->BRL 5.5, same constants as lib/entitlements/guard.ts costBrl.
const model = ({ input, cached, output, inP = 3, outP = 15 }) => ((input - cached) * inP + cached * inP * 0.1 + output * outP) / 1e6 * 5.5;
const before = model({ input: 9500, cached: 0, output: 400 }); // 24-message history, no prompt cache, always the deep model
const after = model({ input: 5200, cached: 2600, output: 350 }); // 8-message history, cached stable prompt (identity/lens/catalog)
console.log("--- modeled (assumptions: Sonnet-class $3/$15 per M tokens) ---");
console.log(`before measures: R$ ${before.toFixed(3)} per answer; after cache + short history: R$ ${after.toFixed(3)} (-${Math.round((1 - after / before) * 100)}%)`);
const fast = model({ input: 5200, cached: 2600, output: 350, inP: 1, outP: 5 }); // Haiku-class $1/$5
const mix = 0.8 * fast + 0.2 * after; // fast model by default, deep one only for deepening intents (~20%)
console.log(`fast model default (80% fast / 20% deep): R$ ${mix.toFixed(3)} per answer (-${Math.round((1 - mix / before) * 100)}% vs before)`);
for (const [label, perDay] of [["light (5/day)", 5], ["typical (12/day)", 12], ["heavy (30/day)", 30]]) {
  const m = mix * perDay * 30;
  console.log(`MIX ${label}: R$ ${m.toFixed(2)} per month; Plus budget R$ 10.46 -> ${m <= 10.46 ? "OK" : "OVER (fair use / daily limits apply)"}`);
}
for (const [label, perDay] of [["light (5/day)", 5], ["typical (12/day)", 12], ["heavy (30/day)", 30]]) {
  const m = after * perDay * 30;
  console.log(`${label}: before R$ ${(before * perDay * 30).toFixed(2)} -> after R$ ${m.toFixed(2)} per month; Plus budget R$ 10.46 -> ${m <= 10.46 ? "OK" : "OVER (fair use sends to the fast model)"}`);
}
process.exit(0);
