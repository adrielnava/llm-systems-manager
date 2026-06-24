// Pure layout helpers shared by the dashboard script and frontend unit tests.
// Classic <script> in the browser (window.LMLayout), CommonJS under Vitest.

// Hidden-list key -> provider for the two dashboard surfaces whose single grid
// is re-pointed per picker-selected agent (llama.cpp #cardGrid, LMS #lmsCardGrid).
const PER_AGENT_HIDDEN = { hidden: 'llama', lmsHidden: 'lms' };

// Effective hidden-card array for a surface: the selected agent's per-agent list
// for per-agent keys (seeded from the global list), else the global list.
function resolveHiddenList(layout, hiddenKey, agentId) {
  if (!layout || typeof layout !== 'object') return [];
  if (!Array.isArray(layout[hiddenKey])) layout[hiddenKey] = [];
  const provider = PER_AGENT_HIDDEN[hiddenKey];
  if (!provider || !agentId) return layout[hiddenKey];
  if (!layout.hiddenByAgent || typeof layout.hiddenByAgent !== 'object') layout.hiddenByAgent = {};
  if (!layout.hiddenByAgent[provider] || typeof layout.hiddenByAgent[provider] !== 'object')
    layout.hiddenByAgent[provider] = {};
  const byAgent = layout.hiddenByAgent[provider];
  if (!Array.isArray(byAgent[agentId])) byAgent[agentId] = layout[hiddenKey].slice();
  return byAgent[agentId];
}

if (typeof window !== 'undefined')
  window.LMLayout = { PER_AGENT_HIDDEN, resolveHiddenList };
if (typeof module !== 'undefined' && module.exports)
  module.exports = { PER_AGENT_HIDDEN, resolveHiddenList };
