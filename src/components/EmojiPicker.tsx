/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

const EMOJI_LIST = [
  '😊', '😂', '🤣', '😍', '😘', '😉', '😎', '🤔',
  '😢', '😭', '😡', '😱', '😴', '🥳', '👍', '👎',
  '🙏', '👏', '🤝', '✌️', '💪', '❤️', '🔥', '🎉',
  '✅', '❌', '⏳', '⭐', '📸', '🖨️', '📄', '📦',
  '🚀', '👋', '🤗', '😅', '🙌', '💯', '👌', '🎁',
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40" />
      <div className="emoji-picker-panel absolute bottom-full mb-2 left-0 z-50 rounded-2xl shadow-2xl p-3 w-72">
        <div className="grid grid-cols-8 gap-1">
          {EMOJI_LIST.map((emoji, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { onSelect(emoji); onClose(); }}
              className="text-lg w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-150 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
