this is a serverless game server that aims to replace traditional server

that have a lot of functions like use cloudflare r2 to store game hotfix etc

all functions can be modified from admin panel like disable useless function, upload game hotfix

admin panel (cloudflare pages) seprate with server(worker)


it should comptaible any type of game like fps/moba etc...

(game type is just a named preset of enable / disable functions — admin panel only; clients read `GET /api/platform` → `{ features }` only)

Platform features: voice chat, text chat, hot updates, matchmaking.

Platform data uses a single R2 bucket (`PLATFORM_BUCKET`): `admin/platform-state.json` for live features + custom game types, and `game-updates/*` for hotfix assets.

