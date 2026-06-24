import { describe, test, expect } from 'vitest';
import layoutLib from '../js/lib/layout.js';

const { PER_AGENT_HIDDEN, resolveHiddenList } = layoutLib;

describe('PER_AGENT_HIDDEN', () => {
  test('only the llama.cpp and LMS dashboard surfaces are per-agent', () => {
    expect(PER_AGENT_HIDDEN).toEqual({ hidden: 'llama', lmsHidden: 'lms' });
  });
});

describe('resolveHiddenList — global surfaces', () => {
  test('non-per-agent keys always return the shared global list', () => {
    const layout = { managerHidden: ['mgr-ram'], hiddenOverall: ['ov-fleet'] };
    expect(resolveHiddenList(layout, 'managerHidden', 'agentA')).toBe(layout.managerHidden);
    expect(resolveHiddenList(layout, 'hiddenOverall', 'agentB')).toBe(layout.hiddenOverall);
  });

  test('seeds a missing global list to an empty array', () => {
    const layout = {};
    const list = resolveHiddenList(layout, 'managerHidden', null);
    expect(list).toEqual([]);
    expect(layout.managerHidden).toBe(list);
  });
});

describe('resolveHiddenList — per-agent surfaces', () => {
  test('falls back to the global list when no agent is selected (single-agent install)', () => {
    const layout = { hidden: ['aio'] };
    expect(resolveHiddenList(layout, 'hidden', null)).toBe(layout.hidden);
    expect(layout.hiddenByAgent).toBeUndefined();
  });

  test('seeds a new agent list from the legacy global so existing prefs carry over', () => {
    const layout = { hidden: ['aio', 'gpu'] };
    const list = resolveHiddenList(layout, 'hidden', 'llama1');
    expect(list).toEqual(['aio', 'gpu']);
    // A copy, not the same reference — diverges independently from the global.
    expect(list).not.toBe(layout.hidden);
    expect(layout.hiddenByAgent.llama.llama1).toBe(list);
  });

  test('deselecting a card on one agent does not affect another agent (issue #160)', () => {
    const layout = { hidden: [] };
    const llama1 = resolveHiddenList(layout, 'hidden', 'llama1');
    llama1.push('aio');                       // hide AIO on llama1
    const llama2 = resolveHiddenList(layout, 'hidden', 'llama2');
    expect(llama2).toEqual([]);               // llama2 unaffected
    expect(resolveHiddenList(layout, 'hidden', 'llama1')).toEqual(['aio']);
  });

  test('llama and lms providers keep independent per-agent buckets', () => {
    const layout = { hidden: [], lmsHidden: [] };
    resolveHiddenList(layout, 'hidden', 'host1').push('aio');
    resolveHiddenList(layout, 'lmsHidden', 'host1').push('lms-cpu');
    expect(layout.hiddenByAgent.llama.host1).toEqual(['aio']);
    expect(layout.hiddenByAgent.lms.host1).toEqual(['lms-cpu']);
  });

  test('returns a stable reference across calls so in-place mutation persists', () => {
    const layout = { hidden: [] };
    const a = resolveHiddenList(layout, 'hidden', 'llama1');
    a.push('ram');
    const b = resolveHiddenList(layout, 'hidden', 'llama1');
    expect(b).toBe(a);
    expect(b).toEqual(['ram']);
  });

  test('tolerates a malformed layout without throwing', () => {
    expect(resolveHiddenList(null, 'hidden', 'llama1')).toEqual([]);
    const layout = { hidden: 'not-an-array' };
    expect(resolveHiddenList(layout, 'hidden', null)).toEqual([]);
  });
});
