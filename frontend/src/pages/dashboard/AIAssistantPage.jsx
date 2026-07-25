import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Sparkles, User } from 'lucide-react';
import api from '../../services/api.js';

const SUGGESTIONS = [
  'Draft 3 user stories for a notifications feature',
  'How should I structure a sprint retrospective?',
  'What story point scale should my team use?',
];

export default function AIAssistantPage() {
  const [messages, setMessages] = useState([
    { role: 'model', text: "Hi, I'm your DevTrack AI assistant. Ask me about Agile ceremonies, backlog grooming, or your DevOps pipeline." },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async (text) => {
    const message = text || input;
    if (!message.trim()) return;
    const history = messages.map((m) => ({ role: m.role, text: m.text }));
    setMessages((prev) => [...prev, { role: 'user', text: message }]);
    setInput('');
    setLoading(true);
    try {
      const { data } = await api.post('/ai/chat', { message, history });
      setMessages((prev) => [...prev, { role: 'model', text: data.reply }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'model', text: 'Sorry, I could not reach the AI service. Check that GEMINI_API_KEY is configured on the backend.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-3xl flex-col">
      <div className="mb-4">
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
          <Sparkles size={22} className="text-primary-light" /> AI Assistant
        </h1>
        <p className="mt-1 text-ink-400">Ask about Agile practices, or plan your next sprint out loud.</p>
      </div>

      <div className="glass-panel flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${m.role === 'user' ? 'bg-white/[0.08]' : 'bg-aurora'}`}>
                {m.role === 'user' ? <User size={15} /> : <Bot size={15} className="text-white" />}
              </span>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${m.role === 'user' ? 'bg-white/[0.08]' : 'glass'}`}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-ink-500">
              <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-primary-light" /> thinking…
            </div>
          )}
          <div ref={endRef} />
        </div>

        {messages.length === 1 && (
          <div className="flex flex-wrap gap-2 px-5 pb-3">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)} className="badge text-ink-300 hover:bg-white/[0.08]">{s}</button>
            ))}
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2 border-t border-white/[0.06] p-4">
          <input
            placeholder="Ask the AI assistant…"
            className="input-glass py-2.5 text-sm"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button type="submit" disabled={loading} className="btn-primary px-4"><Send size={16} /></button>
        </form>
      </div>
    </div>
  );
}
