-- Musoko initial schema.
--
-- STATUS: written without a database. NOT run, NOT tested against Supabase or
-- any Postgres. Treat every statement as unverified until it has been applied
-- to a scratch project and the checks listed in the step 1 handover have passed.
--
-- Mirrors the demo store (src/domain/types.ts `Database`) one table to one
-- table. TypeScript camelCase fields are snake_case columns here.
-- Ids are text so the demo's readable ids and live ids share one type.
--
-- Privacy shape:
--   * farm_private_locations, farmer_private_contacts and inquiry_buyer_contacts
--     are separate tables. RLS is on and NO policy grants anon or authenticated
--     any access. Per-role policies arrive in steps 6 and 7.
--   * Every table has RLS on. Table privileges are revoked from anon and
--     authenticated, then granted back only on the public_* views and on four
--     wholly public reference tables.
--   * The public_* views run as their owner (security_invoker = false) so they
--     can read the RLS-protected base tables. They select only published,
--     consented, visible rows and expose no private column.
--   * Money is integer cents. Points are geography(Point, 4326), longitude first.

create extension if not exists postgis;

-- ---------------------------------------------------------------------------
-- Reference tables (wholly public)
-- ---------------------------------------------------------------------------

create table regions (
  id    text primary key,
  slug  text not null unique,
  name  text not null,
  state text not null
);

create table communities (
  id        text primary key,
  region_id text not null references regions (id),
  slug      text not null unique,
  name      text not null,
  county    text not null,
  kind      text not null check (kind in ('town', 'county')),
  centre    geography(Point, 4326) not null
);
create index communities_region_idx on communities (region_id);
create index communities_centre_gix on communities using gist (centre);

create table product_types (
  id              text primary key,
  slug            text not null unique,
  name            text not null,
  category        text not null check (category in
    ('vegetables', 'fruits', 'herbs', 'eggs', 'meat_poultry', 'dairy', 'grains_legumes', 'other')),
  comparison_unit text not null check (comparison_unit in
    ('lb', 'oz', 'gallon', 'quart', 'pint', 'fl_oz', 'each', 'dozen'))
);

-- A single row. The defaults below are the only copy of these numbers on the
-- database side; src/config/settings.ts is the TypeScript copy. Keep them equal.
create table settings (
  singleton                      boolean primary key default true check (singleton),
  availability_window_days       integer not null default 14   check (availability_window_days > 0),
  inquiry_reminder_hours         integer not null default 48   check (inquiry_reminder_hours > 0),
  inquiry_auto_close_days        integer not null default 14   check (inquiry_auto_close_days > 0),
  outcome_prompt_days            integer not null default 3    check (outcome_prompt_days >= 0),
  search_event_retention_days    integer not null default 90   check (search_event_retention_days > 0),
  buyer_contact_retention_days   integer not null default 30   check (buyer_contact_retention_days > 0),
  minimum_sample_size            integer not null default 5    check (minimum_sample_size > 0),
  search_term_max_length         integer not null default 60   check (search_term_max_length > 0),
  inquiry_rate_limit_per_hour    integer not null default 5    check (inquiry_rate_limit_per_hour > 0),
  inquiry_min_fill_seconds       integer not null default 3    check (inquiry_min_fill_seconds >= 0),
  scheduled_jobs_interval_minutes integer not null default 5   check (scheduled_jobs_interval_minutes > 0)
);
insert into settings (singleton) values (true);

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

-- In live mode this id is the auth user id cast to text. Linking to auth.users
-- (trigger or foreign key) is left to the auth step.
create table users (
  id           text primary key,
  display_name text not null,
  created_at   timestamptz not null default now()
);

create table user_roles (
  user_id text not null references users (id) on delete cascade,
  role    text not null check (role in ('farmer', 'buyer', 'administrator')),
  primary key (user_id, role)
);

-- ---------------------------------------------------------------------------
-- Farmers
-- ---------------------------------------------------------------------------

