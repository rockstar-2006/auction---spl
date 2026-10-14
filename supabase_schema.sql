-- ==============================================================================
-- SPL 2026: SUPABASE DATABASE SCHEMA & REALTIME REPLICATION CONFIGURATION
-- Run this script in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/rscldhbydkdppgrjsmde/sql
-- ==============================================================================

-- 1. AUCTION STATE TABLE
CREATE TABLE IF NOT EXISTS public.auction (
    id TEXT PRIMARY KEY DEFAULT 'current',
    status TEXT DEFAULT 'idle',
    current_player_id TEXT,
    current_player_name TEXT,
    current_bid BIGINT DEFAULT 1000,
    current_bidder_id TEXT,
    current_bidder_name TEXT,
    current_bidder_badge TEXT,
    timer_remaining INT DEFAULT 20,
    is_timer_running BOOLEAN DEFAULT FALSE,
    timer_end_time BIGINT,
    sold_count INT DEFAULT 0,
    unsold_count INT DEFAULT 0,
    total_players INT DEFAULT 0,
    auction_phase TEXT DEFAULT 'girls',
    announcement TEXT DEFAULT 'Welcome to SPL 2026 Live Auction',
    last_sold_player JSONB,
    last_updated BIGINT,
    data JSONB DEFAULT '{}'::jsonb
);

-- 2. TEAMS TABLE
CREATE TABLE IF NOT EXISTS public.teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    short_name TEXT,
    email TEXT,
    password TEXT,
    color TEXT,
    accent_color TEXT,
    badge TEXT,
    logo_url TEXT,
    purse_remaining BIGINT DEFAULT 100000,
    squad_size INT DEFAULT 0,
    max_squad_size INT DEFAULT 15,
    player_ids JSONB DEFAULT '[]'::jsonb,
    total_spent BIGINT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    data JSONB DEFAULT '{}'::jsonb
);

-- 3. PLAYERS TABLE
CREATE TABLE IF NOT EXISTS public.players (
    id TEXT PRIMARY KEY,
    serial_no TEXT,
    name TEXT NOT NULL,
    role TEXT,
    category TEXT,
    batting_style TEXT,
    bowling_style TEXT,
    contact TEXT,
    photo_url TEXT,
    base_price BIGINT DEFAULT 1000,
    current_bid BIGINT DEFAULT 1000,
    status TEXT DEFAULT 'waiting',
    auction_order INT DEFAULT 999,
    sold_to_team_id TEXT,
    sold_to_team_name TEXT,
    sold_price BIGINT,
    gender TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    data JSONB DEFAULT '{}'::jsonb
);

-- 4. BIDS TABLE
CREATE TABLE IF NOT EXISTS public.bids (
    id TEXT PRIMARY KEY,
    player_id TEXT,
    player_name TEXT,
    team_id TEXT,
    team_name TEXT,
    team_badge TEXT,
    amount BIGINT,
    timestamp BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    data JSONB DEFAULT '{}'::jsonb
);

-- 5. SETTINGS / ADMIN TABLE
CREATE TABLE IF NOT EXISTS public.settings (
    id TEXT PRIMARY KEY DEFAULT 'admin',
    email TEXT,
    password TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    data JSONB DEFAULT '{}'::jsonb
);

-- ------------------------------------------------------------------------------
-- ENABLE ROW LEVEL SECURITY (RLS) & PUBLIC POLICIES FOR SECURE ANONYMOUS ACCESS
-- ------------------------------------------------------------------------------
ALTER TABLE public.auction ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Allow full access to anon key so client dual-write and live reads work seamlessly
DROP POLICY IF EXISTS "Allow anon full access to auction" ON public.auction;
CREATE POLICY "Allow anon full access to auction" ON public.auction FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon full access to teams" ON public.teams;
CREATE POLICY "Allow anon full access to teams" ON public.teams FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon full access to players" ON public.players;
CREATE POLICY "Allow anon full access to players" ON public.players FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon full access to bids" ON public.bids;
CREATE POLICY "Allow anon full access to bids" ON public.bids FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon full access to settings" ON public.settings;
CREATE POLICY "Allow anon full access to settings" ON public.settings FOR ALL TO anon USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- ENABLE REALTIME REPLICATION FOR LIVE MULTI-DEVICE SYNC
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'auction'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.auction;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'teams'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'players'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'bids'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.bids;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'settings'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;
    END IF;
END $$;
