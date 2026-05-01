/**
 * Programmatically run Playwright tests and collect results.
 */

import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import type { GeneratedPlaywrightTest } from "./ui-test-generator.js";

const execFileAsync = promisify(execFile);

export interface PlaywrightRunResult {
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  testResults: TestResult[];
  stdout: string;
  exitCode: number;
}

export interface TestResult {
  title: string;
  status: "passed" | "failed" | "skipped";
  durationMs: number;
  error?: string | undefined;
}

/**
 * Run a generated Playwright test file and return structured results.
 * Writes the test to a temp file, runs Playwright, then cleans up.
 */
export async function runPlaywrightTest(
  test: GeneratedPlaywrightTest,
  options: {
    baseUrl?: string;
    timeout?: number;
    headless?: boolean;
  } = {}
): Promise<PlaywrightRunResult> {
  const tmpFile = join(tmpdir(), `kyntra-${Date.now()}-${test.filename}`);
  const startTime = Date.now();

  try {
    await writeFile(tmpFile, test.content, "utf-8");

    const env = {
      ...process.env,
      PLAYWRIGHT_BASE_URL: options.baseUrl ?? "http://localhost:3000",
      CI: "1",
    };

    try {
      const { stdout } = await execFileAsync(
        "npx",
        [
          "playwright",
          "test",
          tmpFile,
          "--reporter=json",
          options.headless !== false ? "--headed=false" : "--headed=true",
          `--timeout=${options.timeout ?? 30000}`,
        ],
        { env, timeout: (options.timeout ?? 30000) * 2 }
      );

      const results = parsePlaywrightOutput(stdout);
      return {
        ...results,
        durationMs: Date.now() - startTime,
        stdout,
        exitCode: 0,
      };
    } catch (err: unknown) {
      const execErr = err as { stdout?: string; code?: number };
      const stdout = execErr.stdout ?? "";
      const results = parsePlaywrightOutput(stdout);
      return {
        ...results,
        durationMs: Date.now() - startTime,
        stdout,
        exitCode: execErr.code ?? 1,
      };
    }
  } finally {
    await unlink(tmpFile).catch(() => undefined);
  }
}

function parsePlaywrightOutput(stdout: string): Pick<PlaywrightRunResult, "passed" | "failed" | "skipped" | "testResults"> {
  try {
    const json = JSON.parse(stdout) as {
      stats?: { expected?: number; unexpected?: number; skipped?: number };
      suites?: Array<{
        specs?: Array<{
          title: string;
          ok: boolean;
          tests?: Array<{ results?: Array<{ status: string; duration: number; error?: { message: string } }> }>;
        }>;
      }>;
    };

    const testResults: TestResult[] = [];

    for (const suite of json.suites ?? []) {
      for (const spec of suite.specs ?? []) {
        const firstTest = spec.tests?.[0]?.results?.[0];
        testResults.push({
          title: spec.title,
          status: spec.ok ? "passed" : firstTest?.status === "skipped" ? "skipped" : "failed",
          durationMs: firstTest?.duration ?? 0,
          error: firstTest?.error?.message,
        });
      }
    }

    return {
      passed: json.stats?.expected ?? testResults.filter((t) => t.status === "passed").length,
      failed: json.stats?.unexpected ?? testResults.filter((t) => t.status === "failed").length,
      skipped: json.stats?.skipped ?? testResults.filter((t) => t.status === "skipped").length,
      testResults,
    };
  } catch {
    return { passed: 0, failed: 0, skipped: 0, testResults: [] };
  }
}
