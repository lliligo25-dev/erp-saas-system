/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import {
  Camera,
  X,
  RefreshCw,
  Upload,
  ScanLine,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface CameraQrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (rawQrText: string) => void;
  title?: string;
}

export const CameraQrScannerModal: React.FC<CameraQrScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  title = 'LINE / 會員 QR Code 鏡頭掃描登入',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraState, setCameraState] = useState<'starting' | 'active' | 'error'>('starting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isReadingImage, setIsReadingImage] = useState<boolean>(false);

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore track stop errors
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setErrorMessage(null);
    setCameraState('starting');

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      setCameraState('error');
      setErrorMessage(
        '目前瀏覽器環境未開放 navigator.mediaDevices 攝影機權限，您可使用下方「選取 QR Code 圖片」直接進行影像識別。'
      );
      return;
    }

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch {
        // Fallback if specific facingMode constraint fails on desktop webcams
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      video.srcObject = stream;
      await video.play();
      setCameraState('active');

      let lastDecodeAt = 0;
      const scanFrame = (timestamp: number) => {
        if (!streamRef.current || !videoRef.current) return;

        if (
          timestamp - lastDecodeAt >= 90 &&
          videoRef.current.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
          videoRef.current.videoWidth > 0 &&
          videoRef.current.videoHeight > 0
        ) {
          lastDecodeAt = timestamp;
          const v = videoRef.current;
          const canvas = canvasRef.current || document.createElement('canvas');
          canvasRef.current = canvas;

          const maxDim = 720;
          const scale = Math.min(1, maxDim / Math.max(v.videoWidth, v.videoHeight));
          const w = Math.max(1, Math.floor(v.videoWidth * scale));
          const h = Math.max(1, Math.floor(v.videoHeight * scale));

          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
          }

          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(v, 0, 0, w, h);
            const imageData = ctx.getImageData(0, 0, w, h);
            const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'attemptBoth',
            });
            if (decoded && decoded.data && decoded.data.trim()) {
              stopCamera();
              onScanSuccess(decoded.data.trim());
              return;
            }
          }
        }

        rafRef.current = requestAnimationFrame(scanFrame);
      };

      rafRef.current = requestAnimationFrame(scanFrame);
    } catch (err: any) {
      setCameraState('error');
      const errName = err?.name || '';
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        setErrorMessage(
          '攝影機存取權限被拒，請允許瀏覽器使用相機，或改用下方「選取 QR Code 圖片」上傳識別。'
        );
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        setErrorMessage(
          '未偵測到可用攝影機裝置，請直接點擊下方「選取 QR Code 圖片」載入 QR 圖卡進行影像識別登入。'
        );
      } else {
        setErrorMessage(
          '無法啟動攝影機鏡頭（可能被跨網域安全原則或裝置佔用限制），請改用下方圖片上傳識別功能。'
        );
      }
    }
  }, [facingMode, onScanSuccess, stopCamera]);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }
    startCamera();
    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  const handleToggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const handleImageFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setIsReadingImage(true);
    setErrorMessage(null);

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('讀取圖片失敗'));
        reader.readAsDataURL(file);
      });

      const img = new Image();
      img.src = dataUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('圖片格式無法解析'));
      });

      const canvas = document.createElement('canvas');
      const maxDim = 1200;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      canvas.width = Math.max(1, Math.floor(img.width * scale));
      canvas.height = Math.max(1, Math.floor(img.height * scale));
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('無法建立影像畫布');

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth',
      });

      if (decoded && decoded.data && decoded.data.trim()) {
        stopCamera();
        onScanSuccess(decoded.data.trim());
      } else {
        setErrorMessage('在選取的圖片中找不到清晰的 QR Code，請裁切對準 QR 區塊後再試。');
      }
    } catch {
      setErrorMessage('無法識別此圖片檔案中的 QR Code，請確認為清晰的 PNG / JPG 圖檔。');
    } finally {
      setIsReadingImage(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#06C755]/20 border border-[#06C755]/40 flex items-center justify-center text-[#4ADE80]">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">{title}</h3>
              <p className="text-[11px] text-slate-400">
                支援 LINE 會員 QR Code / 專屬立牌圖卡影像識別
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            aria-label="關閉掃描器"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Viewfinder */}
        <div className="p-5 space-y-4">
          <div className="relative w-full aspect-square max-h-72 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className={`w-full h-full object-cover ${cameraState === 'active' ? 'opacity-100' : 'opacity-0'}`}
            />

            {cameraState === 'starting' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-slate-300">
                <Loader2 className="w-6 h-6 text-[#06C755] animate-spin" />
                <span>正在啟動攝影鏡頭...</span>
              </div>
            )}

            {cameraState === 'active' && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-48 h-48 border-2 border-[#06C755]/85 rounded-2xl relative shadow-[0_0_0_9999px_rgba(2,6,23,0.45)]">
                  <div className="absolute -top-0.5 -left-0.5 w-5 h-5 border-t-4 border-l-4 border-[#4ADE80] rounded-tl-lg" />
                  <div className="absolute -top-0.5 -right-0.5 w-5 h-5 border-t-4 border-r-4 border-[#4ADE80] rounded-tr-lg" />
                  <div className="absolute -bottom-0.5 -left-0.5 w-5 h-5 border-b-4 border-l-4 border-[#4ADE80] rounded-bl-lg" />
                  <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 border-b-4 border-r-4 border-[#4ADE80] rounded-br-lg" />
                  <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 flex items-center justify-center opacity-75">
                    <ScanLine className="w-full h-5 text-[#4ADE80] animate-pulse" />
                  </div>
                </div>
              </div>
            )}

            {cameraState === 'error' && (
              <div className="absolute inset-0 p-5 flex flex-col items-center justify-center text-center gap-2.5 bg-slate-950/95">
                <AlertCircle className="w-8 h-8 text-amber-400" />
                <p className="text-xs text-slate-300 leading-relaxed">{errorMessage}</p>
              </div>
            )}
          </div>

          {errorMessage && cameraState !== 'error' && (
            <div className="p-2.5 rounded-lg bg-amber-950/50 border border-amber-700/60 text-xs text-amber-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Controls */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleToggleFacingMode}
              className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
              <span>{facingMode === 'environment' ? '切換前鏡頭' : '切換後鏡頭'}</span>
            </button>

            <button
              type="button"
              disabled={isReadingImage}
              onClick={() => fileInputRef.current?.click()}
              className="py-2 px-3 rounded-lg bg-[#06C755] hover:bg-[#05b34c] disabled:opacity-60 text-xs font-bold text-slate-950 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              {isReadingImage ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              <span>選取 QR 圖片識別</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageFileSelected}
              className="hidden"
            />
          </div>

          <p className="text-[11px] text-slate-400 text-center leading-relaxed">
            將 LINE 會員 QR Code 或本系統簽章圖卡對準綠框，識別成功後將由 <span className="font-mono text-emerald-300">LineInAppBrowserHandler</span> 自動解析並快速登入。
          </p>
        </div>
      </div>
    </div>
  );
};
