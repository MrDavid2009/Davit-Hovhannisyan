/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Star, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Order } from '../types';

interface RatingWidgetProps {
  key?: string;
  order: Order;
  onRate: (orderId: string, rating: 1 | 2 | 3 | 4 | 5, comment: string) => void;
  onDismiss: (orderId: string) => void;
}

export function RatingWidget({ order, onRate, onDismiss }: RatingWidgetProps) {
  const [hovered, setHovered] = useState(0);
  const [selected, setSelected] = useState(0);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const labels = ['', 'Плохо', 'Неплохо', 'Хорошо', 'Отлично', 'Великолепно!'];
  const colors = ['', 'text-red-400', 'text-orange-400', 'text-yellow-400', 'text-lime-400', 'text-emerald-400'];

  const handleSubmit = () => {
    if (!selected) return;
    onRate(order.id, selected as 1|2|3|4|5, comment);
    setSubmitted(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className="bg-slate-900/90 border border-indigo-500/30 rounded-2xl p-5 relative"
    >
      <button
        onClick={() => onDismiss(order.id)}
        className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <AnimatePresence mode="wait">
        {!submitted ? (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <p className="text-xs text-indigo-400 font-bold uppercase tracking-wider mb-1">Заказ выдан ✅</p>
            <p className="text-white font-bold mb-1">Как вам качество печати?</p>
            <p className="text-xs text-slate-400 mb-4">{order.id} · {order.totalCost} ₽</p>

            {/* Звёздочки */}
            <div className="flex gap-2 mb-3">
              {[1,2,3,4,5].map(star => (
                <button
                  key={star}
                  onMouseEnter={() => setHovered(star)}
                  onMouseLeave={() => setHovered(0)}
                  onClick={() => setSelected(star)}
                  className="cursor-pointer transition-transform hover:scale-110 active:scale-95"
                >
                  <Star
                    className={`w-8 h-8 transition-colors ${
                      star <= (hovered || selected)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-600'
                    }`}
                  />
                </button>
              ))}
            </div>

            {/* Подпись под звёздами */}
            {(hovered || selected) > 0 && (
              <p className={`text-sm font-bold mb-3 ${colors[hovered || selected]}`}>
                {labels[hovered || selected]}
              </p>
            )}

            {/* Комментарий (необязательно) */}
            {selected > 0 && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Комментарий (необязательно)..."
                  rows={2}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:border-indigo-500 mb-3"
                />
              </motion.div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={!selected}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                  selected
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                Отправить оценку
              </button>
              <button
                onClick={() => onDismiss(order.id)}
                className="px-4 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 cursor-pointer transition-all"
              >
                Пропустить
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="thanks" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-2">
            <p className="text-3xl mb-2">🎉</p>
            <p className="text-white font-bold">Спасибо за оценку!</p>
            <p className="text-slate-400 text-sm mt-1">Это помогает нам становиться лучше</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
