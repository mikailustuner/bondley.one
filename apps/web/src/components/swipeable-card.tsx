"use client";

import { useRef, useState } from "react";

interface SwipeableCardProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  leftLabel?: string;
  rightLabel?: string;
}

export function SwipeableCard({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftLabel = "Çıkar",
  rightLabel = "Ekle",
}: SwipeableCardProps) {
  const startX = useRef(0);
  const currentDx = useRef(0);
  const didSwipe = useRef(false);
  const [deltaX, setDeltaX] = useState(0);

  const THRESHOLD = 60;

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    didSwipe.current = false;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const dx = Math.max(-110, Math.min(110, e.touches[0].clientX - startX.current));
    currentDx.current = dx;
    setDeltaX(dx);
  };

  const onTouchEnd = () => {
    const dx = currentDx.current;
    if (dx < -THRESHOLD && onSwipeLeft) { onSwipeLeft(); didSwipe.current = true; }
    else if (dx > THRESHOLD && onSwipeRight) { onSwipeRight(); didSwipe.current = true; }
    currentDx.current = 0;
    setDeltaX(0);
  };

  const actionOpacity = (raw: number) => Math.min(1, Math.abs(raw) / THRESHOLD);

  return (
    <div
      className="relative overflow-hidden rounded-3xl"
      onClickCapture={(e) => {
        if (didSwipe.current) {
          e.preventDefault();
          e.stopPropagation();
          didSwipe.current = false;
        }
      }}
    >
      {onSwipeLeft && (
        <div
          className="absolute inset-0 flex items-center justify-end pr-5 bg-red-500 rounded-3xl"
          style={{ opacity: deltaX < -10 ? actionOpacity(deltaX) : 0 }}
        >
          <span className="text-white text-[13px] font-semibold">{leftLabel}</span>
        </div>
      )}
      {onSwipeRight && (
        <div
          className="absolute inset-0 flex items-center justify-start pl-5 bg-green-600 rounded-3xl"
          style={{ opacity: deltaX > 10 ? actionOpacity(deltaX) : 0 }}
        >
          <span className="text-white text-[13px] font-semibold">{rightLabel}</span>
        </div>
      )}
      <div
        style={{
          transform: `translateX(${deltaX}px)`,
          transition: deltaX === 0 ? "transform 0.25s ease" : undefined,
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
