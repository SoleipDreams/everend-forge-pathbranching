import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { validateProject } from '../lib/validate.js';

const sizes = (process.env.GLOBAL_VALIDATION_SIZES ?? '25000,50000')
  .split(',')
  .map(value => Number(value.trim()))
  .filter(value => Number.isInteger(value) && value > 0);
const trials = Math.max(1, Number.parseInt(process.env.GLOBAL_VALIDATION_TRIALS ?? '5', 10) || 5);
const toMiB = bytes => Number((bytes / 1024 / 1024).toFixed(1));

function syntheticProject(eventCount) {
  const eventIds = Array.from({ length: eventCount }, (_, index) => `event:${index}`);
  const events = eventIds.map((id, index) => {
    const interactionId = `use:${index}`;
    const definitionId = `definition:${index}`;
    return {
      id,
      name: `Event ${index}`,
      type: 'normal',
      branchRef: null,
      ...(index > 0
        ? {
            availability: {
              type: 'interactionResult',
              useId: `use:${index - 1}`,
              resultId: `result:${index - 1}`,
              operator: '==',
            },
          }
        : {}),
      interactionDefinitions: [{
        id: definitionId,
        name: 'Synthetic check',
        mechanic: { kind: 'custom', description: 'Synthetic validation benchmark' },
        results: [{ id: `result:${index}`, name: 'Success' }],
      }],
      interactionUses: [{
        id: interactionId,
        definitionId,
        ownerNodeId: id,
        moment: 'after',
      }],
    };
  });

  return {
    specVersion: '0.1',
    projectId: `global-validation-${eventCount}`,
    entrySequenceId: 'sequence:scale',
    canonRefs: [],
    sequences: [{
      id: 'sequence:scale',
      name: 'Global validation scale fixture',
      entryEventId: eventIds[0],
      eventIds,
      branchIds: [],
    }],
    branches: [],
    events,
    scripts: [],
    externalFunctions: [],
    variables: {},
  };
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
}

if (globalThis.gc) globalThis.gc();
const warmupFindings = validateProject(syntheticProject(1_000));
assert.equal(warmupFindings.length, 0, `Warmup fixture has findings: ${JSON.stringify(warmupFindings.slice(0, 5))}`);

const results = [];
for (const eventCount of sizes) {
  const project = syntheticProject(eventCount);
  if (globalThis.gc) globalThis.gc();
  const durationsMs = [];
  const retainedHeapDeltasMiB = [];
  let findingCount = 0;

  for (let trial = 0; trial < trials; trial += 1) {
    if (globalThis.gc) globalThis.gc();
    const heapBefore = process.memoryUsage().heapUsed;
    const startedAt = performance.now();
    const findings = validateProject(project);
    const durationMs = performance.now() - startedAt;
    findingCount = findings.length;
    assert.equal(findingCount, 0, `Fixture with ${eventCount} events has findings: ${JSON.stringify(findings.slice(0, 5))}`);
    durationsMs.push(Number(durationMs.toFixed(1)));

    if (globalThis.gc) globalThis.gc();
    retainedHeapDeltasMiB.push(toMiB(process.memoryUsage().heapUsed - heapBefore));
  }

  results.push({
    events: eventCount,
    trials,
    findings: findingCount,
    validationMs: durationsMs,
    medianMs: percentile(durationsMs, 0.5),
    p95Ms: percentile(durationsMs, 0.95),
    retainedHeapDeltaMiBAfterGc: retainedHeapDeltasMiB,
  });
}

console.log(JSON.stringify({
  measurement: 'Synchronous in-memory validateProject; excludes sidecar hydration, WebView rendering, export, and save.',
  gcAvailable: Boolean(globalThis.gc),
  results,
}, null, 2));
