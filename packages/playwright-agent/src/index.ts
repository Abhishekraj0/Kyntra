/**
 * @kyntra/playwright-agent
 * Frontend testing and session correlation agent.
 */

export { correlateSession, findProblematicSessions } from "./session-correlator.js";
export type { CorrelatedSession, UiEventSummary, ApiCallSummary, FunnelStep, PerformanceMetrics } from "./session-correlator.js";

export { generatePlaywrightTestFromSession, generatePlaywrightConfig } from "./ui-test-generator.js";
export type { GeneratedPlaywrightTest } from "./ui-test-generator.js";

export { runPlaywrightTest } from "./playwright-runner.js";
export type { PlaywrightRunResult, TestResult } from "./playwright-runner.js";
