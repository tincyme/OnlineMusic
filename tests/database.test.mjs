import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('database enforces family isolation, teacher scope, admin-only enrollment and capacity', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon nologin; create role authenticated nologin;
      create schema auth;
      create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated;
      grant execute on function auth.uid() to authenticated;
    `);
    await db.exec(await readFile(new URL('../database/schema.sql', import.meta.url), 'utf8'));
    const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    const [parentA,parentB,teacherA,teacherB,admin] = [1,2,3,4,5].map(uid);
    for (const id of [parentA,parentB,teacherA,teacherB,admin]) await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)', [id, {display_name:'Test account',role:'admin'}]);
    assert.equal((await db.query('select count(*)::int n from public.profiles where role=\'student\'')).rows[0].n, 5, 'metadata cannot assign a role');
    await db.query('update public.profiles set role=\'teacher\' where id in ($1,$2)', [teacherA,teacherB]);
    await db.query('update public.profiles set role=\'admin\' where id=$1', [admin]);
    async function as(id) { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]); await db.exec('set role authenticated'); }
    async function rejected(sql,args,pattern) { await assert.rejects(db.query(sql,args), pattern); }
    await as(parentA);
    await rejected('update public.profiles set role=\'admin\' where id=$1',[parentA],/permission denied/);
    await rejected('insert into public.learners(guardian_id,name,level,time_zone) values($1,\'Other\',\'Beginner\',\'Asia/Kolkata\')',[parentB],/row-level security/);
    await rejected('insert into public.learners(guardian_id,name,level,time_zone) values($1,\'Child\',\'Beginner\',\'Fake/Zone\')',[parentA],/valid IANA/);
    const learnerA=(await db.query('insert into public.learners(guardian_id,name,level,time_zone) values($1,\'Learner A\',\'Beginner\',\'Asia/Kolkata\') returning id',[parentA])).rows[0].id;
    await as(parentB);
    const learnerB=(await db.query('insert into public.learners(guardian_id,name,level,time_zone) values($1,\'Learner B\',\'Beginner\',\'America/New_York\') returning id',[parentB])).rows[0].id;
    assert.deepEqual((await db.query('select id from public.learners')).rows.map(r=>r.id),[learnerB]);
    await rejected('insert into public.assessments(guardian_id,learner_id,goals) values($1,$2,\'Test\')',[parentB,learnerA],/row-level security/);
    await as(admin);
    const batchA=(await db.query('insert into public.batches(name,teacher_id,capacity) values(\'Batch A\',$1,4) returning id',[teacherA])).rows[0].id;
    const batchB=(await db.query('insert into public.batches(name,teacher_id,capacity) values(\'Batch B\',$1,4) returning id',[teacherB])).rows[0].id;
    await db.query('insert into public.enrollments(batch_id,learner_id) values($1,$2),($3,$4)',[batchA,learnerA,batchB,learnerB]);
    const sessionA=(await db.query('insert into public.sessions(batch_id,starts_at,topic,zoom_join_url) values($1,now(),\'Test\',\'https://zoom.us/j/123\') returning id',[batchA])).rows[0].id;
    const sessionB=(await db.query('insert into public.sessions(batch_id,starts_at,topic) values($1,now(),\'Test\') returning id',[batchB])).rows[0].id;
    await as(parentA);
    assert.deepEqual((await db.query('select id from public.sessions')).rows.map(r=>r.id),[sessionA]);
    await rejected('insert into public.enrollments(batch_id,learner_id) values($1,$2)',[batchB,learnerA],/Administrator access|row-level security/);
    await as(teacherA);
    assert.deepEqual((await db.query('select id from public.learners')).rows.map(r=>r.id),[learnerA]);
    assert.deepEqual((await db.query('select id from public.sessions')).rows.map(r=>r.id),[sessionA]);
    await db.query('insert into public.attendance(session_id,learner_id,status) values($1,$2,\'present\')',[sessionA,learnerA]);
    await db.query('insert into public.attendance(session_id,learner_id,status) values($1,$2,\'absent\') on conflict(session_id,learner_id) do update set status=excluded.status',[sessionA,learnerA]);
    await rejected('insert into public.attendance(session_id,learner_id,status) values($1,$2,\'present\')',[sessionA,learnerB],/not enrolled/);
    await rejected('insert into public.attendance(session_id,learner_id,status) values($1,$2,\'present\')',[sessionB,learnerB],/not enrolled|row-level security/);
    await as(parentA);
    assert.equal((await db.query('select status from public.attendance')).rows[0].status,'absent');
    await rejected('insert into public.attendance(session_id,learner_id,status) values($1,$2,\'present\')',[sessionA,learnerA],/row-level security/);
    const more=[];
    for(let i=0;i<4;i++) more.push((await db.query('insert into public.learners(guardian_id,name,level,time_zone) values($1,\'Sibling\',\'Beginner\',\'Asia/Kolkata\') returning id',[parentA])).rows[0].id);
    await as(admin);
    for (const learner of more.slice(0,3)) await db.query('insert into public.enrollments(batch_id,learner_id) values($1,$2)',[batchA,learner]);
    await rejected('insert into public.enrollments(batch_id,learner_id) values($1,$2)',[batchA,more[3]],/batch is full/);
    await db.exec('reset role; set role anon');
    await rejected('select * from public.learners',[],/permission denied/);
  } finally { await db.close(); }
});
