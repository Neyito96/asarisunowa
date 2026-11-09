// Pure logic of the theme episode picker (no DOM). Used by app/EpisodePicker.tsx and by node tests.
import { filterEpisodes } from '../public/library/library-core.mjs';

export const PICKER_MAX = 100;
// Episodes the administrator keeps on hold are never offered (the server checks again).
export const PICKER_HOLD_IDS = ['EP-00028'];

export function searchEpisodes(rows, criteria) {
  return filterEpisodes(rows, { order: 'newest', ...criteria })
    .filter(e => /^EP-\d{5}$/.test(e.id) && !PICKER_HOLD_IDS.includes(e.id));
}

// -> { selected, error }. Never mutates the input. Selecting the same episode twice removes it.
export function toggleSelection(selected, episode, max = PICKER_MAX) {
  if (!episode || !/^EP-\d{5}$/.test(episode.id)) return { selected, error: 'INVALID_EPISODE' };
  if (PICKER_HOLD_IDS.includes(episode.id)) return { selected, error: 'ON_HOLD' };
  if (selected.some(e => e.id === episode.id)) return { selected: selected.filter(e => e.id !== episode.id), error: '' };
  if (selected.length >= max) return { selected, error: 'LIMIT' };
  return { selected: [...selected, { id: episode.id, title: String(episode.title || ''), show: String(episode.show || ''), date: String(episode.date || '').slice(0, 10) }], error: '' };
}

export const selectedIds = selected => [...new Set(selected.map(e => e.id))];

export const PICKER_MESSAGES = {
  LIMIT: `選べるのは最大${PICKER_MAX}件までです。`,
  ON_HOLD: 'この回は現在、選べません。',
  INVALID_EPISODE: 'この回は選べません。',
};
