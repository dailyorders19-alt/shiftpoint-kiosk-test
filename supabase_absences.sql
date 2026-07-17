create table if not exists public.absences (
  id text primary key,
  employee_id text not null references public.employees(id) on delete cascade,
  employee_name text not null default '',
  department text not null default '',
  start_date date not null,
  end_date date not null,
  type text not null default 'other',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint absences_valid_range check (end_date >= start_date),
  constraint absences_valid_type check (type in ('sick', 'vacation', 'excused', 'unexcused', 'unpaid', 'other'))
);

create index if not exists absences_employee_id_idx on public.absences(employee_id);
create index if not exists absences_date_range_idx on public.absences(start_date, end_date);

alter table public.absences enable row level security;

drop policy if exists "Allow anon read absences" on public.absences;
drop policy if exists "Allow anon insert absences" on public.absences;
drop policy if exists "Allow anon update absences" on public.absences;
drop policy if exists "Allow anon delete absences" on public.absences;

create policy "Allow anon read absences"
on public.absences for select
to anon
using (true);

create policy "Allow anon insert absences"
on public.absences for insert
to anon
with check (true);

create policy "Allow anon update absences"
on public.absences for update
to anon
using (true)
with check (true);

create policy "Allow anon delete absences"
on public.absences for delete
to anon
using (true);
