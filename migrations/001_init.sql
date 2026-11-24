create table if not exists admin_settings (
  id integer primary key,
  password_hash text not null,
  hall_key text not null,
  created_at timestamptz not null default now(),
  constraint admin_settings_singleton check (id = 1)
);

create table if not exists admin_sessions (
  token text primary key,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists candidates (
  id text primary key,
  name text not null,
  archived boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint candidates_name_len check (char_length(name) between 1 and 40)
);

create unique index if not exists candidates_active_name_idx
  on candidates (name)
  where archived = false;

create table if not exists scores (
  id text primary key,
  candidate_id text not null references candidates (id),
  judge_name text not null,
  ppt_design smallint not null,
  ppt_time smallint not null,
  ppt_expression smallint not null,
  pm_duty smallint not null,
  pm_problem smallint not null,
  tech_duty smallint not null,
  tech_problem smallint not null,
  dept_duty smallint not null,
  dept_problem smallint not null,
  talent_duty smallint not null,
  total smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scores_judge_unique unique (candidate_id, judge_name),
  constraint scores_judge_len check (char_length(judge_name) between 1 and 40),
  constraint scores_ppt_design_chk check (ppt_design in (5, 3, 1)),
  constraint scores_ppt_time_chk check (ppt_time in (5, 3, 1)),
  constraint scores_ppt_expression_chk check (ppt_expression in (5, 3, 1)),
  constraint scores_pm_duty_chk check (pm_duty in (25, 15, 5)),
  constraint scores_pm_problem_chk check (pm_problem in (10, 5, 1)),
  constraint scores_tech_duty_chk check (tech_duty in (15, 8, 2)),
  constraint scores_tech_problem_chk check (tech_problem in (10, 5, 1)),
  constraint scores_dept_duty_chk check (dept_duty in (15, 8, 2)),
  constraint scores_dept_problem_chk check (dept_problem in (10, 5, 1)),
  constraint scores_talent_duty_chk check (talent_duty in (20, 10, 5)),
  constraint scores_total_chk check (
    total = ppt_design + ppt_time + ppt_expression
      + pm_duty + pm_problem
      + tech_duty + tech_problem
      + dept_duty + dept_problem
      + talent_duty
  )
);

create index if not exists scores_candidate_idx on scores (candidate_id);
