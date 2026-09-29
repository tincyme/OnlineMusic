-- Reviewed bootstrap schema for a NEW dedicated Voxtunes Supabase project.
-- Not applied to any connected project. Do not run on the pet-app database.
begin;
create schema if not exists academy_private;
revoke all on schema academy_private from public;
grant usage on schema academy_private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(display_name) between 1 and 100),
  role text not null default 'student' check (role in ('student','teacher','admin')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Intentional private definer lookup avoids recursive RLS. Role is stored in
-- this protected table, never taken from client-editable user metadata.
create function academy_private.current_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = (select auth.uid()) and auth.uid() is not null;
$$;
revoke all on function academy_private.current_role() from public, anon;
grant execute on function academy_private.current_role() to authenticated;

create function academy_private.new_account() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name, role)
  values (new.id, left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), 'Voxtunes learner'),100), 'student');
  return new;
end;
$$;
revoke all on function academy_private.new_account() from public, anon, authenticated;
create trigger voxtunes_account_created after insert on auth.users for each row execute function academy_private.new_account();

create table public.learners (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references public.profiles(id),
  name text not null check (length(trim(name)) between 1 and 100),
  level text not null check (level in ('Beginner','Some experience','Intermediate')),
  time_zone text not null check (length(time_zone) between 1 and 80),
  created_at timestamptz not null default now()
);
create index on public.learners(guardian_id);
create table public.batches (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  teacher_id uuid not null references public.profiles(id),
  capacity integer not null default 6 check (capacity between 4 and 6)
);
create index on public.batches(teacher_id);
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id),
  learner_id uuid not null references public.learners(id),
  unique(batch_id, learner_id)
);
create index on public.enrollments(learner_id);
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id),
  starts_at timestamptz not null,
  duration_minutes integer not null default 60 check (duration_minutes = 60),
  topic text not null check (length(trim(topic)) between 1 and 200),
  zoom_join_url text check (zoom_join_url ~ '^https://([a-zA-Z0-9-]+\.)*zoom\.us/[^[:space:]]*$'),
  status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled')),
  unique(batch_id, starts_at)
);
create table public.attendance (
  session_id uuid not null references public.sessions(id),
  learner_id uuid not null references public.learners(id),
  status text not null check (status in ('present','absent','excused')),
  primary key(session_id, learner_id)
);
create index on public.attendance(learner_id);
create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references public.profiles(id),
  learner_id uuid not null references public.learners(id),
  goals text not null check (length(trim(goals)) between 1 and 2000),
  status text not null default 'requested' check (status in ('requested','contacted','completed')),
  created_at timestamptz not null default now()
);
create index on public.assessments(guardian_id);
create index on public.assessments(learner_id);

create function academy_private.can_read_batch(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    academy_private.current_role() = 'admin'
    or exists(select 1 from public.batches b where b.id = target and b.teacher_id = auth.uid())
    or exists(select 1 from public.enrollments e join public.learners l on l.id=e.learner_id where e.batch_id=target and l.guardian_id=auth.uid())
  );
$$;
create function academy_private.can_teach_batch(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    academy_private.current_role() = 'admin'
    or (academy_private.current_role() = 'teacher' and exists(select 1 from public.batches where id=target and teacher_id=auth.uid()))
  );
$$;
create function academy_private.can_read_learner(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    academy_private.current_role() = 'admin'
    or exists(select 1 from public.learners where id=target and guardian_id=auth.uid())
    or exists(select 1 from public.enrollments e where e.learner_id=target and academy_private.can_teach_batch(e.batch_id))
  );
$$;
revoke all on function academy_private.can_read_batch(uuid), academy_private.can_teach_batch(uuid), academy_private.can_read_learner(uuid) from public, anon;
grant execute on function academy_private.can_read_batch(uuid), academy_private.can_teach_batch(uuid), academy_private.can_read_learner(uuid) to authenticated;

alter table public.learners enable row level security;
alter table public.batches enable row level security;
alter table public.enrollments enable row level security;
alter table public.sessions enable row level security;
alter table public.attendance enable row level security;
alter table public.assessments enable row level security;
revoke all on public.profiles, public.learners, public.batches, public.enrollments, public.sessions, public.attendance, public.assessments from anon, authenticated;
grant select on public.profiles, public.learners, public.batches, public.enrollments, public.sessions, public.attendance, public.assessments to authenticated;
grant insert on public.learners, public.batches, public.enrollments, public.sessions, public.attendance, public.assessments to authenticated;
grant update(status) on public.attendance, public.assessments to authenticated;
-- PostgREST upsert specifies key columns too; RLS prevents changing row identity.
grant update(session_id, learner_id) on public.attendance to authenticated;

