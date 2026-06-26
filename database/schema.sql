CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY,
    name text NOT NULL,
    email text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
);


CREATE TABLE IF NOT EXISTS households (
    id uuid PRIMARY KEY,
    owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS household_members (
    id uuid PRIMARY KEY,
    household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    name text NOT NULL,
    email text NOT NULL,
    role text NOT NULL CHECK (role IN ('owner', 'member')),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_households_owner ON households (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_household_members_household ON household_members (household_id);
CREATE TABLE IF NOT EXISTS categories (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    household_id uuid NULL,
    name text NOT NULL,
    color text NOT NULL,
    CONSTRAINT fk_categories_household FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS transactions (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind text NOT NULL CHECK (kind IN ('income', 'fixed_expense', 'variable_expense')),
    description text NOT NULL,
    amount numeric(14, 2) NOT NULL CHECK (amount > 0),
    category_id uuid NULL REFERENCES categories(id) ON DELETE SET NULL,
    occurred_at date NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS goals (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    household_id uuid NULL,
    kind text NOT NULL CHECK (kind IN ('saving', 'debt')),
    name text NOT NULL,
    target_amount numeric(14, 2) NOT NULL CHECK (target_amount > 0),
    current_amount numeric(14, 2) NOT NULL DEFAULT 0,
    CONSTRAINT fk_goals_household FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS predictable_incomes (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    description text NOT NULL,
    amount numeric(14, 2) NOT NULL CHECK (amount > 0),
    frequency text NOT NULL CHECK (frequency = 'monthly')
);


CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash text NOT NULL,
    expires_at timestamptz NOT NULL,
    used_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sync_queue (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity text NOT NULL,
    entity_id uuid NOT NULL,
    operation text NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
    status text NOT NULL CHECK (status IN ('pending', 'synced', 'failed')),
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text NULL;
ALTER TABLE household_members ADD COLUMN IF NOT EXISTS user_id uuid NULL;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS household_id uuid NULL;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS household_id uuid NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint constraint_info
        JOIN pg_attribute column_info
            ON column_info.attrelid = constraint_info.conrelid
            AND column_info.attnum = ANY (constraint_info.conkey)
        WHERE constraint_info.contype = 'f'
            AND constraint_info.conrelid = 'categories'::regclass
            AND constraint_info.confrelid = 'households'::regclass
            AND column_info.attname = 'household_id'
    ) THEN
        ALTER TABLE categories
            ADD CONSTRAINT fk_categories_household
            FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint constraint_info
        JOIN pg_attribute column_info
            ON column_info.attrelid = constraint_info.conrelid
            AND column_info.attnum = ANY (constraint_info.conkey)
        WHERE constraint_info.contype = 'f'
            AND constraint_info.conrelid = 'goals'::regclass
            AND constraint_info.confrelid = 'households'::regclass
            AND column_info.attname = 'household_id'
    ) THEN
        ALTER TABLE goals
            ADD CONSTRAINT fk_goals_household
            FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE SET NULL;
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_transactions_user_month ON transactions (user_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_categories_user ON categories (user_id);
CREATE INDEX IF NOT EXISTS idx_categories_household ON categories (household_id);
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals (user_id);
CREATE INDEX IF NOT EXISTS idx_goals_household ON goals (household_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens (user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_sync_queue_user_status ON sync_queue (user_id, status);


