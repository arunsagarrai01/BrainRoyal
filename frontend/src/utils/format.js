// Small formatting helpers shared across pages.

export function formatNumber(n) {
  return new Intl.NumberFormat('en-US').format(n ?? 0);
}

export function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDuration(ms) {
  if (!ms) return '0s';
  const totalSeconds = Math.round(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return m ? `${m}m ${s}s` : `${s}s`;
}

export function formatMs(ms) {
  if (!ms) return '0.0s';
  return `${(ms / 1000).toFixed(1)}s`;
}

const difficultyColors = {
  EASY: 'bg-emerald-500/15 text-emerald-300',
  MEDIUM: 'bg-amber-500/15 text-amber-300',
  HARD: 'bg-rose-500/15 text-rose-300',
};
export function difficultyChip(difficulty) {
  return difficultyColors[difficulty] || 'bg-slate-500/15 text-slate-300';
}
