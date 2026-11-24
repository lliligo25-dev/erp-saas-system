/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface HorizontalScrollStripProps {
  children: React.ReactNode;
  className?: string;
  wrapperClassName?: string;
  theme?: 'light' | 'dark';
  ariaLabel?: string;
}

/**
 * 支援手機手指滑動 + 電腦滑鼠拖曳滑動 + 滑鼠滾輪橫向滾動 + 左右快捷箭頭的橫向捲動列
 */
export const HorizontalScrollStrip: React.FC<HorizontalScrollStripProps> = ({
  children,
  className = '',
  wrapperClassName = '',
  theme = 'light',
  ariaLabel,
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    active: boolean;
    startX: number;
    startScrollLeft: number;
    moved: boolean;
  }>({ active: false, startX: 0, startScrollLeft: 0, moved: false });
  const suppressClickUntilRef = useRef<number>(0);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const updateScrollBounds = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(maxScroll > 2 && el.scrollLeft < maxScroll - 2);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    updateScrollBounds();

    const onScroll = () => updateScrollBounds();
    el.addEventListener('scroll', onScroll, { passive: true });

    const onWheel = (e: WheelEvent) => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll <= 2) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;

      const goingRight = e.deltaY > 0 && el.scrollLeft < maxScroll - 1;
      const goingLeft = e.deltaY < 0 && el.scrollLeft > 1;
      if (goingRight || goingLeft) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => updateScrollBounds());
      resizeObserver.observe(el);
    }

    const raf = window.requestAnimationFrame(updateScrollBounds);

    return () => {
      window.cancelAnimationFrame(raf);
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('wheel', onWheel);
      resizeObserver?.disconnect();
    };
  }, [children, updateScrollBounds]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const el = trackRef.current;
    if (!el || el.scrollWidth <= el.clientWidth + 2) return;

    dragStateRef.current = {
      active: true,
      startX: e.clientX,
      startScrollLeft: el.scrollLeft,
      moved: false,
    };
  };

  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
      const state = dragStateRef.current;
      const el = trackRef.current;
      if (!state.active || !el) return;

      const dx = e.clientX - state.startX;
      if (!state.moved && Math.abs(dx) > 5) {
        state.moved = true;
        setIsDragging(true);
      }
      if (state.moved) {
        e.preventDefault();
        el.scrollLeft = state.startScrollLeft - dx;
      }
    };

    const handleWindowMouseUp = () => {
      const state = dragStateRef.current;
      if (!state.active) return;
      if (state.moved) {
        suppressClickUntilRef.current = Date.now() + 180;
      }
      state.active = false;
      state.moved = false;
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, []);

  const handleClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (Date.now() < suppressClickUntilRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const scrollByStep = (direction: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    const step = Math.max(150, Math.round(el.clientWidth * 0.65));
    el.scrollBy({ left: direction * step, behavior: 'smooth' });
  };

  const leftMaskClass =
    theme === 'light'
      ? 'bg-gradient-to-r from-[#f8fafc] via-[#f8fafc]/95 to-transparent'
      : 'bg-gradient-to-r from-slate-950 via-slate-950/95 to-transparent';
  const rightMaskClass =
    theme === 'light'
      ? 'bg-gradient-to-l from-[#f8fafc] via-[#f8fafc]/95 to-transparent'
      : 'bg-gradient-to-l from-slate-950 via-slate-950/95 to-transparent';
  const arrowBtnClass =
    theme === 'light'
      ? 'w-7 h-7 rounded-full bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 shadow-xs flex items-center justify-center cursor-pointer transition-colors'
      : 'w-7 h-7 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 shadow-xs flex items-center justify-center cursor-pointer transition-colors';

  return (
    <div className={`relative min-w-0 w-full ${wrapperClassName}`}>
      {canScrollLeft && (
        <div
          className={`absolute inset-y-0 left-0 z-10 w-10 pl-1 flex items-center justify-start pointer-events-none ${leftMaskClass}`}
        >
          <button
            type="button"
            onClick={() => scrollByStep(-1)}
            aria-label="向左滾動查看更多選項"
            className={`pointer-events-auto ${arrowBtnClass}`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      )}

      <div
        ref={trackRef}
        aria-label={ariaLabel}
        onMouseDown={handleMouseDown}
        onClickCapture={handleClickCapture}
        className={`ais-h-scroll-track w-full min-w-0 overflow-x-auto overscroll-x-contain flex items-center ${
          isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'
        } ${className}`}
      >
        {children}
      </div>

      {canScrollRight && (
        <div
          className={`absolute inset-y-0 right-0 z-10 w-10 pr-1 flex items-center justify-end pointer-events-none ${rightMaskClass}`}
        >
          <button
            type="button"
            onClick={() => scrollByStep(1)}
            aria-label="向右滾動查看更多選項"
            className={`pointer-events-auto ${arrowBtnClass}`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
