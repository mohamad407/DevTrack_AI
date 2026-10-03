import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mic, MicOff, Loader2, Send, X, Volume2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

/**
 * Salina - voice agent. Say "Salina" (Chrome / Edge) and she answers in a female voice,
 * then runs your request through the same API your clicks use, so she can never do more
 * than your own role allows. Typing a command in her panel works in every browser.
 */

const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

// speech recognition often hears "Salina" as one of these
const WAKE_RE = /\b(salina|salena|saleena|selena|celina|sireena|sirina|salinah|sailina)\b/i;
const YES_RE = /^(yes|yeah|yep|yup|sure|ok|okay|go ahead|do it|confirm|please do|correct|right)\b/;
const NO_RE = /^(no|nope|nah|cancel|stop|don't|dont|never mind|nevermind)\b/;

// first match wins, so natural neural voices come first
const FEMALE_VOICE_HINTS = ['aria', 'jenny', 'zira', 'samantha', 'google uk english female', 'google us english', 'hazel', 'susan', 'karen', 'moira', 'tessa', 'victoria', 'female'];

const PHASE_LABEL = {
  off: 'Voice is off',
  idle: 'Say "Salina" to wake me',
  awake: 'Listening...',
  thinking: 'Thinking...',
  speaking: 'Speaking...',
};

const TARGETS = {
  dashboard: 'dashboard', home: 'dashboard', overview: 'dashboard', project: 'projects', projects: 'projects',
  backlog: 'backlog', sprint: 'sprints', sprints: 'sprints', board: 'board', kanban: 'board', analytics: 'analytics',
  devops: 'devops', 'dev ops': 'devops', team: 'team', assistant: 'ai', 'ai assistant': 'ai', profile: 'profile', admin: 'admin',
};

const PRIORITY_RANK = { Critical: 4, High: 3, Medium: 2, Low: 1 };

const pickVoice = () => {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  const en = voices.filter((v) => /^en/i.test(v.lang));
  for (const hint of FEMALE_VOICE_HINTS) {
    const v = en.find((x) => x.name.toLowerCase().includes(hint));
    if (v) return v;
  }
  return en[0] || voices[0] || null;
};

// quick commands handled locally: instant, free, and they work even if the AI service is down
function parseLocal(text) {
  const t = text.toLowerCase().replace(/[.,!?]/g, ' ').replace(/\s+/g, ' ').trim();
  if (/^(stop|cancel|quiet|be quiet|never mind|nevermind|that's all|thats all)$/.test(t) || /^(thank you|thanks)/.test(t)) {
    return { action: 'dismiss', params: {}, speech: 'Anytime!' };
  }
  const nav = t.match(/^(?:open|go to|show me|show|take me to|navigate to|launch)\s+(?:the\s+|my\s+)?(dashboard|home|overview|projects?|backlog|sprints?|board|kanban|analytics|devops|dev ops|team|ai assistant|assistant|profile|admin)(?:\s+(?:of|for|in)\s+(.+))?$/);
  if (nav) {
    const label = nav[1] === 'dev ops' ? 'DevOps' : nav[1];
    return { action: 'navigate', params: { target: TARGETS[nav[1]], project: nav[2] || '' }, speech: `Sure, opening ${label}.` };
  }
  if (/\b(my (tasks|work|stories|assignments)|assigned to me|on my plate)\b/.test(t)) return { action: 'my_work', params: {}, speech: '' };
  if (/\bnotifications?\b/.test(t)) return { action: 'notifications', params: { markRead: /\b(mark|clear)\b/.test(t) }, speech: '' };
  if (
    /\b(is|are)\b.*\b(site|app|website|production|server)\b.*\b(up|down|running|healthy|working)\b/.test(t) ||
    /\b(devops|deployment|deploy) status\b/.test(t) ||
    /\bhow('s| is) (the )?(site|production|deployment)/.test(t)
  ) {
    return { action: 'devops_status', params: { project: '' }, speech: '' };
  }
  return null;
}

const failSpeech = (err, fallback) =>
  err?.response?.status === 403
    ? "Sorry, you don't have permission to do that."
    : err?.response?.data?.message || err?.response?.data?.error || fallback;

export default function SalinaAgent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem('salina_enabled') === '1'; } catch { return false; }
  });
  const [phase, setPhase] = useState('off');
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState([]);
  const [typed, setTyped] = useState('');

  const enabledRef = useRef(false);
  const recogRef = useRef(null);
  const awakeRef = useRef(false);
  const awakeTimer = useRef(null);
  const pendingTimer = useRef(null);
  const busyRef = useRef(false);
  const speakingRef = useRef(false);
  const ignoreUntil = useRef(0);
  const pendingRef = useRef(null);
  const projectsRef = useRef(null);
  const heardRef = useRef(null);
  const pathRef = useRef(location.pathname);
  const quickEnds = useRef(0);
  const lastStart = useRef(0);
  pathRef.current = location.pathname;

  const addLine = useCallback((who, text) => setLog((l) => [...l.slice(-5), { who, text }]), []);

  const firstName = () => {
    const raw = (user?.name || '').replace(/[0-9_]+/g, ' ').trim().split(/\s+/)[0];
    return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'there';
  };

  /* ------------------------------ speaking ------------------------------ */
  const speak = useCallback((text) => new Promise((resolve) => {
    addLine('salina', text);
    const synth = window.speechSynthesis;
    if (!synth) return resolve();
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = 'en-US'; }
    u.rate = 1.03;
    u.pitch = 1.12;
    speakingRef.current = true;
    setPhase('speaking');
    const done = () => {
      speakingRef.current = false;
      ignoreUntil.current = Date.now() + 500; // don't hear my own echo
      resolve();
    };
    u.onend = done;
    u.onerror = done;
    synth.speak(u);
  }), [addLine]);

  const finish = () => {
    setPhase(enabledRef.current ? (awakeRef.current ? 'awake' : 'idle') : 'off');
  };

  const openWindow = () => {
    awakeRef.current = true;
    setPhase('awake');
    clearTimeout(awakeTimer.current);
    awakeTimer.current = setTimeout(() => {
      awakeRef.current = false;
      setPhase(enabledRef.current ? 'idle' : 'off');
    }, 9000);
  };

  /* ------------------------------ helpers for actions ------------------------------ */
  const getProjects = async () => {
    if (projectsRef.current) return projectsRef.current;
    const { data } = await api.get('/projects');
    projectsRef.current = data.projects || [];
    return projectsRef.current;
  };

  const resolveProject = async (hint) => {
    const projects = await getProjects();
    const h = (hint || '').toLowerCase().trim();
    if (h) {
      const found = projects.find((p) => p.name.toLowerCase().includes(h) || h.includes(p.name.toLowerCase()));
      if (found) return found;
    }
    const m = pathRef.current.match(/projects\/([a-f0-9]{24})/);
    if (m) {
      const found = projects.find((p) => p._id === m[1]);
      if (found) return found;
    }
    if (projects.length === 1) return projects[0];
    return null;
  };

  const askWhichProject = async () => {
    await speak('Which project do you mean? Say the project name, or open a project first.');
    openWindow();
  };

  const askConfirm = async (prompt, run) => {
    await speak(prompt);
    pendingRef.current = { run };
    setPhase('awake');
    clearTimeout(pendingTimer.current);
    pendingTimer.current = setTimeout(() => { pendingRef.current = null; finish(); }, 15000);
  };

  /* ------------------------------ actions ------------------------------ */
  const execute = async (plan) => {
    const params = plan.params || {};
    switch (plan.action) {
      case 'dismiss':
        await speak(plan.speech || 'Anytime!');
        return;

      case 'navigate': {
        const t = params.target;
        const base = { dashboard: '/dashboard', projects: '/dashboard/projects', ai: '/dashboard/ai-assistant', profile: '/dashboard/profile', admin: '/dashboard/admin' };
        if (t === 'admin' && user?.systemRole !== 'admin') { await speak('Only admins can open the admin panel.'); return; }
        if (base[t]) {
          await speak(plan.speech || 'Sure.');
          navigate(base[t]);
          return;
        }
        if (['backlog', 'sprints', 'board', 'analytics', 'devops', 'team'].includes(t)) {
          const p = await resolveProject(params.project);
          if (!p) { await askWhichProject(); return; }
          await speak(plan.speech || 'Sure.');
          navigate(`/dashboard/projects/${p._id}/${t}`);
          return;
        }
        await speak("I'm not sure which page you mean.");
        openWindow();
        return;
      }

      case 'create_story': {
        if (!params.title) { await speak('What should the story be called?'); openWindow(); return; }
        const p = await resolveProject(params.project);
        if (!p) { await askWhichProject(); return; }
        try {
          await api.post('/backlog', {
            project: p._id,
            title: params.title,
            description: params.description || '',
            priority: ['Low', 'Medium', 'High', 'Critical'].includes(params.priority) ? params.priority : 'Medium',
          });
          toast.success(`Story added to ${p.name}`);
          await speak(plan.speech || `Done. I added "${params.title}" to the ${p.name} backlog.`);
        } catch (err) {
          await speak(failSpeech(err, "I couldn't add that story."));
        }
        return;
      }

      case 'my_work': {
        const projects = await getProjects();
        const myId = user?.id || user?._id;
        const lists = await Promise.all(
          projects.map((p) =>
            api.get('/backlog', { params: { project: p._id } })
              .then((r) => (r.data.stories || []).map((s) => ({ ...s, projectName: p.name })))
              .catch(() => [])
          )
        );
        const mine = lists.flat()
          .filter((s) => s.status !== 'Done' && (s.assignee?._id === myId || s.assignee === myId))
          .sort((a, b) => (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0));
        if (!mine.length) {
          await speak("You've got nothing assigned right now. Nice and clear.");
        } else {
          const top = mine.slice(0, 3).map((s) => s.title.slice(0, 60)).join(', ');
          await speak(`You have ${mine.length} open ${mine.length === 1 ? 'story' : 'stories'}. The top ${Math.min(3, mine.length) === 1 ? 'one is' : 'ones are'}: ${top}.`);
        }
        return;
      }

      case 'notifications': {
        if (params.markRead) {
          await api.put('/notifications/read-all');
          await speak('Done, I marked everything as read.');
          return;
        }
        const { data } = await api.get('/notifications');
        const unread = (data.notifications || []).filter((n) => !n.read);
        if (!unread.length) await speak("You're all caught up, no new notifications.");
        else await speak(`You have ${unread.length} new ${unread.length === 1 ? 'notification' : 'notifications'}. ${unread.slice(0, 3).map((n) => n.message).join('. ')}.`);
        return;
      }

      case 'devops_status': {
        const p = await resolveProject(params.project);
        if (!p) { await askWhichProject(); return; }
        const [h, s] = await Promise.all([
          api.get(`/devops/${p._id}/health`).then((r) => r.data).catch(() => null),
          api.get(`/devops/${p._id}/summary`).then((r) => r.data).catch(() => null),
        ]);
        const a = !h?.configured
          ? `There's no live URL set up for ${p.name} yet.`
          : h.up ? `${p.name} is up and answering in ${h.responseMs} milliseconds.` : `Heads up, ${p.name} looks down right now.`;
        const b = s?.total
          ? ` You've had ${s.total} deployments in the last 30 days${s.successRate != null ? ` with a ${s.successRate} percent success rate` : ''}.`
          : ' No deployments are recorded yet.';
        await speak(a + b);
        return;
      }

      case 'announce': {
        if (user?.systemRole !== 'admin') { await speak('Only admins can post announcements.'); return; }
        if (!params.title && !params.message) { await speak('What should the announcement say?'); openWindow(); return; }
        const title = params.title || params.message.slice(0, 60);
        const message = params.message || params.title;
        await askConfirm(`${plan.speech || `I'll announce "${title}" to everyone.`} Should I go ahead?`, async () => {
          try {
            await api.post('/admin/announcements', { title, message, severity: params.severity || 'info' });
            await speak('Posted. Everyone will see it on their dashboard.');
          } catch (err) {
            await speak(failSpeech(err, "I couldn't post that announcement."));
          }
        });
        return;
      }

      case 'deploy': {
        const p = await resolveProject(params.project);
        if (!p) { await askWhichProject(); return; }
        const environment = params.environment || 'Production';
        await askConfirm(`You want me to deploy ${environment} for ${p.name}. Are you sure?`, async () => {
          try {
            const { data } = await api.post(`/devops/${p._id}/deploy`, { environment });
            await speak(data.message === 'Deploy hook triggered' ? 'Deploy started. I will leave it in your deployment history.' : data.message || 'Deploy started.');
          } catch (err) {
            await speak(failSpeech(err, "I couldn't start that deploy."));
          }
        });
        return;
      }

      default: // chat / unknown
        await speak(plan.speech || "Sorry, I didn't catch that.");
        if (plan.action === 'unknown') openWindow();
    }
  };

  const runCommand = async (text) => {
    busyRef.current = true;
    clearTimeout(awakeTimer.current);
    awakeRef.current = false;
    setPhase('thinking');
    addLine('you', text);
    try {
      let plan = parseLocal(text);
      if (!plan) {
        try {
          const { data } = await api.post('/ai/salina', { text, path: pathRef.current });
          plan = data;
        } catch {
          await speak("Sorry, my AI side isn't responding right now. Quick commands like opening pages still work.");
          return;
        }
      }
      await execute(plan);
    } catch (err) {
      await speak(failSpeech(err, 'Something went wrong on my side. Try again?'));
    } finally {
      busyRef.current = false;
      finish();
    }
  };

  const wake = async () => {
    busyRef.current = true;
    try {
      await speak(`Hi ${firstName()}, how can I help you?`);
      openWindow();
    } finally {
      busyRef.current = false;
    }
  };

  // every sentence the mic hears (or the user types) comes through here
  const handleHeard = async (raw, forced = false) => {
    const text = raw.trim();
    if (!text) return;
    if (!forced && (speakingRef.current || Date.now() < ignoreUntil.current || busyRef.current)) return;

    // waiting for a yes / no
    if (pendingRef.current) {
      const { run } = pendingRef.current;
      pendingRef.current = null;
      clearTimeout(pendingTimer.current);
      const t = text.toLowerCase().replace(/[.,!?]/g, '').replace(WAKE_RE, '').trim();
      addLine('you', text);
      busyRef.current = true;
      try {
        if (YES_RE.test(t)) await run();
        else if (NO_RE.test(t)) await speak('Okay, cancelled.');
        else await speak("I didn't hear a clear yes, so I'll skip that.");
      } finally {
        busyRef.current = false;
        finish();
      }
      return;
    }

    const stripWake = (s) => s.replace(WAKE_RE, '').replace(/^[\s,.:;!?-]+/, '').trim();

    // command window is open (she just greeted) or the user typed it
    if (awakeRef.current || forced) {
      await runCommand(stripWake(text) || text);
      return;
    }

    const m = text.match(WAKE_RE);
    if (!m) return; // not talking to me
    const after = text.slice(m.index + m[0].length).replace(/^[\s,.:;!?-]+/, '').trim();
    if (after.length > 2) await runCommand(after); // "Salina open DevOps"
    else await wake(); // just "Salina"
  };
  heardRef.current = handleHeard;

  /* ------------------------------ microphone ------------------------------ */
  const stopRecognition = useCallback(() => {
    const r = recogRef.current;
    recogRef.current = null;
    try { r?.abort(); } catch { /* ignore */ }
    window.speechSynthesis?.cancel();
    clearTimeout(awakeTimer.current);
    clearTimeout(pendingTimer.current);
    awakeRef.current = false;
    pendingRef.current = null;
    speakingRef.current = false;
  }, []);

  const startRecognition = useCallback(() => {
    if (!SR || recogRef.current) return;
    const r = new SR();
    r.continuous = true;
    r.interimResults = false;
    r.lang = /^en/i.test(navigator.language || '') ? navigator.language : 'en-US';

    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (!e.results[i].isFinal) continue;
        const text = e.results[i][0].transcript.trim();
        if (text) heardRef.current?.(text);
      }
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        toast.error('Microphone permission is blocked. Allow it in the browser address bar, then turn Salina on again.');
        setEnabled(false);
      }
    };
    r.onend = () => {
      if (recogRef.current !== r) return; // replaced or stopped on purpose
      recogRef.current = null;
      if (!enabledRef.current) return;
      // the browser ends sessions every so often - restart, but give up if it keeps dying instantly
      quickEnds.current = Date.now() - lastStart.current < 800 ? quickEnds.current + 1 : 0;
      if (quickEnds.current >= 6) {
        toast.error('Voice service is not available right now.');
        setEnabled(false);
        return;
      }
      setTimeout(() => { if (enabledRef.current) startRecognition(); }, 300);
    };

    recogRef.current = r;
    lastStart.current = Date.now();
    try { r.start(); } catch { recogRef.current = null; }
  }, []);

  useEffect(() => {
    enabledRef.current = enabled;
    try { localStorage.setItem('salina_enabled', enabled ? '1' : '0'); } catch { /* ignore */ }
    if (enabled && SR) {
      quickEnds.current = 0;
      setPhase((p) => (p === 'off' ? 'idle' : p));
      startRecognition();
    } else {
      stopRecognition();
      setPhase('off');
    }
  }, [enabled, startRecognition, stopRecognition]);

  useEffect(() => () => { enabledRef.current = false; stopRecognition(); }, [stopRecognition]);

  // browsers only allow speech after a click: prime it, and load the voice list
  useEffect(() => {
    const prime = () => { try { window.speechSynthesis?.speak(new SpeechSynthesisUtterance('')); } catch { /* ignore */ } };
    window.addEventListener('click', prime, { once: true });
    window.speechSynthesis?.getVoices();
    return () => window.removeEventListener('click', prime);
  }, []);

  const submitTyped = (e) => {
    e.preventDefault();
    const v = typed;
    setTyped('');
    heardRef.current?.(v, true);
  };

  const listening = enabled && ['idle', 'awake', 'speaking'].includes(phase);

  return (
    <>
      {open && (
        <div className="glass-card fixed bottom-24 right-5 z-40 flex w-[min(22rem,calc(100vw-2.5rem))] flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-display text-sm font-semibold">Salina</p>
              <p className="flex items-center gap-1.5 text-xs text-ink-400">
                {phase === 'thinking' && <Loader2 size={11} className="animate-spin" />}
                {phase === 'speaking' && <Volume2 size={11} />}
                {PHASE_LABEL[phase]}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {SR && (
                <button
                  onClick={() => setEnabled((v) => !v)}
                  className={`btn-ghost px-2.5 py-1.5 text-xs ${enabled ? 'text-success' : ''}`}
                  title={enabled ? 'Turn voice off' : 'Turn voice on'}
                >
                  {enabled ? <Mic size={13} /> : <MicOff size={13} />} {enabled ? 'On' : 'Off'}
                </button>
              )}
              <button onClick={() => setOpen(false)} className="btn-ghost px-2 py-1.5" aria-label="Close"><X size={14} /></button>
            </div>
          </div>

          <div className="max-h-56 min-h-[3.5rem] space-y-2 overflow-y-auto text-sm">
            {log.length === 0 ? (
              <p className="text-ink-500">
                {SR
                  ? 'Turn voice on, then say "Salina". Try: "open DevOps", "what are my tasks", "add a story to fix the login bug".'
                  : 'Voice needs Chrome or Edge. You can still type commands below.'}
              </p>
            ) : (
              log.map((l, i) => (
                <p key={i} className={l.who === 'you' ? 'text-right text-ink-300' : 'text-primary-light'}>
                  {l.text}
                </p>
              ))
            )}
          </div>

          <form onSubmit={submitTyped} className="flex gap-2">
            <input
              className="input-glass flex-1 py-2 text-sm"
              placeholder="Or type a command..."
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
            <button type="submit" className="btn-primary px-3" aria-label="Send"><Send size={14} /></button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Salina assistant"
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-aurora text-white shadow-lg transition-transform hover:scale-105"
      >
        {listening && <span className="absolute inset-0 animate-ping rounded-full bg-primary-light/30" />}
        <span className="relative">
          {phase === 'thinking' ? <Loader2 size={22} className="animate-spin" /> : phase === 'speaking' ? <Volume2 size={22} /> : enabled ? <Mic size={22} /> : <MicOff size={22} />}
        </span>
      </button>
    </>
  );
}
