# Pending migrations (not applied yet)

Prisma ignores this folder. A migration waits here when it must ship in a
**later deploy** than the code change it belongs to.

## 20261108000000_remove_gnw_play

Drops the GNW Play tables, enums and `User.playPoints`.

Why it waits: production and local dev share one database. The code deployed
before Play's removal reads `User.playPoints` on every user query (including
the per-request session check). If this ran in the same deploy, the old build
would keep serving against the dropped column during the new build, and every
request would fail.

**Deploy 1:** the branch with Play's code removed. The schema no longer lists
Play; the tables stay in the DB, and Prisma ignores them.

**Deploy 2:** once Deploy 1 is live in production,
1. `npm run db:backup`
2. `git mv prisma/pending-migrations/20261108000000_remove_gnw_play prisma/migrations/`
3. Commit and push. Vercel's build runs `prisma migrate deploy`.

The migration aborts on its own, before dropping anything, if Play data
appeared in the meantime. Delete this folder once it's empty.