create policy profiles_read on public.profiles for select to authenticated using (id=(select auth.uid()) or (select academy_private.current_role())='admin');
create policy learners_read on public.learners for select to authenticated using (guardian_id=(select auth.uid()) or academy_private.can_read_learner(id));
create policy learners_insert on public.learners for insert to authenticated with check (guardian_id=(select auth.uid()) and (select academy_private.current_role())='student');
create policy batches_read on public.batches for select to authenticated using (academy_private.can_read_batch(id));
create policy batches_insert on public.batches for insert to authenticated with check ((select academy_private.current_role())='admin');
create policy enrollments_read on public.enrollments for select to authenticated using (academy_private.can_teach_batch(batch_id) or exists(select 1 from public.learners l where l.id=learner_id and l.guardian_id=auth.uid()));
create policy enrollments_insert on public.enrollments for insert to authenticated with check ((select academy_private.current_role())='admin');
create policy sessions_read on public.sessions for select to authenticated using (academy_private.can_read_batch(batch_id));
create policy sessions_insert on public.sessions for insert to authenticated with check ((select academy_private.current_role())='admin');
create policy attendance_read on public.attendance for select to authenticated using (exists(select 1 from public.sessions s where s.id=session_id and academy_private.can_teach_batch(s.batch_id)) or exists(select 1 from public.learners l where l.id=learner_id and l.guardian_id=auth.uid()));
create policy attendance_insert on public.attendance for insert to authenticated with check (exists(select 1 from public.sessions s where s.id=session_id and academy_private.can_teach_batch(s.batch_id)));
create policy attendance_update on public.attendance for update to authenticated using (exists(select 1 from public.sessions s where s.id=session_id and academy_private.can_teach_batch(s.batch_id))) with check (exists(select 1 from public.sessions s where s.id=session_id and academy_private.can_teach_batch(s.batch_id)));
create policy assessments_read on public.assessments for select to authenticated using (guardian_id=(select auth.uid()) or (select academy_private.current_role())='admin');
create policy assessments_insert on public.assessments for insert to authenticated with check (guardian_id=(select auth.uid()) and status='requested' and exists(select 1 from public.learners l where l.id=learner_id and l.guardian_id=auth.uid()));
create policy assessments_update on public.assessments for update to authenticated using ((select academy_private.current_role())='admin') with check ((select academy_private.current_role())='admin');

-- Serialize enrollment per batch so simultaneous requests cannot overbook.
create function academy_private.validate_enrollment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare seats integer;
begin
  if auth.uid() is null or academy_private.current_role() is distinct from 'admin' then raise exception 'Administrator access required.'; end if;
  select capacity into seats from public.batches where id=new.batch_id for update;
  if (select count(*) from public.enrollments where batch_id=new.batch_id) >= seats then
    raise exception 'This batch is full.';
  end if;
  return new;
end;
$$;
create trigger voxtunes_enrollment_capacity before insert on public.enrollments for each row execute function academy_private.validate_enrollment();

create function academy_private.validate_learner() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists(select 1 from pg_timezone_names where name=new.time_zone) then raise exception 'Choose a valid IANA time zone, for example Asia/Kolkata.'; end if;
  return new;
end;
$$;
create trigger voxtunes_learner_zone before insert on public.learners for each row execute function academy_private.validate_learner();

create function academy_private.validate_teacher() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists(select 1 from public.profiles where id=new.teacher_id and role='teacher') then raise exception 'Assign a teacher account to this batch.'; end if;
  return new;
end;
$$;
create trigger voxtunes_batch_teacher before insert on public.batches for each row execute function academy_private.validate_teacher();

create function academy_private.validate_attendance() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists(select 1 from public.enrollments e join public.sessions s on s.batch_id=e.batch_id where s.id=new.session_id and e.learner_id=new.learner_id) then raise exception 'The learner is not enrolled in this class.'; end if;
  return new;
end;
$$;
create trigger voxtunes_attendance_enrollment before insert or update on public.attendance for each row execute function academy_private.validate_attendance();
revoke all on function academy_private.validate_enrollment(), academy_private.validate_learner(), academy_private.validate_teacher(), academy_private.validate_attendance() from public, anon, authenticated;
commit;