create table farmer_profiles (
  id                            text primary key,
  user_id                       text references users (id),
  slug                          text not null unique,
  farm_name                     text not null,
  farmer_name                   text not null,
  intro                         text not null default '',
  story                         text not null default '',
  photos                        jsonb not null default '[]'::jsonb,
  region_id                     text not null references regions (id),
  community_id                  text not null references communities (id),
  created_by                    text not null references users (id),
  created_by_role               text not null check (created_by_role in ('farmer', 'administrator')),
  registration_status           text not null check (registration_status in ('pending_review', 'approved', 'rejected')),
  publication_status            text not null check (publication_status in ('draft', 'published', 'unpublished')),
  consent_method                text check (consent_method in ('farmer_signed_in', 'in_person', 'by_phone', 'signed_form')),
  consent_date                  date,
  consent_recorded_by           text references users (id),
  farmer_reviewed_latest_changes boolean not null default false,
  review_method                 text check (review_method in ('farmer_signed_in', 'in_person', 'by_phone', 'signed_form')),
  review_date                   date,
  review_recorded_by            text references users (id),
  open_to_wholesale             boolean not null default false,
  show_exact_location           boolean not null default false,
  show_phone                    boolean not null default false,
  show_email                    boolean not null default false,
  is_demo                       boolean not null default false,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  -- A profile cannot be published without recorded consent (CONS rules).
  constraint published_requires_consent check (
    publication_status <> 'published'
    or (consent_method is not null and consent_date is not null and consent_recorded_by is not null)
  )
);
create index farmer_profiles_community_idx on farmer_profiles (community_id);
create index farmer_profiles_user_idx on farmer_profiles (user_id);

create table farm_public_locations (
  farmer_profile_id text primary key references farmer_profiles (id) on delete cascade,
  community_id      text not null references communities (id),
  town              text not null,
  county            text not null,
  coarse_point      geography(Point, 4326) not null  -- the community centre
);

-- PRIVATE. No policy for anon or authenticated.
create table farm_private_locations (
  farmer_profile_id text primary key references farmer_profiles (id) on delete cascade,
  street_address    text not null,
  exact_point       geography(Point, 4326) not null
);

-- PRIVATE. No policy for anon or authenticated.
create table farmer_private_contacts (
  farmer_profile_id text primary key references farmer_profiles (id) on delete cascade,
  phone             text,
  email             text
);

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------

create table products (
  id                           text primary key,
  farmer_profile_id            text not null references farmer_profiles (id) on delete cascade,
  product_type_id              text not null references product_types (id),
  title                        text not null,
  description                  text not null default '',
  photo                        jsonb,
  price_cents                  integer not null check (price_cents >= 0),
  selling_unit                 text not null check (selling_unit in
    ('lb', 'oz', 'each', 'dozen', 'bunch', 'basket', 'box', 'bag', 'jar', 'bottle', 'carton',
     'flat', 'pint', 'quart', 'half_gallon', 'gallon', 'bushel', 'pack')),
  unit_size_amount             numeric check (unit_size_amount > 0),
  unit_size_measure            text check (unit_size_measure in
    ('lb', 'oz', 'gallon', 'quart', 'pint', 'fl_oz', 'each', 'dozen')),
  normalized_unit_price_cents  integer check (normalized_unit_price_cents >= 0),
  licence_self_confirmed       boolean,
  moderation_status            text not null default 'visible' check (moderation_status in ('visible', 'hidden', 'removed')),
  is_demo                      boolean not null default false,
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now(),
  constraint unit_size_both_or_neither check ((unit_size_amount is null) = (unit_size_measure is null))
);
create index products_farm_idx on products (farmer_profile_id);
create index products_type_idx on products (product_type_id);

