-- Web3 (Sign-In-With-Ethereum) users authenticate with a wallet signature and
-- have no email. The handle_new_user() trigger already null-guards full_name and
-- passes new.email straight through, so the only blocker to a wallet-only signup
-- is the NOT NULL on profiles.email. Drop it. The unique index stays: Postgres
-- treats NULLs as distinct, so any number of wallet-only profiles coexist while
-- real email addresses remain unique.
alter table public.profiles alter column email drop not null;
