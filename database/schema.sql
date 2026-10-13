-- VeilleRadar : structure privée préparatoire du SaaS.
-- Les identités sont validées uniquement par un futur backend serveur, non déployé ici.
-- Ne jamais exposer DATABASE_URL ni donner accès SQL depuis GitHub Pages.
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_auth_id text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro')),
  deleted_at timestamptz
);
CREATE TABLE IF NOT EXISTS watches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  url text NOT NULL CHECK (length(url) <= 2048),
  selector text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'page' CHECK (kind IN ('page','price','stock')),
  threshold numeric(12,2), enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_checked_at timestamptz, last_error text,
  last_hash text, last_value text, last_changed_at timestamptz
);
CREATE INDEX IF NOT EXISTS watches_customer_idx ON watches(customer_id,created_at DESC);
CREATE TABLE IF NOT EXISTS watch_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  watch_id uuid NOT NULL REFERENCES watches(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  change_type text NOT NULL CHECK (change_type IN ('changed','price_drop','back_in_stock')),
  summary text NOT NULL CHECK (length(summary) <= 500)
);
CREATE INDEX IF NOT EXISTS watch_events_customer_idx ON watch_events(customer_id,occurred_at DESC);
CREATE TABLE IF NOT EXISTS product_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  title text NOT NULL, product_identifier text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS product_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  list_id uuid NOT NULL REFERENCES product_lists(id) ON DELETE CASCADE,
  store_name text NOT NULL, url text NOT NULL,
  price_eur numeric(12,2) NOT NULL CHECK (price_eur>=0),
  shipping_eur numeric(12,2) NOT NULL DEFAULT 0 CHECK (shipping_eur>=0),
  verified_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_offers_owner_idx ON product_offers(customer_id,list_id);
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'stripe',
  provider_customer_id text UNIQUE, provider_subscription_id text UNIQUE,
  status text NOT NULL DEFAULT 'inactive',
  updated_at timestamptz NOT NULL DEFAULT now()
);
