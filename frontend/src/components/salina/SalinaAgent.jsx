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
  backlog: 'backlog', 'product backlog': 'backlog', sprint: 'sprints', sprints: 'sprints', board: 'board', kanban: 'board', analytics: 'analytics',
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
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
const ROLES = ['Admin', 'Scrum Master', 'Developer', 'Tester', 'Product Owner'];
const ENVIRONMENTS = ['Development', 'Testing', 'Production'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const RETRO_LABELS = { wentWell: 'what went well', toImprove: 'what to improve', actionItems: 'action items' };
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

  // compound requests ("... and then ...") always go to the AI so every step is planned
  if (/\b(and then|then|after that|and also|also)\b/.test(t)) return null;

  if (/^(stop|cancel|quiet|be quiet|never mind|nevermind|that's all|thats all|that is all|i'm done|im done|goodbye|bye)$/.test(t) || /^(thank you|thanks)/.test(t)) {
    return { action: 'dismiss', params: {}, speech: 'Anytime!' };
  }

  const nav = t.match(/^(?:(?:open|go to|show me|show|take me to|navigate to|launch)\s+)?(?:the\s+|my\s+)?(dashboard|home|overview|projects?|product backlog|backlog|sprints?|board|kanban|analytics|devops|dev ops|team|ai assistant|assistant|profile|admin)(?:\s+(?:of|for|in)\s+(.+))?$/);
  if (nav) {
    const label = nav[1] === 'dev ops' ? 'DevOps' : nav[1];
    return { action: 'navigate', params: { target: TARGETS[nav[1]], project: nav[2] || '' }, speech: `Sure, opening ${label}.` };
  }

  const orig = text.replace(/[.,!?]/g, ' ').replace(/\s+/g, ' ').trim(); // keeps the capitals you said
  const proj = orig.match(/^(?:create|make|start|add|set up)\s+(?:a\s+|an\s+|one\s+)?(?:new\s+)?project(?:\s+(?:called|named|name)\s+(.+))?$/i);
  if (proj && !/\b(and|with|then)\b/i.test(proj[1] || '')) return { action: 'create_project', params: { name: proj[1] || '', description: '' }, speech: '' };

  // "move login bug to in progress" / "mark it as done"
  const move = t.match(/^(?:move|put|set|change|update)\s+(.+?)\s+(?:to|as|into)\s+(.+)$/);
  if (move && toStatus(move[2]) && !/\band\b/.test(move[1])) return { action: 'move_story', params: { story: move[1], status: toStatus(move[2]), project: '' }, speech: '' };
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
  const { user, refreshSession } = useAuth();
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
  const lastProjectRef = useRef(null); // the project we are working in
  const sprintsRef = useRef([]);
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
  const myId = () => user?.id || user?._id;
  const isAdmin = () => user?.systemRole === 'admin';
  const say = async (msg) => { await speak(msg); return true; };
  const no = async (msg) => { await speak(msg); return false; };
  const pid = (story, p) => story.project || p._id;

  const getProjects = async (force = false) => {
    if (projectsRef.current && !force) return projectsRef.current;
    const { data } = await api.get('/projects');
    projectsRef.current = data.projects || [];
    return projectsRef.current;
  };

  const resolveProject = async (hint) => {
    const projects = await getProjects();
    let h = norm(hint);
    if (/^(this|current|the|it|here|my|this project|current project|the project|my project)$/.test(h)) h = '';
    const setLast = (p) => { lastProjectRef.current = p; return p; };
    if (h) {
      const found = projects.find((p) => { const n = norm(p.name); return n === h || n.includes(h) || h.includes(n); });
      return found ? setLast(found) : null;
    }
    const m = pathRef.current.match(/projects\/([a-f0-9]{24})/);
    if (m) { const f = projects.find((p) => p._id === m[1]); if (f) return setLast(f); }
    if (lastProjectRef.current) { const f = projects.find((p) => p._id === lastProjectRef.current._id); if (f) return f; }
    if (projects.length === 1) return setLast(projects[0]);
    return null;
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

  const remember = (s, projectId) => {
    lastStoryRef.current = { _id: s._id, title: s.title, project: s.project || projectId };
  };

  const scoreStories = (stories, words) =>
    stories
      .map((s) => ({ s, score: words.filter((w) => norm(s.title).includes(w)) .length / words.length }))
      .filter((x) => x.score >= 0.6)
      .sort((x, y) => y.score - x.score);

  // find a story by the words you said ("login bug") or by "it" (the last one we talked about).
  // If it is not in the current project, look in your other projects too.
  const pickStory = async (query, p, searchAll = false) => {
    const q = String(query || '').trim();
    if (IT_RE.test(q) && lastStoryRef.current) return { story: lastStoryRef.current };
    const words = norm(q).split(' ').filter((w) => w.length > 1 && !STOP_WORDS.includes(w));
    if (!words.length) return { error: 'Which story do you mean?', ask: true };
    let scored = scoreStories(await loadStories(p), words);
    let owner = p;
    if (!scored.length && searchAll) {
      const projects = await getProjects();
      const lists = await Promise.all(projects.filter((x) => x._id !== p._id).map((x) => loadStories(x).catch(() => [])));
      scored = scoreStories(lists.flat(), words);
      if (scored.length) owner = projects.find((x) => x._id === scored[0].s.project) || p;
    }
    if (!scored.length) return { error: `I couldn't find a story matching ${q} in ${p.name}.` };
    if (scored.length > 1 && scored[0].score === scored[1].score) {
      return { error: `I found two matches: ${scored[0].s.title}, and ${scored[1].s.title}. Which one?`, ask: true };
    }
    return { story: scored[0].s, project: owner };
  };

  const findMember = (p, name) => {
    const q = norm(name);
    if (!q) return null;
    const people = (p.members || []).map((m) => m.user).filter(Boolean);
    if (['me', 'myself', 'i'].includes(q)) return people.find((u) => u._id === myId()) || { _id: myId(), name: user?.name || 'you' };
    return people.find((u) => { const n = norm(u.name); return n && (n.includes(q) || q.includes(n.split(' ')[0])); }) || null;
  };

  const findUserByText = async (text) => {
    let q = String(text || '').toLowerCase().trim().replace(/\s+at\s+/g, '@').replace(/\s+dot\s+/g, '.');
    if (q.includes('@')) q = q.replace(/\s+/g, '');
    const { data } = await api.get('/users/search', { params: { q: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') } });
    return data.users || [];
  };

  const pickSprint = async (text, p, prefer = 'Active') => {
    const { data } = await api.get('/sprints', { params: { project: p._id } });
    const sprints = data.sprints || [];
    sprintsRef.current = sprints;
    if (!sprints.length) { await speak(`There are no sprints in ${p.name} yet.`); return null; }
    const q = norm(text);
    if (q && !/^(active|current|this|this sprint|current sprint|the active sprint|next|upcoming|planned|latest|new)$/.test(q)) {
      const byName = sprints.find((s) => norm(s.name).includes(q) || q.includes(norm(s.name)));
      const num = q.match(/\d+/)?.[0];
      const byNum = num && sprints.find((s) => (norm(s.name).match(/\d+/) || [])[0] === num);
      if (byName || byNum) return byName || byNum;
      await speak(`I couldn't find a sprint called ${text}.`);
      return null;
    }
    const want = /^(next|upcoming|planned|new|latest)$/.test(q) ? 'Planned' : prefer;
    const f = sprints.find((s) => s.status === want) || sprints.find((s) => s.status === 'Active') || sprints.find((s) => s.status === 'Planned');
    if (!f) { await speak('I could not find a suitable sprint.'); return null; }
    return f;
  };

  /* ------------------------------ ask / confirm / run steps ------------------------------ */
  // ask a question and treat your next sentence as the answer
  const askSlot = async (prompt, fill, rest = []) => {
    await speak(prompt);
    slotRef.current = {
      fill: async (answer) => {
        const r = await fill(answer);
        if (r === true) await runSteps(rest);
      },
    };
    clearTimeout(slotTimer.current);
    slotTimer.current = setTimeout(() => { slotRef.current = null; }, 20000);
    return 'wait';
  };

  // ask for a spoken yes / no before something risky
  const askConfirm = async (prompt, run, rest = []) => {
    await speak(prompt);
    pendingRef.current = {
      run: async () => {
        let r = false;
        try { r = await run(); } catch (err) { await speak(failSpeech(err, 'That did not work.')); }
        if (r === true) await runSteps(rest);
      },
    };
    clearTimeout(pendingTimer.current);
    pendingTimer.current = setTimeout(() => { pendingRef.current = null; finish(); }, 15000);
    return 'wait';
  };

  const withProject = async (plan, rest, fn) => {
    const projects = await getProjects();
    let p = await resolveProject(plan.params?.project);
    if (!p && !plan.params?.project && IT_RE.test(plan.params?.story || '') && lastStoryRef.current?.project) {
      p = projects.find((x) => x._id === lastStoryRef.current.project) || null;
    }
    if (p) return fn(p);
    if (!projects.length) return no("You don't have any projects yet. Say create a new project to make one.");
    if (plan._asked) return no("Sorry, I couldn't find that project.");
    const names = projects.slice(0, 4).map((x) => x.name).join(', ');
    return askSlot(
      `Which project do you mean? You have ${names}.`,
      (answer) => execute({ ...plan, _asked: true, params: { ...plan.params, project: answer } }, rest),
      rest
    );
  };

  const withStory = async (plan, rest, p, fn) => {
    const r = await pickStory(plan.params?.story, p, !plan.params?.project);
    if (r.story) return fn(r.story, r.project || p);
    if (r.ask && !plan._askedStory) {
      return askSlot(r.error, (a) => execute({ ...plan, _askedStory: true, params: { ...plan.params, story: a } }, rest), rest);
    }
    return no(r.error);
  };

  const runSteps = async (steps) => {
    for (let i = 0; i < steps.length; i++) {
      const r = await execute(steps[i], steps.slice(i + 1));
      if (r !== true) return r;
    }
    return true;
  };

  const execute = async (plan, rest = []) => {
    try {
      return await perform(plan, rest);
    } catch (err) {
      return no(failSpeech(err, 'Something went wrong on my side.'));
    }
  };

  /* ------------------------------ the actions ------------------------------ */
  const perform = async (plan, rest) => {
    const params = plan.params || {};
    const P = (fn) => withProject(plan, rest, fn);
    const ST = (fn) => P((p) => withStory(plan, rest, p, (story, owner) => fn(owner, story)));
    const confirm = (prompt, run) => askConfirm(prompt, run, rest);
    const ask = (prompt, key, max = 140) =>
      askSlot(prompt, (a) => execute({ ...plan, params: { ...params, [key]: a.slice(0, max) } }, rest), rest);
    const refreshProjects = () => getProjects(true).catch(() => null);

    switch (plan.action) {
      case 'dismiss':
        return say(plan.speech || 'Anytime!');

      /* ---------- pages ---------- */
      case 'navigate': {
        const t = params.target;
        const base = { dashboard: '/dashboard', projects: '/dashboard/projects', ai: '/dashboard/ai-assistant', profile: '/dashboard/profile', admin: '/dashboard/admin' };
        if (t === 'admin' && !isAdmin()) return no('Only admins can open the admin panel.');
        if (base[t]) { await speak('Sure.'); navigate(base[t]); return true; }
        if (['backlog', 'sprints', 'board', 'analytics', 'devops', 'team'].includes(t)) {
          return P(async (p) => {
            await speak(`Opening ${t === 'devops' ? 'DevOps' : t} for ${p.name}.`);
            navigate(`/dashboard/projects/${p._id}/${t}`);
            return true;
          });
        }
        if (plan._asked) return no("Sorry, I don't know that page.");
        return askSlot('Which page should I open?', (a) => execute({ ...plan, _asked: true, params: { ...params, target: TARGETS[norm(a)] || '' } }, rest), rest);
      }

      /* ---------- projects ---------- */
      case 'create_project': {
        const name = (params.name || '').trim();
        if (!name) return ask('Sure. What should the project be called?', 'name', 80);
        const { data } = await api.post('/projects', { name, description: params.description || '' });
        const list = await refreshProjects();
        lastProjectRef.current = list?.find((x) => x._id === data.project?._id) || data.project || null;
        toast.success(`Project "${name}" created`);
        return say(`Done. I created the project ${name}. You'll find it in your Projects list.`);
      }

      case 'rename_project':
        if (!params.name) return ask('What should the new name be?', 'name', 80);
        return P(async (p) => {
          await api.put(`/projects/${p._id}`, { name: params.name, description: p.description || '', githubRepo: p.githubRepo || '', status: p.status });
          await refreshProjects();
          return say(`Done. ${p.name} is now called ${params.name}.`);
        });

      case 'archive_project':
        return P((p) => confirm(`Archive ${p.name}? It will leave your active projects. Are you sure?`, async () => {
          await api.put(`/projects/${p._id}`, { name: p.name, description: p.description || '', githubRepo: p.githubRepo || '', status: 'archived' });
          await refreshProjects();
          return say(`Done. ${p.name} is archived.`);
        }));

      case 'delete_project':
        return P((p) => confirm(`This permanently deletes ${p.name} and everything in it. Are you absolutely sure?`, async () => {
          await api.delete(`/projects/${p._id}`);
          lastProjectRef.current = null;
          lastStoryRef.current = null;
          await refreshProjects();
          if (pathRef.current.includes(p._id)) navigate('/dashboard/projects');
          return say(`Done. ${p.name} has been deleted.`);
        }));

      case 'list_projects': {
        const projects = await getProjects(true);
        if (!projects.length) return say("You don't have any projects yet. Want me to create one?");
        return say(`You have ${projects.length} ${projects.length === 1 ? 'project' : 'projects'}: ${projects.slice(0, 6).map((p) => p.name).join(', ')}.`);
      }

      case 'set_repo': {
        if (!params.repo) return ask('Which GitHub repository? Say it as owner slash repo.', 'repo', 100);
        const repo = String(params.repo).replace(/\s+slash\s+/gi, '/').replace(/\s+/g, '');
        return P(async (p) => {
          await api.put(`/devops/${p._id}/repo`, { githubRepo: repo });
          await refreshProjects();
          return say(`Done. ${p.name} is connected to ${repo}.`);
        });
      }

      case 'set_live_url': {
        if (!params.url) return ask("What's the live website address?", 'url', 140);
        let u = String(params.url).toLowerCase().replace(/\s+dot\s+/g, '.').replace(/\s+slash\s+/g, '/').replace(/\s+/g, '');
        if (!/^https?:\/\//.test(u)) u = `https://${u}`;
        return P(async (p) => {
          await api.put(`/devops/${p._id}/config`, { liveUrl: u });
          await refreshProjects();
          return say(`Done. I will watch ${u} for ${p.name}.`);
        });
      }

      /* ---------- team ---------- */
      case 'list_team':
        return P((p) => {
          const m = (p.members || []).filter((x) => x.user);
          return say(`${p.name} has ${m.length} ${m.length === 1 ? 'person' : 'people'}: ${m.slice(0, 6).map((x) => `${x.user.name.split(' ')[0]} as ${x.role}`).join(', ')}.`);
        });

      case 'invite_member': {
        if (!params.person) return ask('Who should I invite? Say their name or email.', 'person', 100);
        return P(async (p) => {
          const users = await findUserByText(params.person);
          if (!users.length) return no(`I couldn't find anyone called ${params.person}. They need to sign up first.`);
          const wanted = norm(params.person);
          let target = users.length === 1 ? users[0] : users.find((u) => norm(u.name) === wanted || u.email.toLowerCase() === params.person.toLowerCase());
          if (!target) {
            if (plan._asked) return no('There are several people with that name. Please add them from the Team page.');
            return askSlot(`I found ${users.slice(0, 3).map((u) => u.name).join(', ')}. Which one? Say the full name.`, (a) => execute({ ...plan, _asked: true, params: { ...params, person: a } }, rest), rest);
          }
          const role = ROLES.includes(params.role) ? params.role : 'Developer';
          await api.post(`/projects/${p._id}/invite`, { email: target.email, role });
          await refreshProjects();
          return say(`Done. I added ${target.name} to ${p.name} as ${role}.`);
        });
      }

      case 'change_role': {
        if (!params.person) return ask('Whose role should I change?', 'person', 100);
        if (!ROLES.includes(params.role)) return ask('Which role? For example Developer, Tester, Scrum Master or Product Owner.', 'role', 40);
        return P(async (p) => {
          const m = findMember(p, params.person);
          if (!m) return no(`I couldn't find ${params.person} on ${p.name}.`);
          return confirm(`Change ${m.name.split(' ')[0]} to ${params.role}?`, async () => {
            await api.put(`/projects/${p._id}/members/${m._id}/role`, { role: params.role });
            await refreshProjects();
            return say(`Done. ${m.name.split(' ')[0]} is now ${params.role}.`);
          });
        });
      }

      case 'remove_member': {
        if (!params.person) return ask('Who should I remove?', 'person', 100);
        return P(async (p) => {
          const m = findMember(p, params.person);
          if (!m) return no(`I couldn't find ${params.person} on ${p.name}.`);
          if (m._id === myId()) return no("I won't remove you from your own project.");
          return confirm(`Remove ${m.name.split(' ')[0]} from ${p.name}?`, async () => {
            await api.delete(`/projects/${p._id}/members/${m._id}`);
            await refreshProjects();
            return say(`Done. ${m.name.split(' ')[0]} has been removed.`);
          });
        });
      }

      /* ---------- stories ---------- */
      case 'create_story': {
        if (!params.title) return ask('What should the story be called?', 'title');
        return P(async (p) => {
          const { data } = await api.post('/backlog', {
            project: p._id,
            title: params.title,
            description: params.description || '',
            priority: PRIORITIES.includes(params.priority) ? params.priority : 'Medium',
            ...(params.points ? { storyPoints: params.points } : {}),
          });
          if (data?.story) {
            remember(data.story, p._id);
            if (DATE_RE.test(params.due || '')) {
              await api.put(`/backlog/${data.story._id}`, { dueDate: params.due }, { params: { project: p._id } });
            }
          }
          toast.success(`Story added to ${p.name}`);
          return say(`Done. I added "${params.title}" to the ${p.name} backlog.`);
        });
      }

      case 'update_story':
        return ST(async (p, story) => {
          const body = {};
          if (params.title) body.title = params.title;
          if (params.description) body.description = params.description;
          if (PRIORITIES.includes(params.priority)) body.priority = params.priority;
          if (typeof params.points === 'number') body.storyPoints = params.points;
          if (DATE_RE.test(params.due || '')) body.dueDate = params.due;
          if (!Object.keys(body).length) return no('What should I change on that story?');
          await api.put(`/backlog/${story._id}`, body, { params: { project: pid(story, p) } });
          remember(story, p._id);
          return say(`Updated "${story.title}".`);
        });

      case 'move_story': {
        const status = toStatus(params.status);
        if (!status) return ask('Which column should I move it to? For example In Progress or Done.', 'status', 40);
        return ST(async (p, story) => {
          await api.put(`/backlog/${story._id}`, { status }, { params: { project: pid(story, p) } });
          remember(story, p._id);
          toast.success(`Moved to ${status}`);
          return say(`Done. "${story.title}" is now ${status}.`);
        });
      }

      case 'assign_story': {
        if (!params.person) return ask('Who should I assign it to?', 'person', 60);
        return ST(async (p, story) => {
          const owner = (await getProjects()).find((x) => x._id === pid(story, p)) || p;
          const unassign = /^(nobody|no one|none|unassigned|noone)$/.test(norm(params.person));
          const target = unassign ? null : findMember(owner, params.person);
          if (!unassign && !target) return no(`I couldn't find ${params.person} on that project.`);
          await api.put(`/backlog/${story._id}`, { assignee: target ? target._id : null }, { params: { project: pid(story, p) } });
          remember(story, p._id);
          return say(unassign ? `Done. "${story.title}" is unassigned.` : `Done. "${story.title}" is assigned to ${target._id === myId() ? 'you' : target.name.split(' ')[0]}.`);
        });
      }

      case 'delete_story':
        return ST((p, story) => confirm(`Delete "${story.title}"? This can't be undone. Are you sure?`, async () => {
          await api.delete(`/backlog/${story._id}`, { params: { project: pid(story, p) } });
          if (lastStoryRef.current?._id === story._id) lastStoryRef.current = null;
          return say('Done. The story is deleted.');
        }));

      case 'comment_story': {
        if (!params.text) return ask('What should the comment say?', 'text', 500);
        return ST(async (p, story) => {
          await api.post(`/backlog/${story._id}/comments`, { text: params.text, project: pid(story, p) }, { params: { project: pid(story, p) } });
          remember(story, p._id);
          return say(`Comment added to "${story.title}".`);
        });
      }

      case 'find_stories':
        return P(async (p) => {
          let list = await loadStories(p);
          const words = norm(params.query).split(' ').filter((w) => w.length > 2 && !STOP_WORDS.includes(w));
          if (words.length) list = list.filter((s) => words.some((w) => norm(s.title).includes(w)));
          if (toStatus(params.status)) list = list.filter((s) => s.status === toStatus(params.status));
          if (PRIORITIES.includes(params.priority)) list = list.filter((s) => s.priority === params.priority);
          if (params.person) {
            const m = findMember(p, params.person);
            list = m ? list.filter((s) => (s.assignee?._id || s.assignee) === m._id) : [];
          }
          if (!list.length) return say('I found no matching stories.');
          remember(list[0], p._id);
          return say(`I found ${list.length}: ${list.slice(0, 3).map((s) => `${s.title.slice(0, 50)}, ${s.status}`).join('; ')}.`);
        });

      case 'story_details':
        return ST(async (p, story) => {
          const full = (await loadStories(p)).find((s) => s._id === story._id) || story;
          remember(full, p._id);
          const due = full.dueDate ? `, due ${new Date(full.dueDate).toLocaleDateString()}` : '';
          return say(`${full.title}. It's ${full.status}, ${full.priority || 'Medium'} priority, ${full.storyPoints || 0} points, ${full.assignee?.name ? `assigned to ${full.assignee.name.split(' ')[0]}` : 'unassigned'}${due}.`);
        });

      case 'generate_stories': {
        if (!params.topic) return ask('What should the stories be about?', 'topic', 300);
        return P(async (p) => {
          await speak('On it. Give me a moment.');
          const count = Math.min(5, Math.max(1, params.count || 3));
          const { data } = await api.post('/ai/generate-stories', { project: p.name, featureDescription: params.topic, count });
          const stories = (data.stories || []).slice(0, count);
          if (!stories.length) return no("I couldn't come up with stories for that. Try describing it differently.");
          const created = await Promise.all(
            stories.map((s) =>
              api.post('/backlog', {
                project: p._id,
                title: s.title,
                description: s.userStory || s.description || '',
                acceptanceCriteria: s.acceptanceCriteria || [],
                storyPoints: Number(s.storyPoints) || 0,
                priority: PRIORITIES.includes(s.priority) ? s.priority : 'Medium',
                labels: s.labels || [],
                aiGenerated: true,
              }).then((r) => r.data.story)
            )
          );
          remember(created[0], p._id);
          toast.success(`Added ${created.length} AI-generated stories`);
          return say(`Done. I added ${created.length} ${created.length === 1 ? 'story' : 'stories'} to ${p.name}: ${created.map((s) => s.title.slice(0, 45)).join(', ')}.`);
        });
      }

      case 'estimate_points':
        return ST(async (p, story) => {
          const { data } = await api.post('/ai/estimate-points', { storyText: `${story.title}. ${story.description || ''}` });
          const pts = Number(data.points);
          if (!pts) return no("I couldn't estimate that one.");
          await api.put(`/backlog/${story._id}`, { storyPoints: pts }, { params: { project: pid(story, p) } });
          remember(story, p._id);
          return say(`I'd say ${pts} points${data.complexity ? `, ${String(data.complexity).toLowerCase()} complexity` : ''}. I saved it on the story.`);
        });

      /* ---------- sprints ---------- */
      case 'create_sprint':
        return P(async (p) => {
          const { data } = await api.get('/sprints', { params: { project: p._id } });
          const name = params.name || `Sprint ${(data.sprints || []).length + 1}`;
          const days = params.days || 14;
          await api.post('/sprints', {
            project: p._id,
            name,
            goal: params.goal || '',
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + days * 86400000).toISOString(),
          });
          return say(`Done. ${name} is planned for ${days} days in ${p.name}. Say start the sprint when you're ready.`);
        });

      case 'start_sprint':
        return P(async (p) => {
          const sprint = await pickSprint(params.sprint, p, 'Planned');
          if (!sprint) return false;
          if (sprint.status === 'Active') return say(`${sprint.name} is already active.`);
          if (sprint.status === 'Completed') return no(`${sprint.name} is already completed.`);
          const other = (sprintsRef.current || []).find((s) => s.status === 'Active');
          if (other) return no(`${other.name} is still active. Complete it first.`);
          await api.put(`/sprints/${sprint._id}`, { status: 'Active' }, { params: { project: p._id } });
          return say(`Done. ${sprint.name} is now active. Its stories will show on the board.`);
        });

      case 'complete_sprint':
        return P(async (p) => {
          const sprint = await pickSprint(params.sprint, p, 'Active');
          if (!sprint) return false;
          if (sprint.status !== 'Active') return no(`${sprint.name} isn't active.`);
          const open = (await loadStories(p)).filter((s) => (s.sprint?._id || s.sprint) === sprint._id && s.status !== 'Done').length;
          return confirm(`${sprint.name} has ${open} unfinished ${open === 1 ? 'story' : 'stories'}. Complete it anyway?`, async () => {
            await api.put(`/sprints/${sprint._id}`, { status: 'Completed' }, { params: { project: p._id } });
            return say(`Done. ${sprint.name} is completed.`);
          });
        });

      case 'add_to_sprint':
        return ST(async (p, story) => {
          const sprint = await pickSprint(params.sprint, p, 'Active');
          if (!sprint) return false;
          if (sprint.status === 'Completed') return no(`${sprint.name} is already completed.`);
          await api.put(`/backlog/${story._id}/assign-sprint`, { sprintId: sprint._id }, { params: { project: pid(story, p) } });
          remember(story, p._id);
          return say(`Done. "${story.title}" is in ${sprint.name}.`);
        });

      case 'remove_from_sprint':
        return ST(async (p, story) => {
          await api.put(`/backlog/${story._id}/unassign-sprint`, {}, { params: { project: pid(story, p) } });
          remember(story, p._id);
          return say(`Done. "${story.title}" is back in the backlog.`);
        });

      case 'sprint_status':
        return P(async (p) => {
          const [{ data }, stories] = await Promise.all([api.get('/sprints', { params: { project: p._id } }), loadStories(p)]);
          const sprint = (data.sprints || []).find((x) => x.status === 'Active');
          if (!sprint) return say(`There's no active sprint in ${p.name} right now.`);
          const inSprint = stories.filter((s) => (s.sprint?._id || s.sprint) === sprint._id);
          const done = inSprint.filter((s) => s.status === 'Done');
          const pts = (list) => list.reduce((sum, s) => sum + (s.storyPoints || 0), 0);
          const daysLeft = Math.ceil((new Date(sprint.endDate) - Date.now()) / 86400000);
          const left = daysLeft > 0 ? `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left` : daysLeft === 0 ? 'it ends today' : `it ended ${Math.abs(daysLeft)} days ago`;
          return say(`${sprint.name} has ${done.length} of ${inSprint.length} stories done${pts(inSprint) ? `, that's ${pts(done)} of ${pts(inSprint)} points` : ''}, and ${left}.`);
        });

      case 'list_sprints':
        return P(async (p) => {
          const { data } = await api.get('/sprints', { params: { project: p._id } });
          const list = data.sprints || [];
          if (!list.length) return say(`There are no sprints in ${p.name} yet.`);
          return say(`${p.name} has ${list.length}: ${list.slice(0, 5).map((s) => `${s.name}, ${s.status}`).join('; ')}.`);
        });

      case 'sprint_review': {
        if (!params.text) return ask('What should the sprint review say?', 'text', 500);
        return P(async (p) => {
          const sprint = await pickSprint(params.sprint, p, 'Active');
          if (!sprint) return false;
          await api.put(`/sprints/${sprint._id}/review`, { review: params.text }, { params: { project: p._id } });
          return say(`Done. I saved the review for ${sprint.name}.`);
        });
      }

      case 'retro_add': {
        if (!params.text) return ask('What should I note down?', 'text', 300);
        const kind = RETRO_LABELS[params.kind] ? params.kind : 'wentWell';
        return P(async (p) => {
          const sprint = await pickSprint(params.sprint, p, 'Active');
          if (!sprint) return false;
          const cur = sprint.retrospective || {};
          const body = { wentWell: cur.wentWell || [], toImprove: cur.toImprove || [], actionItems: cur.actionItems || [] };
          body[kind] = [...body[kind], params.text];
          await api.put(`/sprints/${sprint._id}/retrospective`, body, { params: { project: p._id } });
          return say(`Added to ${RETRO_LABELS[kind]} for ${sprint.name}.`);
        });
      }

      /* ---------- my day ---------- */
      case 'my_work': {
        const mine = (await loadAllStories())
          .filter((s) => s.status !== 'Done' && (s.assignee?._id === myId() || s.assignee === myId()))
          .sort((a, b) => (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0));
        if (!mine.length) return say("You've got nothing assigned right now. Nice and clear.");
        remember(mine[0]);
        const top = mine.slice(0, 3).map((s) => s.title.slice(0, 60)).join(', ');
        return say(`You have ${mine.length} open ${mine.length === 1 ? 'story' : 'stories'}. The top ${Math.min(3, mine.length) === 1 ? 'one is' : 'ones are'}: ${top}.`);
      }

      case 'overdue': {
        const late = (await loadAllStories())
          .filter((s) => s.status !== 'Done' && s.dueDate && new Date(s.dueDate).getTime() < Date.now())
          .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
        if (!late.length) return say('Nothing is overdue. Great job.');
        remember(late[0]);
        return say(`${late.length} ${late.length === 1 ? 'story is' : 'stories are'} overdue. The oldest ${Math.min(3, late.length) === 1 ? 'is' : 'are'}: ${late.slice(0, 3).map((s) => s.title.slice(0, 50)).join(', ')}.`);
      }

      case 'briefing': {
        const hour = new Date().getHours();
        const part = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
        const [all, notif] = await Promise.all([
          loadAllStories().catch(() => []),
          api.get('/notifications').then((r) => r.data.notifications || []).catch(() => []),
        ]);
        const mine = all.filter((s) => s.status !== 'Done' && (s.assignee?._id === myId() || s.assignee === myId()));
        const high = mine.filter((s) => ['High', 'Critical'].includes(s.priority)).length;
        const late = all.filter((s) => s.status !== 'Done' && s.dueDate && new Date(s.dueDate).getTime() < Date.now()).length;
        const unread = notif.filter((n) => !n.read).length;
        let site = '';
        const p = await resolveProject('');
        if (p) {
          const h = await api.get(`/devops/${p._id}/health`).then((r) => r.data).catch(() => null);
          if (h?.configured) site = h.up ? ` ${p.name} is up and running.` : ` Heads up, ${p.name} looks down.`;
        }
        return say(
          `Good ${part}, ${firstName()}. You have ${mine.length} open ${mine.length === 1 ? 'story' : 'stories'}${high ? `, ${high} high priority` : ''}.` +
          `${late ? ` ${late} ${late === 1 ? 'is' : 'are'} overdue.` : ''}` +
          ` ${unread ? `And ${unread} unread ${unread === 1 ? 'notification' : 'notifications'}.` : 'Notifications are clear.'}${site}`
        );
      }

      case 'notifications': {
        if (params.markRead) {
          await api.put('/notifications/read-all');
          return say('Done, I marked everything as read.');
        }
        const { data } = await api.get('/notifications');
        const unread = (data.notifications || []).filter((n) => !n.read);
        if (!unread.length) return say("You're all caught up, no new notifications.");
        return say(`You have ${unread.length} new ${unread.length === 1 ? 'notification' : 'notifications'}. ${unread.slice(0, 3).map((n) => n.message).join('. ')}.`);
      }

      case 'analytics_summary':
        return P(async (p) => {
          const [c, pr] = await Promise.all([
            api.get(`/analytics/${p._id}/task-completion`).then((r) => r.data).catch(() => null),
            api.get(`/analytics/${p._id}/productivity`).then((r) => r.data.productivity || []).catch(() => []),
          ]);
          if (!c) return no("I couldn't load the analytics for that project.");
          const top = [...pr].sort((a, b) => b.tasksCompleted - a.tasksCompleted)[0];
          return say(`${p.name} has ${c.done} of ${c.total} stories done, that's ${c.completionRate} percent.${top && top.tasksCompleted ? ` Top contributor is ${String(top.member).split(' ')[0]} with ${top.tasksCompleted} finished.` : ''}`);
        });

      /* ---------- devops ---------- */
      case 'devops_status':
        return P(async (p) => {
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
          return say(a + b);
        });

      case 'pipeline_status':
        return P(async (p) => {
          const { data } = await api.get(`/devops/${p._id}/pipeline`);
          if (!data.connected) return no('No GitHub repo is connected to that project yet.');
          const runs = data.runs || [];
          if (!runs.length) return say('There are no pipeline runs yet.');
          const done = runs.filter((r) => r.status === 'completed');
          const pass = done.filter((r) => r.conclusion === 'success').length;
          const last = runs[0];
          const state = last.status !== 'completed' ? 'is still running' : last.conclusion === 'success' ? 'passed' : 'failed';
          return say(`The latest run, ${last.name}, ${state} on ${last.branch}.${done.length ? ` ${pass} of the last ${done.length} runs passed.` : ''}`);
        });

      case 'recent_commits':
        return P(async (p) => {
          const { data } = await api.get(`/devops/${p._id}/repo-activity`);
          if (!data.connected || !data.commits?.length) return no('I have no commits to read for that project.');
          return say(`The latest commits are: ${data.commits.slice(0, 3).map((c) => `${c.message.slice(0, 60)}, by ${c.author}`).join('; ')}.`);
        });

      case 'open_prs':
        return P(async (p) => {
          const { data } = await api.get(`/devops/${p._id}/repo-activity`);
          if (!data.connected) return no('No GitHub repo is connected to that project yet.');
          if (!data.pulls?.length) return say('There are no open pull requests.');
          return say(`There ${data.pulls.length === 1 ? 'is 1 open pull request' : `are ${data.pulls.length} open pull requests`}: ${data.pulls.slice(0, 3).map((x) => x.title.slice(0, 60)).join('; ')}.`);
        });

      case 'record_deployment':
        return P(async (p) => {
          const environment = ENVIRONMENTS.includes(params.environment) ? params.environment : 'Production';
          const status = ['success', 'failed', 'running', 'queued'].includes(params.result) ? params.result : 'success';
          await api.post(`/devops/${p._id}/deployments`, { environment, status, branch: params.branch || 'main', logs: params.notes || '' });
          return say(`Done. I recorded a ${status} ${environment} deployment for ${p.name}.`);
        });

      case 'deploy':
        return P((p) => {
          const environment = ENVIRONMENTS.includes(params.environment) ? params.environment : 'Production';
          return confirm(`You want me to deploy ${environment} for ${p.name}. Are you sure?`, async () => {
            const { data } = await api.post(`/devops/${p._id}/deploy`, { environment, branch: params.branch || 'main' });
            return say(data.message === 'Deploy hook triggered' ? 'Deploy started. I will leave it in your deployment history.' : data.message || 'Deploy started.');
          });
        });

      /* ---------- admin & me ---------- */
      case 'announce': {
        if (!isAdmin()) return no('Only admins can post announcements.');
        if (!params.title && !params.message) return ask('What should the announcement say?', 'message', 500);
        const title = params.title || params.message.slice(0, 60);
        const message = params.message || params.title;
        return confirm(`I'll announce "${title}" to everyone. Should I go ahead?`, async () => {
          await api.post('/admin/announcements', { title, message, severity: params.severity || 'info' });
          return say('Posted. Everyone will see it on their dashboard.');
        });
      }

      case 'list_users': {
        if (!isAdmin()) return no('Only admins can see the user list.');
        const { data } = await api.get('/admin/users');
        const users = data.users || [];
        return say(`There are ${users.length} users: ${users.filter((u) => u.systemRole === 'admin').length} admins and ${users.filter((u) => u.status === 'suspended').length} suspended.`);
      }

      case 'suspend_user':
      case 'activate_user':
      case 'set_system_role': {
        if (!isAdmin()) return no('Only admins can manage users.');
        if (!params.person) return ask('Which user do you mean? Say their name or email.', 'person', 100);
        const { data } = await api.get('/admin/users');
        const q = norm(params.person);
        const matches = (data.users || []).filter((u) => norm(u.name).includes(q) || (u.email || '').toLowerCase().includes(q.replace(/\s+/g, '')));
        if (!matches.length) return no(`I couldn't find a user called ${params.person}.`);
        if (matches.length > 1) {
          if (plan._asked) return no('There are several matches. Please use the Admin page for that one.');
          return askSlot(`I found ${matches.slice(0, 3).map((u) => u.name).join(', ')}. Which one? Say the full name.`, (a) => execute({ ...plan, _asked: true, params: { ...params, person: a } }, rest), rest);
        }
        const u = matches[0];
        const first = u.name.split(' ')[0];
        if (plan.action === 'activate_user') {
          await api.put(`/admin/users/${u._id}/status`, { status: 'active' });
          return say(`Done. ${first} is active again.`);
        }
        if (u._id === myId()) return no("I won't change your own account.");
        if (plan.action === 'suspend_user') {
          return confirm(`Suspend ${first}? They won't be able to sign in. Are you sure?`, async () => {
            await api.put(`/admin/users/${u._id}/status`, { status: 'suspended' });
            return say(`Done. ${first} is suspended.`);
          });
        }
        if (!['user', 'admin'].includes(params.level)) return ask('Should they be a normal user or an admin?', 'level', 20);
        return confirm(`Make ${first} ${params.level === 'admin' ? 'an admin' : 'a normal user'}?`, async () => {
          await api.put(`/admin/users/${u._id}/role`, { systemRole: params.level });
          return say(`Done. ${first} is now ${params.level === 'admin' ? 'an admin' : 'a normal user'}.`);
        });
      }

      case 'update_profile': {
        if (!params.name && !params.jobTitle) return ask('What should I change on your profile? Say your new name or job title.', 'jobTitle', 80);
        await api.put('/users/me', {
          name: params.name || user?.name || '',
          jobTitle: params.jobTitle || user?.jobTitle || '',
          avatarUrl: user?.avatarUrl || '',
        });
        await refreshSession?.();
        return say('Done. Your profile is updated.');
      }

      case 'chat':
        await speak(plan.speech || "Sorry, I didn't catch that.");
        return true;

      default: // unknown
        await speak(plan.speech || "Sorry, I didn't catch that.");
        return false;
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
      let steps = null;
      const local = parseLocal(text);
      if (local) {
        steps = [local];
      } else {
        const askBrain = async () => {
          const projects = await getProjects().catch(() => []);
          const { data } = await api.post('/ai/salina', {
            text,
            path: pathRef.current,
            lastStory: lastStoryRef.current?.title || '',
            projects: projects.map((p) => p.name),
          });
          return data;
        };
        try {
          let data;
          try {
            data = await askBrain();
          } catch (e1) {
            if (e1?.response?.status !== 502) throw e1;
            await new Promise((r) => setTimeout(r, 900)); // one quiet retry for a temporary AI hiccup
            data = await askBrain();
          }
          const list = data.steps?.length ? data.steps : [{ action: data.action, params: data.params }];
          steps = list.map((s) => ({ ...s, speech: data.speech }));
        } catch (e) {
          const kind = e?.response?.data?.kind;
          await speak(
            !e?.response
              ? "I can't reach the server right now. It may be waking up, so try again in a few seconds."
              : kind === 'no_key'
                ? "My AI key isn't set on the server yet, so I can only do quick commands like opening pages."
                : kind === 'rate_limit'
                  ? "I'm getting a lot of requests right now. Give me about a minute."
                  : kind === 'bad_reply'
                    ? 'I got a bit confused by that one. Could you say it a simpler way?'
                    : 'My AI side had a hiccup. Try again in a moment. Quick commands like opening pages still work.'
          );
          return;
        }
      }
      dismissed = steps[0]?.action === 'dismiss';
      await runSteps(steps);
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
                  ? 'Turn voice on, then say "Salina". Try: "give me my briefing", "create a project called Shop and add 3 stories about checkout", "move login bug to done", "start the sprint", "invite Ravi as tester".'
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
