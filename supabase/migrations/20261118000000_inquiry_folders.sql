-- The farmer's own filing of an inquiry: buyers or done. No row means inbox.
-- Seen only by the farmer the inquiry was sent to. It changes no inquiry status,
-- no count and nothing on the buyer's status page.
create table inquiry_folders (
  inquiry_id  text primary key references inquiries (id) on delete cascade,
  folder      text not null check (folder in ('buyers', 'done')),
  updated_at  timestamptz not null default now()
);

alter table inquiry_folders enable row level security;
