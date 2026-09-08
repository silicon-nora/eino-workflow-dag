import { formatNodeTooltip } from "../src/tooltip.js";

function assert(condition, message) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exit(1);
  }
}

const text = formatNodeTooltip(
  {
    id: "generate",
    title: "Generate",
    status: "running",
    cost_ms: 1250,
    metrics: {
      retries: 1,
      token_usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
        prompt_token_details: { cached_tokens: 4 },
        completion_token_details: { reasoning_tokens: 2 },
      },
    },
  },
  (value) => `${value}ms`,
);

assert(text.includes("Generate"), "title is included");
assert(text.includes("Status: Running"), "known status is localized");
assert(text.includes("Duration: 1250ms"), "duration formatter is used");
assert(text.includes("cached_tokens: 4"), "nested cache tokens are included");
assert(text.includes("reasoning_tokens: 2"), "reasoning tokens are included");
assert(text.includes("retries: 1"), "other metrics are included");

const untimed = formatNodeTooltip({ id: "untimed", status: "pending" });
assert(!untimed.includes("Duration:"), "missing duration is omitted from the tooltip");

const circular = {};
circular.self = circular;
const safe = formatNodeTooltip({ id: "safe", metrics: { circular } });
assert(safe.includes("circular:"), "circular metric values do not throw");

const localized = formatNodeTooltip(
  { id: "local", status: "running", cost_ms: 3, err_msg: "失败" },
  (value) => `${value}毫秒`,
  {
    statuses: { running: "运行中" },
    tooltip: { status: "状态", duration: "耗时", error: "错误" },
  },
);
assert(localized.includes("状态: 运行中"), "status labels can be localized");
assert(localized.includes("耗时: 3毫秒"), "tooltip labels can be localized");
assert(localized.includes("错误: 失败"), "error labels can be localized");

const prototypeLocale = JSON.parse('{"statuses":{"__proto__":"Safe"}}');
const prototypeStatus = formatNodeTooltip(
  { id: "special", status: "__proto__", cost_ms: 1 },
  String,
  prototypeLocale,
);
assert(prototypeStatus.includes("Status: Safe"), "prototype-like locale keys are data");

console.log("OK: tooltip formatter tests passed");
