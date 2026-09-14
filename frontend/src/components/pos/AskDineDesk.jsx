import React, { useState, useRef, useEffect } from 'react';
import { intelligenceAPI } from '../../lib/api';
import { X, Send, Sparkles } from 'lucide-react';
import haptics from '../../lib/haptics';

/**
 * AskDineDesk — floating AI assistant. Every answer comes from the backend's
 * verified computed data; the assistant says so when data is missing.
 */
export default function AskDineDesk() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'ai', text: "Vanakkam! I'm DineDesk Intelligence 🌿\nAsk me about your sales, best sellers, peak hours or stock — I only answer from your real data." },
  ]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, thinking]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 250);
  }, [open]);

  const SUGGESTIONS = [
    'Indha week sales epdi?',
    'Best selling item enna?',
    'Busiest time enna?',
    'Which items sell together?',
  ];

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || thinking) return;
    haptics.tick();
    setMessages(m => [...m, { role: 'user', text: q }]);
    setInput('');
    setThinking(true);
    try {
      const res = await intelligenceAPI.ask(q);
      setMessages(m => [...m, { role: 'ai', text: res.data.answer, ai: res.data.ai_generated }]);
    } catch (err) {
      setMessages(m => [...m, { role: 'ai', text: 'Sorry — something went wrong on my side. Please try again.' }]);
    } finally {
      setThinking(false);
    }
  };

  return (
    <>
      {/* Floating button — bottom-right, above safe area */}
      {!open && (
        <button
          onClick={() => { haptics.press(); setOpen(true); }}
          className="fixed z-40 right-4 bottom-24 lg:bottom-6 w-13 h-13 min-w-[52px] min-h-[52px] px-4 py-3 rounded-full bg-[#0F2417] dark:bg-[#2E9E5B] text-white text-xs font-bold flex items-center gap-2 shadow-[0_10px_30px_-6px_rgba(15,36,23,0.5)] ring-1 ring-white/10 hover:brightness-110 active:scale-95 transition-all animate-cart-pop"
          data-testid="ask-dinedesk-btn"
          aria-label="Ask DineDesk AI"
        >
          <Sparkles className="w-4.5 h-4.5" />
          <span className="hidden sm:inline">Ask DineDesk</span>
        </button>
      )}

      {/* Chat window */}
      {open && (
        <div
          className="fixed z-50 right-3 bottom-20 lg:bottom-6 w-[calc(100vw_-_1.5rem)] max-w-[380px] h-[480px] max-h-[70dvh] flex flex-col rounded-3xl bg-white dark:bg-[#161A20] border border-slate-200/70 dark:border-white/[0.08] shadow-[0_24px_70px_-12px_rgba(15,36,23,0.45)] overflow-hidden animate-cart-pop"
          data-testid="ask-dinedesk-panel"
          role="dialog"
          aria-label="Ask DineDesk AI chat"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#0F2417] dark:bg-[#0F2417] flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-[#2E9E5B] flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
                <Sparkles className="w-4 h-4 text-white" />
              </span>
              <div>
                <p className="text-white text-[13px] font-bold leading-none">Ask DineDesk</p>
                <p className="text-white/50 text-[10px] mt-1 leading-none">Answers from your real data</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3" data-testid="chat-messages">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-[12.5px] leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-[#2E9E5B] text-white rounded-br-md'
                      : 'bg-slate-100 dark:bg-white/[0.06] text-slate-800 dark:text-white/85 rounded-bl-md'
                  }`}
                >
                  {m.text}
                  {m.role === 'ai' && m.ai === false && i > 0 && (
                    <span className="block mt-1.5 text-[9.5px] text-slate-400 dark:text-white/35">computed directly from your data</span>
                  )}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex justify-start">
                <div className="bg-slate-100 dark:bg-white/[0.06] px-4 py-3 rounded-2xl rounded-bl-md flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            {messages.length <= 1 && !thinking && (
              <div className="pt-2 space-y-2">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="block w-full text-left px-3.5 py-2.5 rounded-2xl border border-emerald-200/70 dark:border-emerald-400/20 text-[12px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-400/[0.06] hover:bg-emerald-50 active:scale-[0.98] transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center gap-2 flex-shrink-0" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send(); }}
              placeholder="Ask about your restaurant..."
              className="flex-1 h-10 px-4 rounded-full bg-slate-100 dark:bg-white/[0.06] text-[13px] text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 outline-none focus:ring-2 focus:ring-[#2E9E5B]/40 transition-shadow"
              data-testid="chat-input"
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || thinking}
              className="w-10 h-10 rounded-full bg-[#2E9E5B] text-white flex items-center justify-center flex-shrink-0 disabled:opacity-40 active:scale-90 transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
              aria-label="Send question"
              data-testid="chat-send"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
