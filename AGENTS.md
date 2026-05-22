this is a serverless game server that aims to replace traditional server

that have a lot of functions like use cloudflare r2 to store game hotfix etc

all functions can be modified from admin panel like disable useless function, upload game hotfix

admin panel (cloudflare pages) seprate with server(worker)


it should comptaible any type of game like fps/moba etc...

(FPS/MOBA/Custom presets exist only in the admin UI; applying a preset PATCHes feature flags. Backend and clients only see `features` via `/admin/platform` and `GET /api/platform`.)

Platform features: voice chat, text chat, hot updates, matchmaking, leaderboard, friends, player profile.

Platform data uses a single R2 bucket (`PLATFORM_BUCKET`): `admin/platform-state.json` for `{ features }` only, `game-updates/*` for hotfixes, `players/*` for profiles/friends, `leaderboards/*` for scores.

