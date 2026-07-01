/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export type Sticker = {
  emoji: string;
  label: string;
  animClass: string;
};

export const STICKERS: Sticker[] = [
  { emoji: '🤢', label: 'ФУУУУ', animClass: 'anim-shake' },
  { emoji: '🤩', label: 'ВАУ!', animClass: 'anim-glow anim-sparkle' },
  { emoji: '😭', label: 'ПЛАЧ', animClass: 'anim-rain anim-bounce' },
  { emoji: '😍', label: 'ОБОЖАЮ', animClass: 'anim-heartbeat' },
  { emoji: '😈', label: 'ЗЛОДЕЙ', animClass: 'anim-wobble anim-glow' },
  { emoji: '🧠', label: 'ГЕНИЙ', animClass: 'anim-pulse' },
  { emoji: '👌', label: 'ОКЕЙ', animClass: 'anim-bounce' },
  { emoji: '✅', label: 'ДА!', animClass: 'anim-pulse' },
  { emoji: '❌', label: 'НЕТ!', animClass: 'anim-shake' },
  { emoji: '🧙', label: 'ВОЛШЕБНИК', animClass: 'anim-float anim-sparkle' },
  { emoji: '🎓', label: 'ВЫПУСКНИК', animClass: 'anim-bounce' },
  { emoji: '❓', label: 'ЧТО?', animClass: 'anim-shake' },
  { emoji: '🔥', label: 'ОГОНЬ', animClass: 'anim-glow anim-pulse' },
  { emoji: '💀', label: 'РИП', animClass: 'anim-wobble' },
  { emoji: '🥳', label: 'УРА', animClass: 'anim-spin' },
  { emoji: '😴', label: 'СПЛЮ', animClass: 'anim-float' },
  { emoji: '☕', label: 'КОФЕ', animClass: 'anim-float' },
  { emoji: '🍕', label: 'ВКУСНО', animClass: 'anim-bounce' },
  { emoji: '👑', label: 'КОРОЛЬ', animClass: 'anim-glow anim-spin' },
  { emoji: '🤡', label: 'КЛОУН', animClass: 'anim-wobble' },
  { emoji: '👋', label: 'ПРИВЕТ', animClass: 'anim-bounce' },
  { emoji: '🙏', label: 'СПАСИБО', animClass: 'anim-pulse' },
  { emoji: '⏳', label: 'ЖДУ', animClass: 'anim-spin' },
  { emoji: '📦', label: 'ГОТОВО', animClass: 'anim-bounce' },
];

function burstParticles(x: number, y: number, emoji: string) {
  for (let i = 0; i < 8; i++) {
    const p = document.createElement('span');
    p.className = 'emoji-particle';
    p.textContent = emoji;
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    const a = (Math.PI * 2 * i) / 8;
    const d = 50 + Math.random() * 35;
    p.style.setProperty('--tx', Math.cos(a) * d + 'px');
    p.style.setProperty('--ty', Math.sin(a) * d + 'px');
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 800);
  }
}

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const handlePick = (e: React.MouseEvent, sticker: Sticker) => {
    burstParticles(e.clientX, e.clientY, sticker.emoji);
    onSelect(sticker.emoji);
    setTimeout(onClose, 120);
  };

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40" />
      <div className="emoji-picker-panel absolute bottom-full mb-2 left-0 z-50 rounded-2xl shadow-2xl p-3 w-[300px] max-h-[320px] overflow-y-auto">
        <div className="grid grid-cols-4 gap-2">
          {STICKERS.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => handlePick(e, s)}
              className="sticker-btn flex flex-col items-center gap-1"
            >
              <div className={`sticker__bubble ${s.animClass}`}>
                <span className="emoji-inner">{s.emoji}</span>
              </div>
              <span className="sticker__label">{s.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
