import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Sparkles, Bot, User } from 'lucide-react'
import axios from 'axios'

// ---- Adjust these two lines to match how your project calls the backend ----
// If you already have an axios instance (e.g. src/services/api.js, src/lib/api.js,
// src/api/axios.js) that attaches your JWT automatically, import and use that instead
// of the inline call below — then you can delete the axios import above.
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'
const AUTH_TOKEN_KEY = 'devtrack_jwt' // the localStorage key your app stores the JWT under
// -----------------------------------------------------------------------------

export default function ChatWidget() {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: "Hi, I'm your AI agile assistant. Ask me to draft a user story, estimate points, or summarize your last standup." },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg = { role: 'user', text: input }
    setMessages((m) => [...m, userMsg])
    setInput('')
    setLoading(true)
    try {
      const token = localStorage.getItem(AUTH_TOKEN_KEY)
      const { data } = await axios.post(
        `${API_BASE_URL}/ai/chat`,
        { message: userMsg.text },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      )
      setMessages((m) => [...m, { role: 'assistant', text: data.reply }])
    } catch {
      setMessages((m) => [...m, { role: 'assistant', text: "I couldn't reach the AI service — check that GROQ_API_KEY is configured on the backend." }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="relative rounded-2xl flex flex-col h-[560px] overflow-hidden border border-white/10
      bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-2xl
      shadow-[0_8px_40px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)]">

      {/* ambient glow blobs behind the glass */}
      <div className="pointer-events-none absolute -top-16 -left-10 w-56 h-56 rounded-full bg-violet-500/25 blur-[70px]" />
      <div className="pointer-events-none absolute -bottom-20 -right-10 w-56 h-56 rounded-full bg-cyan-400/20 blur-[70px]" />

      {/* header */}
      <div className="relative flex items-center gap-2.5 px-4 py-3.5 border-b border-white/10 bg-white/[0.03] backdrop-blur-xl">
        <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center shadow-[0_0_18px_rgba(139,124,255,0.55)]">
          <Sparkles size={16} className="text-void" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">AI Agile Assistant</p>
          <p className="text-xs text-slate-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,230,197,0.9)] animate-pulse" />
            Powered by Groq
          </p>
        </div>
      </div>

      {/* messages */}
      <div className="relative flex-1 overflow-y-auto px-4 py-4 space-y-3.5">
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className={`flex items-end gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.role === 'assistant' && (
                <div className="w-7 h-7 shrink-0 rounded-full bg-white/10 border border-white/10 backdrop-blur-md flex items-center justify-center">
                  <Bot size={13} className="text-violet-300" />
                </div>
              )}
              <div
                className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed backdrop-blur-xl border
                ${m.role === 'user'
                  ? 'bg-gradient-to-br from-violet-500/35 to-cyan-500/25 border-violet-300/25 text-white rounded-br-md shadow-[0_4px_18px_rgba(139,124,255,0.25)]'
                  : 'bg-white/[0.06] border-white/10 text-slate-100 rounded-bl-md shadow-[0_4px_18px_rgba(0,0,0,0.25)]'}`}
              >
                {m.text}
              </div>
              {m.role === 'user' && (
                <div className="w-7 h-7 shrink-0 rounded-full bg-gradient-to-br from-violet-400 to-cyan-400 flex items-center justify-center">
                  <User size={13} className="text-void" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 pl-9"
          >
            <div className="flex items-center gap-1 bg-white/[0.06] border border-white/10 backdrop-blur-xl rounded-2xl rounded-bl-md px-3.5 py-2.5">
              {[0, 1, 2].map((d) => (
                <span
                  key={d}
                  className="w-1.5 h-1.5 rounded-full bg-violet-300/80"
                  style={{ animation: 'chatDotBounce 1.1s ease-in-out infinite', animationDelay: `${d * 0.15}s` }}
                />
              ))}
            </div>
          </motion.div>
        )}
        <div ref={endRef} />
      </div>

      {/* input bar */}
      <div className="relative p-3 border-t border-white/10 bg-white/[0.03] backdrop-blur-xl">
        <div className="flex items-center gap-2 rounded-xl bg-white/[0.05] border border-white/10 focus-within:border-violet-400/50 focus-within:shadow-[0_0_0_3px_rgba(139,124,255,0.15)] transition-all px-1">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="e.g. Generate a story for password reset flow"
            className="flex-1 bg-transparent outline-none text-sm px-2.5 py-2.5 placeholder:text-slate-500"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="w-9 h-9 m-1 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-void
              shadow-[0_0_14px_rgba(139,124,255,0.45)] disabled:opacity-40 disabled:shadow-none transition-all hover:scale-105 active:scale-95"
          >
            <Send size={14} />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes chatDotBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
