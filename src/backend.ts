import { createClient } from '@supabase/supabase-js';

// Preview bundles must never connect to live accounts or collect personal data.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const backend = !__PREVIEW__ && url && key ? createClient(url, key) : null;

export type Profile = { id: string; display_name: string; role: 'student' | 'teacher' | 'admin' };
export type Learner = { id: string; guardian_id: string; name: string; level: string; time_zone: string };
export type Batch = { id: string; name: string; teacher_id: string; capacity: number };
export type Enrollment = { id: string; batch_id: string; learner_id: string };
export type Lesson = { id: string; batch_id: string; starts_at: string; duration_minutes: number; topic: string; zoom_join_url: string | null; status: string };
export type Attendance = { session_id: string; learner_id: string; status: string };
export type Assessment = { id: string; guardian_id: string; learner_id: string; goals: string; status: string };
export type AcademyData = { learners: Learner[]; batches: Batch[]; enrollments: Enrollment[]; sessions: Lesson[]; attendance: Attendance[]; assessments: Assessment[]; profiles: Profile[] };
export const emptyData: AcademyData = { learners: [], batches: [], enrollments: [], sessions: [], attendance: [], assessments: [], profiles: [] };

export async function readAcademy(): Promise<AcademyData> {
  if (!backend) return emptyData;
  const tables = ['learners', 'batches', 'enrollments', 'sessions', 'attendance', 'assessments', 'profiles'] as const;
  const results = await Promise.all(tables.map(table => backend!.from(table).select('*')));
  const failure = results.find(result => result.error);
  if (failure?.error) throw failure.error;
  return Object.fromEntries(tables.map((table, index) => [table, results[index].data || []])) as AcademyData;
}
