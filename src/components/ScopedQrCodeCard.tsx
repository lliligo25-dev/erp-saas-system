/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, Download, Copy, Check, Smartphone, Camera, ShieldCheck } from 'lucide-react';
import {
  buildRolePortalUrl,
  detectLineInAppBrowser,
  EXTERNAL_BASE_URL_UPDATED_EVENT,
  getSavedExternalBaseUrl,
} from '../services/rolePortalUrlService';
import { apiIssueQrPassToken } from '../services/confidentialApiClient';

interface ScopedQrCodeCardProps {
  memberMid: string;
  memberName: string;
}

export const ScopedQrCodeCard: React.FC<ScopedQrCodeCardProps> = ({
  memberMid,
  memberName,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [lineExternalBrowser, setLineExternalBrowser] = useState<boolean>(true);
  const [includeQuickLoginPass, setIncludeQuickLoginPass] = useState<boolean>(true);
  const [signedQrToken, setSignedQrToken] = useState<string>('');
  const [longPressPosterUrl, setLongPressPosterUrl] = useState<string>('');
  const [useGasExecUrl, setUseGasExecUrl] = useState<boolean>(true);
  const [savedExternalBase, setSavedExternalBase] = useState<string>(() => getSavedExternalBaseUrl());

  useEffect(() => {
    const onBaseUpdated = () => setSavedExternalBase(getSavedExternalBaseUrl());
    window.addEventListener(EXTERNAL_BASE_URL_UPDATED_EVENT, onBaseUpdated);
    return () => window.removeEventListener(EXTERNAL_BASE_URL_UPDATED_EVENT, onBaseUpdated);
  }, []);

  const origin = useGasExecUrl
    ? savedExternalBase
    : typeof window !== 'undefined'
      ? window.location.origin
      : savedExternalBase;

  useEffect(() => {
    let cancelled = false;
    if (!includeQuickLoginPass) {
      setSignedQrToken('');
      return;
    }
    apiIssueQrPassToken().then((res) => {
      if (!cancelled && res.ok && res.qrToken && res.userId === memberMid) {
        setSignedQrToken(res.qrToken);
      } else if (!cancelled) {
        setSignedQrToken('');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [includeQuickLoginPass, memberMid]);

  const baseMemberUrl = buildRolePortalUrl('MEMBER', memberMid, origin, {
    device: 'mobile',
    openExternalBrowser: lineExternalBrowser,
  });

  const memberMobileUrl =
    includeQuickLoginPass && signedQrToken
      ? `${baseMemberUrl}&qrToken=${encodeURIComponent(signedQrToken)}`
      : baseMemberUrl;

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(memberMobileUrl, {
      width: 440,
      margin: 3,
      errorCorrectionLevel: 'H',
      color: { dark: '#0F172A', light: '#FFFFFF' },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        // ignore
      });
    return () => {
      cancelled = true;
    };
  }, [memberMobileUrl]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(memberMobileUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      // ignore
    }
  };

  const renderPosterDataUrl = async (): Promise<string> => {
    const canvas = document.createElement('canvas');
    canvas.width = 720;
    canvas.height = 940;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#0EA5E9';
    ctx.fillRect(0, 0, canvas.width, 14);

    // LINE camera pill
    ctx.fillStyle = '#064E3B';
    ctx.beginPath();
    ctx.roundRect(175, 48, 370, 38, 19);
    ctx.fill();
    ctx.fillStyle = '#34D399';
    ctx.font = 'bold 18px "Noto Sans TC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      signedQrToken
        ? 'LINE / 鏡頭影像快速登入專用憑證'
        : 'LINE 掃一掃 / 手機相機直接拍攝進入',
      canvas.width / 2,
      74
    );

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 34px "Noto Sans TC", sans-serif';
    ctx.fillText(`${memberName} 專屬雲端服務入口`, canvas.width / 2, 134);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '20px "Noto Sans TC", sans-serif';
    ctx.fillText(`推薦 / 會員編號：${memberMid}`, canvas.width / 2, 174);

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(140, 212, 440, 440, 24);
    ctx.fill();

    const img = new Image();
    img.src = qrDataUrl;
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
    });
    ctx.drawImage(img, 160, 232, 400, 400);

    ctx.fillStyle = '#E2E8F0';
    ctx.font = 'bold 22px "Noto Sans TC", sans-serif';
    ctx.fillText(
      signedQrToken
        ? '登入頁開啟鏡頭掃描本圖卡即可免密碼快速登入'
        : '開啟 LINE 相機或手機鏡頭掃碼登入',
      canvas.width / 2,
      718
    );

    ctx.fillStyle = '#64748B';
    ctx.font = '15px monospace';
    const shortUrl = memberMobileUrl.length > 54 ? memberMobileUrl.slice(0, 51) + '...' : memberMobileUrl;
    ctx.fillText(shortUrl, canvas.width / 2, 764);

    ctx.fillStyle = '#475569';
    ctx.font = '16px "Noto Sans TC", sans-serif';
    ctx.fillText(
      signedQrToken
        ? '含伺服器 HMAC-SHA256 加密簽章（30 天有效）'
        : lineExternalBrowser
          ? 'LINE 掃碼自動啟動 Safari / Chrome 穩定版面'
          : '支援 LINE 內建視窗與行動瀏覽器開啟',
      canvas.width / 2,
      820
    );

    return canvas.toDataURL('image/png');
  };

  const handleDownloadPoster = async () => {
    if (!qrDataUrl) return;
    const posterDataUrl = await renderPosterDataUrl();
    if (!posterDataUrl) return;

    if (detectLineInAppBrowser()) {
      setLongPressPosterUrl(posterDataUrl);
      return;
    }

    const a = document.createElement('a');
    a.href = posterDataUrl;
    a.download = `Member_QR_${memberMid}.png`;
    a.click();
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row items-center gap-5">
      <div className="bg-white p-2.5 rounded-xl shrink-0 shadow-md">
        {qrDataUrl ? (
          <img src={qrDataUrl} alt={`${memberMid} LINE 掃碼專用 QR Code`} className="w-36 h-36 object-contain" />
        ) : (
          <div className="w-36 h-36 flex items-center justify-center text-xs text-slate-500">
            載入中...
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-3 text-center sm:text-left">
        <div>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <QrCode className="w-4 h-4 text-sky-400" />
              <span>我的 LINE 攝影 / 影像識別快速登入 QR Code</span>
            </h4>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#06C755]/20 border border-[#06C755]/40 text-[#4ade80] text-[10px] font-bold">
              <Camera className="w-3 h-3" />
              <span>LINE 掃一掃可用</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            使用 LINE 相機拍攝或登入頁鏡頭影像識別掃碼，即可帶入您的編號 (<span className="font-mono text-sky-300">{memberMid}</span>) 並快速進入個人工作台。
          </p>
        </div>

        <div className="flex flex-col gap-1.5 items-center sm:items-start">
          <label className="inline-flex items-center gap-2 text-xs text-emerald-300 font-medium cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeQuickLoginPass}
              onChange={(e) => setIncludeQuickLoginPass(e.target.checked)}
              className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
            />
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>附加後端加密簽章（於登入頁鏡頭拍攝可免打密碼快速登入）</span>
          </label>

          <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={lineExternalBrowser}
              onChange={(e) => setLineExternalBrowser(e.target.checked)}
              className="rounded border-slate-700 bg-slate-950 text-[#06C755] focus:ring-[#06C755]"
            />
            <span>LINE 掃碼後自動切換 Safari / Chrome 開啟（推薦：登入狀態最穩定）</span>
          </label>

          <label className="inline-flex items-center gap-2 text-xs text-sky-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={useGasExecUrl}
              onChange={(e) => setUseGasExecUrl(e.target.checked)}
              className="rounded border-slate-700 bg-slate-950 text-sky-500 focus:ring-sky-500"
            />
            <span>使用指定 GAS /exec 網址（取消勾選可改用目前瀏覽器網域）</span>
          </label>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-[11px] font-mono text-slate-300 break-all flex items-start gap-1.5">
          <Smartphone className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
          <span>{memberMobileUrl}</span>
        </div>

        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
          <button
            type="button"
            onClick={handleDownloadPoster}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white cursor-pointer transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>下載 LINE 掃碼圖卡 PNG</span>
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 cursor-pointer transition-colors"
          >
            {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span>{copiedUrl ? '已複製掃碼網址' : '複製掃碼網址'}</span>
          </button>
        </div>

        {longPressPosterUrl && (
          <div className="p-3 bg-slate-950 border border-[#06C755]/50 rounded-xl space-y-2 text-center">
            <div className="flex items-center justify-between text-xs text-emerald-300 font-semibold">
              <span>請長按下方圖卡儲存至手機相簿</span>
              <button
                type="button"
                onClick={() => setLongPressPosterUrl('')}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                收合
              </button>
            </div>
            <img
              src={longPressPosterUrl}
              alt="長按儲存專屬 QR 圖卡"
              className="w-56 mx-auto rounded-lg border border-slate-800"
            />
          </div>
        )}
      </div>
    </div>
  );
};
