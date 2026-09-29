import { StrictMode, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import type { Session } from '@supabase/supabase-js';
import { backend, emptyData, readAcademy, type AcademyData, type Profile } from './backend';
import { CLASS_PRICE_CENTS, formatClassTime, routeFromHash, zoomUrl } from './domain.mjs';
import './style.css';

const roleNames = { student: 'Student & parent', teacher: 'Teacher', admin: 'Administrator' };
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const value = (data: FormData, key: string) => String(data.get(key) || '').trim();

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}
function App() {
  const [route, setRoute] = useState(routeFromHash(location.hash));
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [data, setData] = useState<AcademyData>(emptyData);
  const [loading, setLoading] = useState(!!backend);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [signup, setSignup] = useState(false);

  useEffect(() => {
    const onHash = () => { setRoute(routeFromHash(location.hash)); setMessage(''); setError(''); };
    window.addEventListener('hashchange', onHash);
    if (!backend) return () => window.removeEventListener('hashchange', onHash);
    const { data: listener } = backend.auth.onAuthStateChange((_event, next) => {
      setSession(next); setProfile(null); setData(emptyData); setLoading(!!next);
    });
    backend.auth.getSession().then(({ data, error }) => { if (error) setError(error.message); setSession(data.session); setLoading(!!data.session); });
    return () => { window.removeEventListener('hashchange', onHash); listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    let active = true;
    if (!session || !backend) return;
    readAcademy().then(next => {
      if (!active) return;
      setData(next);
      const own = next.profiles.find(p => p.id === session.user.id);
      if (!own) throw new Error('Your account profile is not ready. Please contact the academy.');
      setProfile(own);
    }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session]);

  async function act(action: () => Promise<void>, success: string) {
    setBusy(true); setError(''); setMessage('');
    try { await action(); setMessage(success); }
    catch (e) { setError(e instanceof Error ? e.message : (e as { message?: string }).message || 'Something went wrong. Please try again.'); }
    finally { setBusy(false); }
  }
  async function write(table: string, row: Record<string, unknown>, upsert = false) {
    if (!backend) throw new Error('The academy is not connected yet.');
    const result = upsert ? await backend.from(table).upsert(row) : await backend.from(table).insert(row);
    if (result.error) throw result.error;
    setData(await readAcademy());
  }
  function submit(event: FormEvent<HTMLFormElement>, action: (form: FormData) => Promise<void>, success: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = new FormData(form);
    void act(async () => { await action(payload); form.reset(); }, success);
  }
  const mismatch = profile && route !== 'home' && profile.role !== route;
  const canUse = profile && !mismatch && route !== 'home';

  return <>
    {__PREVIEW__ && <div className="preview-banner">Development preview · Accounts and data collection are disabled.</div>}
    <header><a className="brand" href="#/"><span className="brand-icon">V</span><span>Voxtunes <small>ACADEMY</small></span></a><nav aria-label="Main navigation"><a href="#/student">Student & parent</a><a href="#/teacher">Teacher</a><a href="#/admin">Admin</a></nav>{session && <button className="quiet" disabled={busy} onClick={() => act(async () => { const result = await backend!.auth.signOut(); if (result.error) throw result.error; setProfile(null); setData(emptyData); }, 'Signed out.')}>Sign out</button>}</header>
    <main>
      {error && <div className="notice error" role="alert">{error}</div>}
      {message && <div className="notice" role="status">{message}</div>}
      {route === 'home' ? <>
        <section className="hero"><div><p className="eyebrow">Rooted in tradition. Ready for your world.</p><h1>A lifelong connection<br />to Carnatic music.</h1><p className="intro">Live vocal lessons, a thoughtful learning path and room for every voice to grow. Learn from wherever your family calls home.</p><a className="button" href="#/student">Explore your learning space <span aria-hidden="true">↗</span></a><p className="fine">For young learners, families and adults.</p></div><div className="music-art" aria-hidden="true"><div className="circle circle-one"/><div className="circle circle-two"/><div className="note">♪</div><span>SA · RI · GA · MA · PA · DA · NI</span></div></section>
        <section className="tiles"><article><p className="eyebrow">Learn together</p><h2>Small groups.<br />Personal attention.</h2><p>4–6 learners per batch, with 60-minute classes hosted on Zoom.</p></article><article><p className="eyebrow">A clear starting point</p><h2>${CLASS_PRICE_CENTS / 100} <small>USD</small></h2><p>Per student, per group class. Your batch and schedule are confirmed after assessment.</p></article><article><p className="eyebrow">Across time zones</p><h2>Close to your roots.</h2><p>Your timetable appears in your local time, whether you are in India or abroad.</p></article></section>
        <section className="section-heading"><div><p className="eyebrow">Your academy, connected</p><h2>A place for every part of the journey.</h2></div></section>
        <div className="tiles roles">{Object.entries(roleNames).map(([key, name]) => <a href={`#/${key}`} key={key}><span className="role-number">0{Object.keys(roleNames).indexOf(key) + 1}</span><h3>{name}</h3><p>{key === 'student' ? 'Manage learners and see your upcoming lessons.' : key === 'teacher' ? 'See assigned batches and record class attendance.' : 'Organize batches, enrollment and class schedules.'}</p><span>Open portal →</span></a>)}</div>
      </> : <>
        <div className="section-heading"><div><p className="eyebrow">Voxtunes learning space</p><h1>{roleNames[route as keyof typeof roleNames]}</h1><p>{profile ? `Welcome, ${profile.display_name}.` : 'A little practice. A lasting connection.'}</p></div><span className="tag">{zone}</span></div>
        {!backend ? <section className="card connection"><h2>{__PREVIEW__ ? 'A preview of your academy' : 'The academy is getting ready'}</h2><p>{__PREVIEW__ ? 'This public preview shows the experience without collecting personal information. Working accounts will be available on the academy’s production website.' : 'Account access will open once the academy’s secure services are connected.'}</p><div className="preview-flow"><span>1 · Sign in</span><span>2 · Find your class</span><span>3 · Join on Zoom</span></div><p className="fine">No real students, classes or bookings are shown here.</p></section> : loading ? <p role="status">Loading your learning space…</p> : !session ? <section className="card auth"><h2>{signup && route === 'student' ? 'Create your family account' : 'Welcome back'}</h2><p>{route === 'student' ? 'A parent or guardian manages the account for children.' : 'Staff access is assigned by the academy.'}</p><form onSubmit={event => submit(event, async form => {
          const credentials = { email: value(form, 'email'), password: value(form, 'password') };
          const result = signup && route === 'student' ? await backend!.auth.signUp({ ...credentials, options: { data: { display_name: value(form, 'name') }, emailRedirectTo: `${location.origin}${import.meta.env.BASE_URL}#/student` } }) : await backend!.auth.signInWithPassword(credentials);
          if (result.error) throw result.error;
        }, signup && route === 'student' ? 'Check your email to confirm your account, then sign in.' : 'Signed in.')}>
          {signup && route === 'student' && <Field label="Your name"><input name="name" autoComplete="name" required maxLength={100}/></Field>}
          <Field label="Email"><input type="email" name="email" autoComplete="email" required maxLength={254}/></Field>
          <Field label="Password"><input type="password" name="password" autoComplete={signup ? 'new-password' : 'current-password'} required minLength={12} maxLength={128}/></Field>
          <button disabled={busy}>{busy ? 'Please wait…' : signup && route === 'student' ? 'Create account' : 'Sign in'}</button>
        </form>{route === 'student' && <button className="text-button" onClick={() => setSignup(!signup)}>{signup ? 'Already registered? Sign in' : 'New to Voxtunes? Create account'}</button>}</section> : mismatch ? <section className="card"><h2>This account has {profile.role} access</h2><p>Changing the portal does not change your account permissions.</p><a className="button" href={`#/${profile.role}`}>Go to your portal</a></section> : !profile ? <section className="card"><p>Your profile could not be loaded. Sign out and try again.</p></section> : canUse && <>
          <div className="tiles stats"><article><span>Learners</span><strong>{data.learners.length}</strong></article><article><span>Batches</span><strong>{data.batches.length}</strong></article><article><span>Upcoming classes</span><strong>{data.sessions.filter(s => s.status === 'scheduled' && new Date(s.starts_at) > new Date()).length}</strong></article></div>
          {profile.role === 'student' && <div className="two-columns"><section className="card"><h2>Your learners</h2>{data.learners.length ? data.learners.map(learner => <div className="list-item" key={learner.id}><strong>{learner.name}</strong><span>{learner.level} · {learner.time_zone}</span></div>) : <p>Add yourself or your child to begin.</p>}<form onSubmit={e => submit(e, async f => { await write('learners', { guardian_id: session.user.id, name: value(f, 'name'), level: value(f, 'level'), time_zone: value(f, 'zone') }); }, 'Learner added.')}><Field label="Learner name"><input name="name" required maxLength={100}/></Field><Field label="Experience"><select name="level"><option>Beginner</option><option>Some experience</option><option>Intermediate</option></select></Field><Field label="Time zone"><input name="zone" defaultValue={zone} required maxLength={80}/></Field><button disabled={busy}>Add learner</button></form></section><section className="card"><h2>Request an assessment</h2><p>Tell us about your goals. The academy will help find a suitable batch.</p><form onSubmit={e => submit(e, async f => { await write('assessments', { guardian_id: session.user.id, learner_id: value(f, 'learner'), goals: value(f, 'goals') }); }, 'Assessment requested.')}><LearnerSelect data={data}/><Field label="Goals and preferred class times"><textarea name="goals" required maxLength={2000}/></Field><button disabled={busy || !data.learners.length}>Request assessment</button></form>{data.assessments.map(a => <div className="list-item" key={a.id}><strong>{data.learners.find(l => l.id === a.learner_id)?.name}</strong><span>{a.status}</span></div>)}</section></div>}
          {profile.role === 'admin' && <>
            <div className="two-columns"><section className="card"><h2>Create a batch</h2><form onSubmit={e => submit(e, async f => { await write('batches', { name: value(f, 'name'), teacher_id: value(f, 'teacher'), capacity: Number(value(f, 'capacity')) }); }, 'Batch created.')}><Field label="Batch name"><input name="name" required maxLength={120}/></Field><Field label="Teacher"><select name="teacher" required><option value="">Choose teacher</option>{data.profiles.filter(p => p.role === 'teacher').map(p => <option value={p.id} key={p.id}>{p.display_name}</option>)}</select></Field><Field label="Capacity"><select name="capacity"><option>4</option><option>5</option><option>6</option></select></Field><button disabled={busy}>Create batch</button></form></section><section className="card"><h2>Enroll a learner</h2><form onSubmit={e => submit(e, async f => { await write('enrollments', { learner_id: value(f, 'learner'), batch_id: value(f, 'batch') }); }, 'Learner enrolled.')}><LearnerSelect data={data}/><BatchSelect data={data}/><button disabled={busy}>Enroll learner</button></form><p className="fine">Enrollment does not collect a payment.</p></section></div>
            <section className="card"><h2>Schedule a Zoom class</h2><p>Enter the time in {zone}. Create the meeting in Zoom first.</p><form className="form-grid" onSubmit={e => submit(e, async f => { const link = zoomUrl(value(f, 'zoom')); if (!link) throw new Error('Use a valid HTTPS zoom.us meeting link.'); await write('sessions', { batch_id: value(f, 'batch'), starts_at: new Date(value(f, 'starts')).toISOString(), topic: value(f, 'topic'), zoom_join_url: link }); }, 'Class scheduled.')}><BatchSelect data={data}/><Field label="Class topic"><input name="topic" required maxLength={200}/></Field><Field label="Date and time"><input name="starts" type="datetime-local" required/></Field><Field label="Zoom join link"><input name="zoom" type="url" required placeholder="https://…zoom.us/j/…"/></Field><button disabled={busy}>Schedule 60-minute class</button></form></section>
            <section className="card"><h2>Assessment requests</h2>{!data.assessments.length && <p>No requests yet.</p>}{data.assessments.map(a => <div className="list-item" key={a.id}><strong>{data.learners.find(l => l.id === a.learner_id)?.name}</strong><p>{a.goals}</p><span>{a.status}</span>{a.status === 'requested' && <button disabled={busy} onClick={() => act(async () => { const { error } = await backend!.from('assessments').update({ status: 'contacted' }).eq('id', a.id); if (error) throw error; setData(await readAcademy()); }, 'Request marked contacted.')}>Mark contacted</button>}</div>)}</section>
          </>}
          <section className="card"><h2>Class schedule</h2><p>Times shown in {zone}.</p>{!data.sessions.length && <div className="empty">Your scheduled classes will appear here.</div>}{[...data.sessions].sort((a,b) => a.starts_at.localeCompare(b.starts_at)).map(lesson => <article className="lesson" key={lesson.id}><div><span className="tag">{data.batches.find(b => b.id === lesson.batch_id)?.name} · {lesson.status}</span><h3>{lesson.topic}</h3><p>{formatClassTime(lesson.starts_at, zone)} · {lesson.duration_minutes} minutes</p></div>{lesson.status === 'scheduled' && zoomUrl(lesson.zoom_join_url || '') && <a className="button" href={zoomUrl(lesson.zoom_join_url || '')!} target="_blank" rel="noopener noreferrer">Join on Zoom ↗</a>}{profile.role !== 'student' && <div className="attendance">{data.enrollments.filter(en => en.batch_id === lesson.batch_id).map(en => <label key={en.id}><span>{data.learners.find(l => l.id === en.learner_id)?.name}</span><select aria-label={`Attendance for ${data.learners.find(l => l.id === en.learner_id)?.name}`} disabled={busy} value={data.attendance.find(a => a.session_id === lesson.id && a.learner_id === en.learner_id)?.status || ''} onChange={e => { const status = e.target.value; if (status) void act(() => write('attendance', { session_id: lesson.id, learner_id: en.learner_id, status }, true), 'Attendance saved.'); }}><option value="">Not marked</option><option value="present">Present</option><option value="absent">Absent</option><option value="excused">Excused</option></select></label>)}</div>}</article>)}</section>
        </>}
      </>}
    </main><footer><span>Voxtunes Academy</span><span>Carnatic roots. Global voices.</span></footer>
  </>;
}
function LearnerSelect({ data }: { data: AcademyData }) { return <Field label="Learner"><select name="learner" required><option value="">Choose learner</option>{data.learners.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Field>; }
function BatchSelect({ data }: { data: AcademyData }) { return <Field label="Batch"><select name="batch" required><option value="">Choose batch</option>{data.batches.map(b => <option key={b.id} value={b.id}>{b.name} ({data.enrollments.filter(e => e.batch_id === b.id).length}/{b.capacity})</option>)}</select></Field>; }

createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);