create table product_availability (
  product_id        text primary key references products (id) on delete cascade,
  status            text not null check (status in ('available_now', 'coming_soon', 'unconfirmed')),
  last_confirmed_at timestamptz,
  expected_month    text check (expected_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  updated_at        timestamptz not null default now(),
  constraint coming_soon_needs_month check (status <> 'coming_soon' or expected_month is not null)
);

create table product_availability_history (
  id         text primary key,
  product_id text not null references products (id) on delete cascade,
  status     text not null check (status in ('available_now', 'coming_soon', 'unconfirmed')),
  changed_at timestamptz not null,
  changed_by text references users (id)
);
create index product_availability_history_product_idx on product_availability_history (product_id);

create table product_quantities (
  product_id        text primary key references products (id) on delete cascade,
  amount            numeric not null check (amount >= 0),
  unit              text not null,
  approximate       boolean not null default false,
  last_confirmed_at timestamptz not null
);

-- ---------------------------------------------------------------------------
-- Markets and pickup
-- ---------------------------------------------------------------------------

create table farmers_markets (
  id                text primary key,
  slug              text not null unique,
  name              text not null,
  community_id      text not null references communities (id),
  town              text not null,
  point             geography(Point, 4326) not null,
  venue             text not null,
  schedule          jsonb not null default '[]'::jsonb,
  season_note       text not null default '',
  contact_phone     text,
  contact_email     text,
  directions_url    text not null,
  moderation_status text not null default 'visible' check (moderation_status in ('visible', 'hidden', 'removed')),
  is_demo           boolean not null default false
);
create index farmers_markets_point_gix on farmers_markets using gist (point);

create table farmer_market_links (
  farmer_profile_id text not null references farmer_profiles (id) on delete cascade,
  market_id         text not null references farmers_markets (id) on delete cascade,
  primary key (farmer_profile_id, market_id)
);

create table pickup_locations (
  id                text primary key,
  slug              text not null unique,
  name              text not null,
  community_id      text not null references communities (id),
  town              text not null,
  point             geography(Point, 4326) not null,
  description       text not null default '',
  moderation_status text not null default 'visible' check (moderation_status in ('visible', 'hidden', 'removed')),
  is_demo           boolean not null default false
);
create index pickup_locations_point_gix on pickup_locations using gist (point);

-- There is deliberately no pickup-at-the-farm kind.
create table farmer_pickup_options (
  id                 text primary key,
  farmer_profile_id  text not null references farmer_profiles (id) on delete cascade,
  kind               text not null check (kind in ('pickup_location', 'farmers_market', 'own_delivery')),
  pickup_location_id text references pickup_locations (id),
  market_id          text references farmers_markets (id),
  schedule           jsonb not null default '[]'::jsonb,
  note               text not null default '',
  constraint pickup_option_target check (
    (kind = 'pickup_location' and pickup_location_id is not null and market_id is null)
    or (kind = 'farmers_market' and market_id is not null and pickup_location_id is null)
    or (kind = 'own_delivery' and pickup_location_id is null and market_id is null)
  )
);
create index farmer_pickup_options_farm_idx on farmer_pickup_options (farmer_profile_id);

-- ---------------------------------------------------------------------------
-- Inquiries
-- ---------------------------------------------------------------------------

create table inquiries (
  id                   text primary key,
  status_token         text not null unique,
  product_id           text references products (id) on delete set null,
  product_type_id      text references product_types (id),
  farmer_profile_id    text not null references farmer_profiles (id),
  community_id         text references communities (id),
  pickup_option_id     text references farmer_pickup_options (id) on delete set null,
  chosen_option_kind   text check (chosen_option_kind in ('pickup_location', 'farmers_market', 'own_delivery')),
  pickup_location_id   text references pickup_locations (id),
  market_id            text references farmers_markets (id),
  status               text not null check (status in ('awaiting_response', 'responded', 'closed')),
  requested_quantity_amount numeric check (requested_quantity_amount > 0),
  requested_quantity_unit   text,
  reply_channel        text not null check (reply_channel in ('text', 'email')),
  created_at           timestamptz not null default now(),
  responded_at         timestamptz,
  reminder_sent_at     timestamptz,
  closed_at            timestamptz,
  closed_reason        text check (closed_reason in ('unanswered', 'outcome_recorded', 'auto_after_response')),
  constraint closed_has_reason check ((status = 'closed') = (closed_reason is not null))
);
create index inquiries_farm_idx on inquiries (farmer_profile_id);
create index inquiries_status_idx on inquiries (status);

-- PRIVATE. Deleted on schedule; the inquiry row stays. The free-text message lives here too.
create table inquiry_buyer_contacts (
  inquiry_id text primary key references inquiries (id) on delete cascade,
  name       text not null,
  phone      text,
  email      text,
  message    text not null default ''
);

create table inquiry_replies (
  id            text primary key,
  inquiry_id    text not null references inquiries (id) on delete cascade,
  kind          text not null check (kind in ('available', 'sold_out', 'contact_me')),
  message       text,
  phone_shared  boolean not null default false,
  created_at    timestamptz not null default now()
);
create index inquiry_replies_inquiry_idx on inquiry_replies (inquiry_id);

create table inquiry_outcomes (
  inquiry_id  text primary key references inquiries (id) on delete cascade,
  outcome     text not null check (outcome in ('sale', 'new_potential_customer', 'no', 'still_discussing')),
  recorded_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Claims. The evidence text and the verifying administrator are private.
-- ---------------------------------------------------------------------------

create table claims (
  id                text primary key,
  farmer_profile_id text not null references farmer_profiles (id) on delete cascade,
  type              text not null check (type in ('snap_ebt', 'practice', 'licence', 'certification')),
  label             text not null,
  status            text not null check (status in ('farmer_reported', 'verified')),
  evidence_checked  text,
  verified_on       date,
  verified_by       text references users (id),
  created_at        timestamptz not null default now(),
  constraint verification_matches_status check (
    (status = 'verified' and evidence_checked is not null and verified_on is not null and verified_by is not null)
    or (status = 'farmer_reported' and evidence_checked is null and verified_on is null and verified_by is null)
  )
);
create index claims_farm_idx on claims (farmer_profile_id);

-- ---------------------------------------------------------------------------
-- Anonymous events. No person, session, device or address column exists.
-- The search term length limit comes from settings and is enforced by the writer.
-- ---------------------------------------------------------------------------

create table search_events (
  id                         text primary key,
  day                        date not null,
  terms                      text not null,
  matched_product_type_id    text references product_types (id),
  filters                    jsonb not null default '{}'::jsonb,
  community_id               text references communities (id),
  result_count               integer not null check (result_count >= 0)
);
create index search_events_day_idx on search_events (day);

create table preview_events (
  id          text primary key,
  day         date not null,
  target_kind text not null check (target_kind in ('pickup_location', 'farmers_market')),
  target_id   text not null,
  surface     text not null check (surface in ('map', 'list')),
  count       integer not null check (count >= 0)
);

create table aggregate_counts (
  id                 text primary key,
  metric             text not null check (metric in ('searches', 'zero_result_searches', 'inquiries', 'preview_opens')),
  period_start       date not null,
  period_end         date not null,
  product_type_id    text references product_types (id),
  community_id       text references communities (id),
  pickup_location_id text references pickup_locations (id),
  market_id          text references farmers_markets (id),
  count              integer not null check (count >= 0),
  check (period_end >= period_start)
);

-- ---------------------------------------------------------------------------
-- Reserved for later phases. Minimal columns, RLS on, no policy. Do not build on these yet.
-- ---------------------------------------------------------------------------

create table buyer_profiles (            -- reserved for a later phase
  id         text primary key,
  user_id    text not null references users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create table saved_listings (            -- reserved for a later phase
  id         text primary key,
  user_id    text not null references users (id) on delete cascade,
  product_id text not null references products (id) on delete cascade,
  created_at timestamptz not null default now()
);
create table purchasing_requests (       -- reserved for a later phase
  id                 text primary key,
  requester_user_id  text not null references users (id) on delete cascade,
  created_at         timestamptz not null default now()
);
create table food_access_programs (      -- reserved for a later phase
  id         text primary key,
  name       text not null,
  created_at timestamptz not null default now()
);
create table assistant_conversations (   -- reserved for a later phase
  id         text primary key,
  user_id    text references users (id) on delete cascade,
  created_at timestamptz not null default now()
);
comment on table buyer_profiles is 'Reserved for a later phase. Unused.';
comment on table saved_listings is 'Reserved for a later phase. Unused.';
comment on table purchasing_requests is 'Reserved for a later phase. Unused.';
comment on table food_access_programs is 'Reserved for a later phase. Unused.';
comment on table assistant_conversations is 'Reserved for a later phase. Unused.';

-- ---------------------------------------------------------------------------
-- Row-level security: on for every table. No policy exists except the four
-- public reference tables below. Everything else is closed to anon and
-- authenticated until the per-role policies of steps 6 and 7.
-- ---------------------------------------------------------------------------

alter table regions                       enable row level security;
alter table communities                   enable row level security;
alter table product_types                 enable row level security;
alter table settings                      enable row level security;
alter table users                         enable row level security;
alter table user_roles                    enable row level security;
alter table farmer_profiles               enable row level security;
alter table farm_public_locations         enable row level security;
alter table farm_private_locations        enable row level security;
alter table farmer_private_contacts       enable row level security;
alter table products                      enable row level security;
alter table product_availability          enable row level security;
alter table product_availability_history  enable row level security;
alter table product_quantities            enable row level security;
alter table farmers_markets               enable row level security;
alter table farmer_market_links           enable row level security;
alter table pickup_locations              enable row level security;
alter table farmer_pickup_options         enable row level security;
alter table inquiries                     enable row level security;
alter table inquiry_buyer_contacts        enable row level security;
alter table inquiry_replies               enable row level security;
alter table inquiry_outcomes              enable row level security;
alter table claims                        enable row level security;
alter table search_events                 enable row level security;
alter table preview_events                enable row level security;
alter table aggregate_counts              enable row level security;
alter table buyer_profiles                enable row level security;
alter table saved_listings                enable row level security;
alter table purchasing_requests           enable row level security;
alter table food_access_programs          enable row level security;
alter table assistant_conversations       enable row level security;

-- Wholly public reference data. No private column exists on these tables.
create policy regions_public_read       on regions       for select to anon, authenticated using (true);
create policy communities_public_read   on communities   for select to anon, authenticated using (true);
create policy product_types_public_read on product_types for select to anon, authenticated using (true);
create policy settings_public_read      on settings      for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- Public views. Owner-run (security_invoker = false) so they can read the
-- RLS-protected tables. They contain no private column: no street address, no
-- exact point unless show_exact_location, no phone unless show_phone, no email
-- unless show_email, no claim evidence, no buyer contact.
-- ---------------------------------------------------------------------------

-- A farm is public only when published AND consent is fully recorded.
create view public_farms with (security_invoker = false) as
select
  f.id,
  f.slug,
  f.farm_name,
  f.farmer_name,
  f.intro,
  f.story,
  f.photos,
  f.community_id,
  l.town,
  l.county,
  case when f.show_exact_location and pl.exact_point is not null
       then st_y(pl.exact_point::geometry) else st_y(l.coarse_point::geometry) end as lat,
  case when f.show_exact_location and pl.exact_point is not null
       then st_x(pl.exact_point::geometry) else st_x(l.coarse_point::geometry) end as lng,
  case when f.show_exact_location and pl.exact_point is not null
       then 'exact' else 'town_centre' end as location_precision,
  case when f.show_phone then c.phone end as phone,
  case when f.show_email then c.email end as email,
  f.open_to_wholesale,
  f.is_demo
from farmer_profiles f
join farm_public_locations l on l.farmer_profile_id = f.id
left join farm_private_locations pl on pl.farmer_profile_id = f.id
left join farmer_private_contacts c on c.farmer_profile_id = f.id
where f.publication_status = 'published'
  and f.consent_method is not null
  and f.consent_date is not null
  and f.consent_recorded_by is not null;

-- Stored availability is exposed as stored. The effective status (the lapse
-- rule) is applied by src/domain/availability, not duplicated here.
create view public_products with (security_invoker = false) as
select
  p.id,
  p.farmer_profile_id,
  p.product_type_id,
  p.title,
  p.description,
  p.photo,
  p.price_cents,
  p.selling_unit,
  p.unit_size_amount,
  p.unit_size_measure,
  p.licence_self_confirmed,
  p.is_demo,
  a.status              as availability_status,
  a.last_confirmed_at   as availability_last_confirmed_at,
  a.expected_month      as availability_expected_month,
  a.updated_at          as availability_updated_at,
  q.amount              as quantity_amount,
  q.unit                as quantity_unit,
  q.approximate         as quantity_approximate,
  q.last_confirmed_at   as quantity_last_confirmed_at
from products p
join public_farms f on f.id = p.farmer_profile_id
join product_availability a on a.product_id = p.id
left join product_quantities q on q.product_id = p.id
where p.moderation_status = 'visible';

create view public_claims with (security_invoker = false) as
select
  c.id,
  c.farmer_profile_id,
  c.type,
  c.label,
  c.status,
  c.verified_on
from claims c
join public_farms f on f.id = c.farmer_profile_id;

create view public_markets with (security_invoker = false) as
select
  m.id, m.slug, m.name, m.community_id, m.town,
  st_y(m.point::geometry) as lat,
  st_x(m.point::geometry) as lng,
  m.venue, m.schedule, m.season_note,
  m.contact_phone, m.contact_email, m.directions_url, m.is_demo
from farmers_markets m
where m.moderation_status = 'visible';

create view public_pickup_locations with (security_invoker = false) as
select
  p.id, p.slug, p.name, p.community_id, p.town,
  st_y(p.point::geometry) as lat,
  st_x(p.point::geometry) as lng,
  p.description, p.is_demo
from pickup_locations p
where p.moderation_status = 'visible';

-- An option that points at a hidden market or pickup location is dropped.
create view public_pickup_options with (security_invoker = false) as
select
  o.id,
  o.farmer_profile_id,
  o.kind,
  o.pickup_location_id,
  o.market_id,
  coalesce(m.name, pl.name) as name,
  coalesce(m.town, pl.town) as town,
  o.schedule,
  o.note
from farmer_pickup_options o
join public_farms f on f.id = o.farmer_profile_id
left join public_markets m on m.id = o.market_id
left join public_pickup_locations pl on pl.id = o.pickup_location_id
where o.kind = 'own_delivery'
   or (o.kind = 'farmers_market' and m.id is not null)
   or (o.kind = 'pickup_location' and pl.id is not null);

create view public_farm_markets with (security_invoker = false) as
select l.farmer_profile_id, l.market_id
from farmer_market_links l
join public_farms f on f.id = l.farmer_profile_id
join public_markets m on m.id = l.market_id;

-- ---------------------------------------------------------------------------
-- Privileges. Supabase grants broad table privileges to anon and
-- authenticated by default. Remove them all, then grant back only what the
-- public may read.
-- ---------------------------------------------------------------------------

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

grant select on regions, communities, product_types, settings to anon, authenticated;
grant select on
  public_farms, public_products, public_claims, public_markets,
  public_pickup_locations, public_pickup_options, public_farm_markets
  to anon, authenticated;
