/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ExternalLink, Smartphone, X } from 'lucide-react';
import {
  buildExternalBrowserUrl,
  detectLineInAppBrowser,
} from '../services/rolePortalUrlService';

export const LineInAppBanner: React.FC = () => {
  const [isLineIab] = useState<boolean>(() => detectLineInAppBrowser());
  const [dismissed, setDismissed] = useState<boolean>(false);

  if (!isLineIab || dismissed) return null;

  const externalBrowserHref = buildExternalBrowserUrl();

  return (
    <div
      role="region"
      aria-label="LINE 掃碼開啟提示"
      className="bg-emerald-950/95 border-b border-emerald-600/50 px-3 py-2 text-xs text-emerald-100"
    >
      <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-[#06C755] text-slate-950 font-extrabold text-[10px] tracking-wide shrink-0">
            LINE
          </span>
          <span className="truncate sm:whitespace-normal font-medium">
            已透過 LINE 掃碼開啟行動版。建議點選「預設瀏覽器開啟」以獲得完整登入記憶與圖卡儲存功能。
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          <a
            href={externalBrowserHref}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#06C755] hover:bg-[#05b34c] text-slate-950 font-bold text-[11px] transition-colors"
          >
            <Smartphone className="w-3 h-3" />
            <span>以 Safari / Chrome 開啟</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="關閉 LINE 提示列"
            className="p-1 rounded hover:bg-emerald-900/80 text-emerald-300 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
