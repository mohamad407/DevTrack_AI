import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mic, MicOff, Loader2, Send, X, Volume2, VolumeX } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

/**
 * Salina - voice agent. Say "Salina" (Chrome / Edge) and she answers in a female voice,
 * then keeps the conversation open so you can give follow-up commands without waking her again.
 * Everything runs through the same API your clicks use, so she can never do more than your role allows.
 * Typing a command in her panel works in every browser.
 */

const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

// speech recognition often hears "Salina" as one of these
const WAKE_RE = /\b(salina|salena|saleena|selena|celina|sireena|sirina|salinah|sailina)\b/i;
const YES_RE = /^(yes|yeah|yep|yup|sure|ok|okay|go ahead|do it|confirm|please do|correct|right)\b/;
const NO_RE = /^(no|nope|nah|cancel|stop|don't|dont|never mind|nevermind)\b/;

const WINDOW_MS = 12000; // how long she keeps listening for the next command

// first match wins, so natural neural voices come first
const FEMALE_VOICE_HINTS = ['aria', 'jenny', 'zira', 'samantha', 'google uk english female', 'google us english', 'hazel', 'susan', 'karen', 'moira', 'tessa', 'victoria', 'female'];

const PHASE_LABEL = {
  off: 'Voice is off',
  idle: 'Say "Salina" to wake me',
  awake: 'Listening... go ahead',
  thinking: 'Thinking...',
  speaking: 'Speaking...',
};

const TARGETS = {
  dashboard: 'dashboard', home: 'dashboard', overview: 'dashboard', project: 'projects', projects: 'projects',
  backlog: 'backlog', sprint: 'sprints', sprints: 'sprints', board: 'board', kanban: 'board', analytics: 'analytics',
  devops: 'devops', 'dev ops': 'devops', team: 'team', assistant: 'ai', 'ai assistant': 'ai', profile: 'profile', admin: 'admin',
};

const STATUSES = ['Backlog', 'To Do', 'In Progress', 'Code Review', 'Testing', 'Done'];
const STATUS_MAP = [
  [/backlog/, 'Backlog'],
  [/to ?do|todo|ready/, 'To Do'],
  [/progress|started|working|doing/, 'In Progress'],
  [/review/, 'Code Review'],
  [/test|qa/, 'Testing'],
  [/done|finish|complete|closed|shipped/, 'Done'],
];
const toStatus = (s = '') => {
  if (STATUSES.includes(s)) return s;
  const t = String(s).toLowerCase();
  for (const [re, val] of STATUS_MAP) if (re.test(t)) return val;
  return null;
};

const PRIORITY_RANK = { Critical: 4, High: 3, Medium: 2, Low: 1 };
const IT_RE = /^(it|that|this|that one|this one|the story|that story|this story|same one)$/i;
const STOP_WORDS = ['the', 'a', 'an', 'story', 'task', 'ticket', 'item', 'one', 'please'];

const norm = (s = '') => String(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

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

  if (/^(stop|cancel|quiet|be quiet|never mind|nevermind|that's all|thats all|that is all|i'm done|im done|goodbye|bye)$/.test(t) || /^(thank you|thanks)/.test(t)) {
    return { action: 'dismiss', params: {}, speech: 'Anytime!' };
  }

  const nav = t.match(/^(?:open|go to|show me|show|take me to|navigate to|launch)\s+(?:the\s+|my\s+)?(dashboard|home|overview|projects?|backlog|sprints?|board|kanban|analytics|devops|dev ops|team|ai assistant|assistant|profile|admin)(?:\s+(?:of|for|in)\s+(.+))?$/);
  if (nav) {
    const label = nav[1] === 'dev ops' ? 'DevOps' : nav[1];
    return { action: 'navigate', params: { target: TARGETS[nav[1]], project: nav[2] || '' }, speech: `Sure, opening ${label}.` };
  }

  const orig = text.replace(/[.,!?]/g, ' ').replace(/\s+/g, ' ').trim(); // keeps the capitals you said
  const proj = orig.match(/^(?:create|make|start|add|set up)\s+(?:a\s+|an\s+|one\s+)?(?:new\s+)?project(?:\s+(?:called|named|name)\s+(.+))?$/i);
  if (proj) return { action: 'create_project', params: { name: proj[1] || '', description: '' }, speech: '' };

  // "move login bug to in progress" / "mark it as done"
  const move = t.match(/^(?:move|put|set|change|update)\s+(.+?)\s+(?:to|as|into)\s+(.+)$/);
  if (move && toStatus(move[2])) return { action: 'move_story', params: { story: move[1], status: toStatus(move[2]), project: '' }, speech: '' };
  const mark = t.match(/^mark\s+(.+?)\s+(?:as\s+)?(done|complete|completed|finished)$/);
  if (mark) return { action: 'move_story', params: { story: mark[1], status: 'Done', project: '' }, speech: '' };

  const assign = t.match(/^assign\s+(.+?)\s+to\s+(.+)$/);
  if (assign) return { action: 'assign_story', params: { story: assign[1], person: assign[2], project: '' }, speech: '' };

  if (/\b(briefing|catch me up|what('s| is) (up|new|happening)( today)?|my day|good morning)\b/.test(t)) return { action: 'briefing', params: {}, speech: '' };
  if (/\b(overdue|past due|behind schedule)\b/.test(t)) return { action: 'overdue', params: {}, speech: '' };
  if (/\bsprint\b.*\b(status|progress|going|doing)\b|\bhow('s| is| are)\b.*\bsprint\b/.test(t)) return { action: 'sprint_status', params: { project: '' }, speech: '' };
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

// a soft "go ahead" chime so you know when she is listening again
let audioCtx = null;
const chime = () => {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = audioCtx || new AC();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.08, audioCtx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.18);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + 0.2);
  } catch { /* ignore */ }
};

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
  const [hearing, setHearing] = useState('');

  const enabledRef = useRef(false);
  const recogRef = useRef(null);
  const awakeRef = useRef(false);
  const awakeTimer = useRef(null);
  const pendingTimer = useRef(null);
  const resumeTimer = useRef(null);
  const busyRef = useRef(false);
  const speakingRef = useRef(false);
  const ignoreUntil = useRef(0);
  const pendingRef = useRef(null);
  const queueRef = useRef(null);
  const slotRef = useRef(null); // she asked a question and is waiting for the answer
  const slotTimer = useRef(null);
  const lastSpokenRef = useRef('');
  const lastStoryRef = useRef(null); // { _id, title, project } for "move it to done"
  const projectsRef = useRef(null);
  const heardRef = useRef(null);
  const resumeRef = useRef(null);
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
  // The mic is switched off while she talks, so she can never hear (and obey) her own voice.
  const speak = useCallback((text) => new Promise((resolve) => {
    addLine('salina', text);
    lastSpokenRef.current = norm(text);
    const synth = window.speechSynthesis;
    if (!synth) return resolve();

    clearTimeout(resumeTimer.current);
    const r = recogRef.current;
    recogRef.current = null;
    try { r?.abort(); } catch { /* ignore */ }

    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = 'en-US'; }
    u.rate = 1.03;
    u.pitch = 1.12;

    speakingRef.current = true;
    setPhase('speaking');
    setHearing('');

    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      speakingRef.current = false;
      ignoreUntil.current = Date.now() + 300;
      resumeTimer.current = setTimeout(() => resumeRef.current?.(), 200);
      resolve();
    };
    u.onend = done;
    u.onerror = done;
    setTimeout(done, Math.max(4000, text.length * 95)); // some browsers never fire onend
    synth.speak(u);
  }), [addLine]);

  const finish = () => {
    setPhase(enabledRef.current ? (awakeRef.current ? 'awake' : 'idle') : 'off');
  };

  const closeWindow = () => {
    awakeRef.current = false;
    clearTimeout(awakeTimer.current);
    finish();
  };

  const openWindow = () => {
    awakeRef.current = true;
    setPhase('awake');
    clearTimeout(awakeTimer.current);
    awakeTimer.current = setTimeout(() => {
      awakeRef.current = false;
      setPhase(enabledRef.current ? 'idle' : 'off');
    }, WINDOW_MS);
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
  };

  const loadStories = async (p) => {
    const { data } = await api.get('/backlog', { params: { project: p._id } });
    return (data.stories || []).map((s) => ({ ...s, projectName: p.name }));
  };

  const loadAllStories = async () => {
    const projects = await getProjects();
    const lists = await Promise.all(projects.map((p) => loadStories(p).catch(() => [])));
    return lists.flat();
  };

  // find a story by the words you said ("login bug") or by "it" (the last one we talked about)
  const pickStory = async (query, p) => {
    const q = String(query || '').trim();
    if ((!q || IT_RE.test(q)) && lastStoryRef.current) return lastStoryRef.current;
    if (!q || IT_RE.test(q)) {
      await speak('Which story do you mean?');
      return null;
    }
    const words = norm(q).split(' ').filter((w) => w.length > 1 && !STOP_WORDS.includes(w));
    if (!words.length) { await speak('Which story do you mean?'); return null; }
    const stories = await loadStories(p);
    const scored = stories
      .map((s) => {
        const t = norm(s.title);
        return { s, score: words.filter((w) => t.includes(w)).length / words.length };
      })
      .filter((x) => x.score >= 0.6)
      .sort((a, b) => b.score - a.score);
    if (!scored.length) { await speak(`I couldn't find a story matching ${q} in ${p.name}.`); return null; }
    if (scored.length > 1 && scored[0].score === scored[1].score) {
      await speak(`I found two matches: ${scored[0].s.title}, and ${scored[1].s.title}. Which one?`);
      return null;
    }
    return scored[0].s;
  };

  const remember = (s, projectId) => {
    lastStoryRef.current = { _id: s._id, title: s.title, project: s.project || projectId };
  };

  const askConfirm = async (prompt, run) => {
    await speak(prompt);
    pendingRef.current = { run };
    clearTimeout(pendingTimer.current);
    pendingTimer.current = setTimeout(() => { pendingRef.current = null; finish(); }, 15000);
  };

  // ask a question and treat your next sentence as the answer (e.g. "what should it be called?")
  const askSlot = async (prompt, fill) => {
    await speak(prompt);
    slotRef.current = { fill };
    clearTimeout(slotTimer.current);
    slotTimer.current = setTimeout(() => { slotRef.current = null; }, 20000);
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
        return;
      }

      case 'create_story': {
        if (!params.title) {
          await askSlot('What should the story be called?', (answer) => execute({ ...plan, params: { ...params, title: answer.slice(0, 140) } }));
          return;
        }
        const p = await resolveProject(params.project);
        if (!p) { await askWhichProject(); return; }
        try {
          const { data } = await api.post('/backlog', {
            project: p._id,
            title: params.title,
            description: params.description || '',
            priority: ['Low', 'Medium', 'High', 'Critical'].includes(params.priority) ? params.priority : 'Medium',
          });
          if (data?.story) remember(data.story, p._id);
          toast.success(`Story added to ${p.name}`);
          await speak(plan.speech || `Done. I added "${params.title}" to the ${p.name} backlog.`);
        } catch (err) {
          await speak(failSpeech(err, "I couldn't add that story."));
        }
        return;
      }

      case 'create_project': {
        const name = (params.name || '').trim();
        if (!name) {
          await askSlot('Sure. What should the project be called?', (answer) => execute({ ...plan, params: { ...params, name: answer.slice(0, 80) } }));
          return;
        }
        try {
          await api.post('/projects', { name, description: params.description || '' });
          projectsRef.current = null; // reload the project list next time
          toast.success(`Project "${name}" created`);
          await speak(`Done. I created the project ${name}. You'll find it in your Projects list.`);
        } catch (err) {
          await speak(failSpeech(err, "I couldn't create that project."));
        }
        return;
      }

      case 'move_story': {
        const status = toStatus(params.status);
        if (!status) { await speak('Which column should I move it to? For example, In Progress or Done.'); return; }
        const p = await resolveProject(params.project);
        if (!p && !(IT_RE.test(params.story || '') && lastStoryRef.current)) { await askWhichProject(); return; }
        const story = await pickStory(params.story, p);
        if (!story) return;
        try {
          await api.put(`/backlog/${story._id}`, { status }, { params: { project: story.project || p._id } });
          remember(story, p?._id);
          toast.success(`Moved to ${status}`);
          await speak(`Done. "${story.title}" is now ${status}.`);
        } catch (err) {
          await speak(failSpeech(err, "I couldn't move that story."));
        }
        return;
      }

      case 'assign_story': {
        const p = await resolveProject(params.project);
        if (!p && !(IT_RE.test(params.story || '') && lastStoryRef.current)) { await askWhichProject(); return; }
        const project = p || (await getProjects()).find((x) => x._id === lastStoryRef.current?.project);
        const person = norm(params.person || '');
        if (!person) { await speak('Who should I assign it to?'); return; }
        let target = null;
        if (['me', 'myself', 'i'].includes(person)) {
          target = { _id: user?.id || user?._id, name: 'you' };
        } else {
          const member = (project?.members || []).find((m) => {
            const n = norm(m.user?.name || '');
            return n && (n.includes(person) || person.includes(n.split(' ')[0]));
          });
          if (member) target = member.user;
        }
        if (!target) { await speak(`I couldn't find ${params.person} on that project.`); return; }
        const story = await pickStory(params.story, project);
        if (!story) return;
        try {
          await api.put(`/backlog/${story._id}`, { assignee: target._id }, { params: { project: story.project || project._id } });
          remember(story, project?._id);
          toast.success(`Assigned to ${target.name}`);
          await speak(`Done. "${story.title}" is assigned to ${target.name === 'you' ? 'you' : target.name.split(' ')[0]}.`);
        } catch (err) {
          await speak(failSpeech(err, "I couldn't assign that story."));
        }
        return;
      }

      case 'my_work': {
        const myId = user?.id || user?._id;
        const mine = (await loadAllStories())
          .filter((s) => s.status !== 'Done' && (s.assignee?._id === myId || s.assignee === myId))
          .sort((a, b) => (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0));
        if (!mine.length) {
          await speak("You've got nothing assigned right now. Nice and clear.");
        } else {
          remember(mine[0]);
          const top = mine.slice(0, 3).map((s) => s.title.slice(0, 60)).join(', ');
          await speak(`You have ${mine.length} open ${mine.length === 1 ? 'story' : 'stories'}. The top ${Math.min(3, mine.length) === 1 ? 'one is' : 'ones are'}: ${top}.`);
        }
        return;
      }

      case 'overdue': {
        const now = Date.now();
        const late = (await loadAllStories())
          .filter((s) => s.status !== 'Done' && s.dueDate && new Date(s.dueDate).getTime() < now)
          .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
        if (!late.length) await speak('Nothing is overdue. Great job.');
        else {
          remember(late[0]);
          await speak(`${late.length} ${late.length === 1 ? 'story is' : 'stories are'} overdue. The oldest ${Math.min(3, late.length) === 1 ? 'is' : 'are'}: ${late.slice(0, 3).map((s) => s.title.slice(0, 50)).join(', ')}.`);
        }
        return;
      }

      case 'sprint_status': {
        const p = await resolveProject(params.project);
        if (!p) { await askWhichProject(); return; }
        const [{ data }, stories] = await Promise.all([api.get('/sprints', { params: { project: p._id } }), loadStories(p)]);
        const sprint = (data.sprints || []).find((x) => x.status === 'Active');
        if (!sprint) { await speak(`There's no active sprint in ${p.name} right now.`); return; }
        const inSprint = stories.filter((s) => (s.sprint?._id || s.sprint) === sprint._id);
        const done = inSprint.filter((s) => s.status === 'Done');
        const pts = (list) => list.reduce((sum, s) => sum + (s.storyPoints || 0), 0);
        const daysLeft = Math.ceil((new Date(sprint.endDate) - Date.now()) / 86400000);
        const left = daysLeft > 0 ? `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left` : daysLeft === 0 ? 'it ends today' : `it ended ${Math.abs(daysLeft)} days ago`;
        await speak(`${sprint.name} has ${done.length} of ${inSprint.length} stories done${pts(inSprint) ? `, that's ${pts(done)} of ${pts(inSprint)} points` : ''}, and ${left}.`);
        return;
      }

      case 'briefing': {
        const myId = user?.id || user?._id;
        const hour = new Date().getHours();
        const part = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
        const [all, notif] = await Promise.all([
          loadAllStories().catch(() => []),
          api.get('/notifications').then((r) => r.data.notifications || []).catch(() => []),
        ]);
        const mine = all.filter((s) => s.status !== 'Done' && (s.assignee?._id === myId || s.assignee === myId));
        const high = mine.filter((s) => ['High', 'Critical'].includes(s.priority)).length;
        const late = all.filter((s) => s.status !== 'Done' && s.dueDate && new Date(s.dueDate).getTime() < Date.now()).length;
        const unread = notif.filter((n) => !n.read).length;
        let site = '';
        const p = await resolveProject('');
        if (p) {
          const h = await api.get(`/devops/${p._id}/health`).then((r) => r.data).catch(() => null);
          if (h?.configured) site = h.up ? ` ${p.name} is up and running.` : ` Heads up, ${p.name} looks down.`;
        }
        await speak(
          `Good ${part}, ${firstName()}. You have ${mine.length} open ${mine.length === 1 ? 'story' : 'stories'}${high ? `, ${high} high priority` : ''}.` +
          `${late ? ` ${late} ${late === 1 ? 'is' : 'are'} overdue.` : ''}` +
          ` ${unread ? `And ${unread} unread ${unread === 1 ? 'notification' : 'notifications'}.` : 'Notifications are clear.'}${site}`
        );
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
        if (!params.title && !params.message) {
          await askSlot('What should the announcement say?', (answer) => execute({ ...plan, params: { ...params, title: answer.slice(0, 60), message: answer } }));
          return;
        }
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
    }
  };

  const drainQueue = () => {
    const q = queueRef.current;
    queueRef.current = null;
    if (q) setTimeout(() => heardRef.current?.(q, true), 150);
  };

  const runCommand = async (text) => {
    busyRef.current = true;
    clearTimeout(awakeTimer.current); // stay awake while working
    awakeRef.current = true;
    setPhase('thinking');
    addLine('you', text);
    let dismissed = false;
    try {
      let plan = parseLocal(text);
      if (!plan) {
        try {
          const { data } = await api.post('/ai/salina', { text, path: pathRef.current, lastStory: lastStoryRef.current?.title || '' });
          plan = data;
        } catch (e) {
          const msg = String(e?.response?.data?.error || '');
          await speak(
            !e?.response
              ? "I can't reach the server right now. It may be waking up, so try again in a few seconds."
              : msg.includes('GROQ_API_KEY')
                ? "My AI key isn't set on the server yet, so I can only do quick commands like opening pages."
                : 'My AI side had a hiccup. Try again in a moment. Quick commands like opening pages still work.'
          );
          return;
        }
      }
      dismissed = plan.action === 'dismiss';
      await execute(plan);
    } catch (err) {
      await speak(failSpeech(err, 'Something went wrong on my side. Try again?'));
    } finally {
      busyRef.current = false;
      if (dismissed) closeWindow();
      else openWindow(); // conversation mode: you can give the next command straight away
      drainQueue();
    }
  };

  const wake = async () => {
    busyRef.current = true;
    try {
      await speak(`Hi ${firstName()}, how can I help you?`);
    } finally {
      busyRef.current = false;
      openWindow();
      drainQueue();
    }
  };

  const isEcho = (text) => {
    const t = norm(text);
    return t.length > 6 && lastSpokenRef.current.includes(t);
  };

  // every sentence the mic hears (or the user types) comes through here
  const handleHeard = async (raw, forced = false) => {
    const text = raw.trim();
    if (!text) return;

    if (!forced) {
      if (speakingRef.current || Date.now() < ignoreUntil.current) return;
      if (isEcho(text)) return;
    }

    // I'm busy: keep the latest thing you said and handle it right after
    if (busyRef.current) {
      if (forced || awakeRef.current || WAKE_RE.test(text)) queueRef.current = text;
      return;
    }

    const stripWake = (s) => s.replace(WAKE_RE, '').replace(/^[\s,.:;!?-]+/, '').trim();

    // she asked a question ("what should it be called?") and this is the answer
    if (slotRef.current && !pendingRef.current) {
      const { fill } = slotRef.current;
      slotRef.current = null;
      clearTimeout(slotTimer.current);
      const answer = stripWake(text) || text;
      addLine('you', text);
      busyRef.current = true;
      try {
        if (/^(cancel|never mind|nevermind|forget it|stop)$/i.test(norm(answer))) await speak('Okay, cancelled.');
        else await fill(answer);
      } catch (err) {
        await speak(failSpeech(err, 'Something went wrong on my side.'));
      } finally {
        busyRef.current = false;
        openWindow();
        drainQueue();
      }
      return;
    }

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
        openWindow();
        drainQueue();
      }
      return;
    }

    // conversation is open (she just greeted or answered) or the user typed it
    if (awakeRef.current || forced) {
      const cmd = stripWake(text);
      if (!cmd && WAKE_RE.test(text)) { await wake(); return; } // just "Salina" again
      await runCommand(cmd || text);
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
    clearTimeout(resumeTimer.current);
    clearTimeout(slotTimer.current);
    awakeRef.current = false;
    pendingRef.current = null;
    slotRef.current = null;
    queueRef.current = null;
    speakingRef.current = false;
    setHearing('');
  }, []);

  const startRecognition = useCallback(() => {
    if (!SR || recogRef.current) return;
    const r = new SR();
    r.continuous = true;
    r.interimResults = true; // only used to show what she is hearing; commands run on final results
    r.lang = /^en/i.test(navigator.language || '') ? navigator.language : 'en-US';

    r.onstart = () => {
      // she just finished talking and is listening again: soft chime
      if (awakeRef.current && !busyRef.current && !pendingRef.current) chime();
    };
    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript.trim();
        if (!e.results[i].isFinal) { interim = text; continue; }
        setHearing('');
        if (text) heardRef.current?.(text);
      }
      if (interim && !speakingRef.current) setHearing(interim);
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        toast.error('Microphone permission is blocked. Allow it in the browser address bar, then turn Salina on again.');
        setEnabled(false);
      }
    };
    r.onend = () => {
      if (recogRef.current !== r) return; // replaced or paused on purpose
      recogRef.current = null;
      if (!enabledRef.current || speakingRef.current) return;
      // the browser ends sessions every so often - restart, but give up if it keeps dying instantly
      quickEnds.current = Date.now() - lastStart.current < 800 ? quickEnds.current + 1 : 0;
      if (quickEnds.current >= 6) {
        toast.error('Voice service is not available right now.');
        setEnabled(false);
        return;
      }
      setTimeout(() => { if (enabledRef.current && !speakingRef.current) startRecognition(); }, 300);
    };

    recogRef.current = r;
    lastStart.current = Date.now();
    try { r.start(); } catch { recogRef.current = null; }
  }, []);

  resumeRef.current = () => {
    if (enabledRef.current && SR && !recogRef.current && !speakingRef.current) startRecognition();
  };

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

  const stopSpeaking = () => window.speechSynthesis?.cancel();

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
              {phase === 'speaking' && (
                <button onClick={stopSpeaking} className="btn-ghost px-2 py-1.5" title="Stop talking" aria-label="Stop talking"><VolumeX size={14} /></button>
              )}
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
                  ? 'Turn voice on, then say "Salina". Try: "open DevOps", "give me my briefing", "move login bug to done", "how is the sprint going".'
                  : 'Voice needs Chrome or Edge. You can still type commands below.'}
              </p>
            ) : (
              log.map((l, i) => (
                <p key={i} className={l.who === 'you' ? 'text-right text-ink-300' : 'text-primary-light'}>
                  {l.text}
                </p>
              ))
            )}
            {hearing && <p className="text-right text-xs italic text-ink-500">hearing: {hearing}</p>}
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
