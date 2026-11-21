/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type FontFamilyKey =
  | 'default'
  | 'noto_sans'
  | 'noto_serif'
  | 'wenkai'
  | 'maru'
  | 'mono';

export interface FontFamilyOption {
  key: FontFamilyKey;
  label: string;
  desc: string;
  cssFamily: string;
}

export interface FontSizeOption {
  px: number;
  label: string;
}

export const FONT_FAMILY_OPTIONS: FontFamilyOption[] = [
  {
    key: 'default',
    label: '預設現代黑體',
    desc: 'Plus Jakarta + 思源黑體',
    cssFamily:
      "'Plus Jakarta Sans', 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', system-ui, sans-serif",
  },
  {
    key: 'noto_sans',
    label: '思源黑體 (清晰無襯線)',
    desc: 'Noto Sans TC',
    cssFamily: "'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif",
  },
  {
    key: 'noto_serif',
    label: '思源宋體 (典雅商務)',
    desc: 'Noto Serif TC',
    cssFamily: "'Noto Serif TC', 'PMingLiU', 'Songti TC', Georgia, serif",
  },
  {
    key: 'wenkai',
    label: '霞鶩文楷 (手寫楷書)',
    desc: 'LXGW WenKai TC',
    cssFamily: "'LXGW WenKai TC', 'DFKai-SB', 'BiauKai', 'Kaiti TC', serif",
  },
  {
    key: 'maru',
    label: '圓潤圓體 (親切柔和)',
    desc: 'Zen Maru Gothic',
    cssFamily: "'Zen Maru Gothic', 'Noto Sans TC', 'PingFang TC', sans-serif",
  },
  {
    key: 'mono',
    label: '等寬數據體 (報表對齊)',
    desc: 'JetBrains Mono + 思源黑體',
    cssFamily: "'JetBrains Mono', 'Noto Sans TC', ui-monospace, SFMono-Regular, monospace",
  },
];

export const FONT_SIZE_OPTIONS: FontSizeOption[] = [
  { px: 13, label: '極致精簡 (13px)' },
  { px: 14, label: '精簡小字 (14px)' },
  { px: 15, label: '微調緊湊 (15px)' },
  { px: 16, label: '標準預設 (16px)' },
  { px: 17, label: '微大舒適 (17px)' },
  { px: 18, label: '放大閱讀 (18px)' },
  { px: 19, label: '加寬閱讀 (19px)' },
  { px: 20, label: '長輩護眼 (20px)' },
  { px: 21, label: '超大護眼 (21px)' },
  { px: 22, label: '特大字體 (22px)' },
];

export interface FontPreferences {
  family: FontFamilyKey;
  sizePx: number;
}

const FONT_PREF_STORAGE_KEY = 'ais_font_preferences';
export const FONT_UPDATED_EVENT = 'ais-font-updated';

export function loadFontPreferences(): FontPreferences {
  try {
    const raw = localStorage.getItem(FONT_PREF_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<FontPreferences>;
      const validFamily = FONT_FAMILY_OPTIONS.some((o) => o.key === parsed.family)
        ? (parsed.family as FontFamilyKey)
        : 'default';
      const validSize =
        typeof parsed.sizePx === 'number' && parsed.sizePx >= 13 && parsed.sizePx <= 24
          ? parsed.sizePx
          : 16;
      return { family: validFamily, sizePx: validSize };
    }
  } catch {
    // ignore storage errors
  }
  return { family: 'default', sizePx: 16 };
}

export function saveFontPreferences(prefs: FontPreferences) {
  try {
    localStorage.setItem(FONT_PREF_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore storage errors
  }
  applyFontPreferencesToDocument(prefs);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(FONT_UPDATED_EVENT, { detail: prefs }));
  }
}

export function applyFontPreferencesToDocument(prefs: FontPreferences) {
  if (typeof document === 'undefined') return;
  const opt =
    FONT_FAMILY_OPTIONS.find((o) => o.key === prefs.family) || FONT_FAMILY_OPTIONS[0];
  const root = document.documentElement;
  root.style.setProperty('--ais-font-family', opt.cssFamily);
  root.style.setProperty('--font-sans', opt.cssFamily);
  root.style.fontSize = `${prefs.sizePx}px`;
  if (document.body) {
    document.body.style.fontFamily = opt.cssFamily;
  }
}
