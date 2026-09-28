# Sell Heaps More Society — Discord

**Learn sales. Close more. Sell heaps more.**

This repo builds and runs the private **Sell Heaps More Society (SHMS)** Discord server:

- **`npm run provision`** makes a Discord server match the spec: roles, categories, channels, permissions, forum tags, pinned templates, the full Playbook content, AutoMod, Community settings and onboarding questions. It's safe to re-run: it updates in place and never duplicates.
- **`npm run bot`** runs the automations: new member welcome, weekly scoreboard reminder, weekly Sales Clinic events + reminders, moderation log, *Report to Coaches* and `/client-room` for private coaching.

Everything members read lives in [`content/`](content) as plain Markdown. Everything structural lives in [`src/config/server.js`](src/config/server.js). Edit either, re-run `npm run provision`, done.

---

## The server

```
START HERE
  # welcome              read-only  philosophy + pinned rules (Discord "rules channel")
  # start-here           read-only  5-step onboarding, IMPLEMENT > CONSUME
  # introductions        open       pinned intro template (60s slowmode)
  # announcements        read-only  Founder/Coach only
THE SALES FLOOR  ← the heart of the server
  🗂️ help-me-close-this  forum      one post per live deal, stage tags, pinned guide
  # sales-questions      open
  🗂️ objection-clinic    forum      one post per objection, objection-type tags
  # follow-up            open       pinned template, reply in threads
  🗂️ review-my-pitch     forum      email / SMS / script / proposal / call tags
  🗂️ lost-deals          forum      loss-reason tags
  # wins                 open       pinned win template
SELL HEAPS MORE PLAYBOOK  (read-only)
  # the-framework        INTRIGUE → PAIN → EMPATHY → ANTIDOTE → ACTION, trade examples
  🗂️ scripts-and-templates  12 short scripts, tagged + searchable
  🗂️ objection-playbook     9 core objections, one post each, searchable
  # follow-up-playbook   10-stage follow-up system
THE NUMBERS
  # scoreboard           pinned weekly scorecard, bot reminder every Friday
  # sales-numbers
COACHING
  # coaching-calendar    read-only, clinic reminders post here
  # submit-a-question
  🔊 Sell Heaps More Sales Clinic   weekly events created automatically
  🔊 Workshop Room
SOCIETY
  # general  # resources  # off-topic
PRIVATE COACHING  (Founder, Coach, Private Coaching only)
  # coaching-hub         shared logistics for all private clients, no client numbers
STAFF  (Founder, Coach only)
  # mod-log              AutoMod alerts, reports, joins/leaves, bans

<BUSINESS> — PRIVATE     one per coaching client, via /client-room create
  # coaching-chat  # pipeline  # deal-review  # numbers
```

**Why forums?** The brief asks for one thread per deal in `#help-me-close-this`, `#objection-clinic`, `#lost-deals` and `#review-my-pitch`. Discord forum channels force exactly that: every post *is* a thread, the template shows in the post guidelines, and tags make the channel filterable (e.g. show every *Won 🏆* deal, or every *Price* objection). The Playbook libraries are forums for the same reason. Members can search "think about it" and land on the right answer mid-call.

**Why a STAFF channel?** Moderation logging needs somewhere private to go, and Discord's Community mode (required for forums and onboarding) needs a private updates channel. It's invisible to members.

### Roles

| Role | Who | How they get it |
|---|---|---|
| **Founder** | You | Assign manually. Full admin. |
| **Coach** | Coaches | Assign manually. Moderate, pin, manage threads/events, timeout/kick/ban, assign the roles below. |
| **Founding Member** | Original members + beta businesses | Coach assigns. Hoisted badge. |
| **Private Coaching** | 1:1 clients | `/client-room create … member:` adds it, or Coach assigns. |
| **Workshop Member** | Completed a workshop | Coach assigns. |
| **Business Owner** | Owners / managers | Member picks it in onboarding. |
| **Sales Team** | Salespeople | Member picks it in onboarding. |
| **Clinic Reminders** | Opt-in ping for live sessions | Member picks it in onboarding / *Channels & Roles*. |
| **Client · \<Business\>** | One per private client | Created by `/client-room`. Unlocks that business's private category only. |

Earned/paid roles (Founding, Private Coaching, Workshop) are never self-assignable. Members only choose what describes them.

### Permissions in a sentence
Everyone can read everything public and post in the Sales Floor, Numbers and Society channels. Only Founder/Coach can post in `#welcome`, `#start-here`, `#announcements`, the Playbook and `#coaching-calendar`. **Only Founder/Coach can create invite links**, which is what keeps the Society private. Nobody can `@everyone` except Founder/Coach.

### Automations (the bot)
| What | When | Where |
|---|---|---|
| Welcome + point to `#start-here` then `#introductions` | Member joins | `#general` |
| Scoreboard reminder | Fridays 3pm (configurable) | `#scoreboard` |
| Weekly Sales Clinic event | Kept 2 weeks ahead, Tuesdays 12pm (configurable) | Server Events → Sales Clinic voice room |
| Reminder before **any** scheduled event (clinics, workshops, guest sessions) | 24h and 1h before, pings **Clinic Reminders** | `#coaching-calendar` |
| Join/leave/ban log (flags accounts under 7 days old) | As it happens | `#mod-log` |
| **Report to Coaches**: right-click any message → Apps | Member reports | `#mod-log` |
| `/client-room create business: member:` | Coach runs it | Builds `<BUSINESS> — PRIVATE` with 4 channels |

### Moderation (deliberately light)
- **AutoMod**: Discord's spam filter; mention spam (5+ mentions → blocked + 10 min timeout); slurs & sexual content; Discord invite links + common scam phrases. Founder/Coach are exempt. Every hit is logged to `#mod-log`. Profanity is *not* filtered: "a shit sales process" is on-brand.
- **New-member protections**: verification level *Medium* (verified email, account older than 5 min), explicit media filter on for everyone, 60s slowmode on `#introductions`, new accounts flagged in `#mod-log`.
- **Notifications** default to *mentions only* so members aren't buzzed into muting the server.

---

## Setup (about 15 minutes)

### 1. Create the server and the bot
1. In Discord: **+ → Create My Own → For a club or community**. Name it anything (the provisioner renames it).
2. Go to <https://discord.com/developers/applications> → **New Application** → call it `SHMS Bot`.
3. **Bot** tab → **Reset Token** → copy it. Turn on **Server Members Intent**.
4. **OAuth2 → URL Generator** → scopes `bot` + `applications.commands` → permission **Administrator** → open the URL and add the bot to your server.
   *(Administrator is needed to set up channel permissions and Community mode. The bot's role must stay at the top of the role list.)*
5. In Discord, turn on **Settings → Advanced → Developer Mode**, then right-click the server icon → **Copy Server ID**.

### 2. Configure and run
```bash
npm install
cp .env.example .env        # paste DISCORD_TOKEN, DISCORD_CLIENT_ID (app ID), DISCORD_GUILD_ID
                            # set TIMEZONE, clinic day/time and scoreboard day/time
npm run plan                # validates everything offline and prints the layout
npm run provision           # builds the server (safe to re-run any time)
npm run commands            # registers /client-room and "Report to Coaches"
npm run bot                 # starts the automations (keep this running)
```

Discord's default `#general` gets adopted and moved into SOCIETY. Delete the leftover empty *Text Channels* / *Voice Channels* categories and the default *General* voice channel.

**No terminal? Run it from GitHub instead.**
1. On GitHub open the repo → **Settings → Secrets and variables → Actions → New repository secret**, and add `DISCORD_TOKEN`, `DISCORD_CLIENT_ID` and `DISCORD_GUILD_ID`.
2. Go to the **Actions** tab → **Provision Discord server** → **Run workflow**.
3. Watch it run (about 2–3 minutes). Re-run it any time you change `content/` or the config. It finds its earlier posts and edits them rather than duplicating.

This builds the server and registers the commands. The always-on bot (welcome, reminders) still needs a host. See step 4.

### 3. Finish in Discord (things the API can't do)
1. **Give yourself Founder**, and give your coaches **Coach**. Tag your beta businesses **Founding Member**.
2. **Server Settings → Onboarding → Server Guide**: turn it on, then add:
   - Welcome message: *"More leads won't fix a shit sales process. This is where you bring real deals and learn how to close them."*
   - New member to-dos: **Introduce yourself** → `#introductions` · **Post a real deal** → `#help-me-close-this` · **Read the framework** → `#the-framework` · **Post your numbers** → `#scoreboard`
   - Resource pages: `#start-here`, `#the-framework`, `#scripts-and-templates`, `#objection-playbook`
3. **Server Settings → Onboarding → Safety Setup**: turn on **Rules Screening** and paste the six rules, so members accept them before posting.
4. **Server Settings → Overview**: upload the Sell Heaps More logo and banner.
5. **Invites**: create one invite link per intake (set expiry and max uses) so you know who came from where.

### 4. Keep the bot running
Any always-on Node 20+ host works: a small VPS with `pm2 start "npm run bot" --name shms`, Railway, Render or Fly.io. It needs the `.env` values and a persistent `data/` folder (it remembers which reminders it's already sent).

---

## Running the Society

**New private coaching client**
```
/client-room create business: Andy's Tiling member: @Andy
```
Creates **ANDY'S TILING — PRIVATE** (`#coaching-chat`, `#pipeline`, `#deal-review`, `#numbers`) and a `Client · Andy's Tiling` role, and gives Andy that role plus **Private Coaching**. Run it again with another `member:` to add their sales staff. Other clients can't see it.

**Workshops, guest sessions, special training**: create a Discord Event (**Events → Create Event**, pick 🔊 Workshop Room). The bot reminds opted-in members 24h and 1h before automatically.

**Promoting great answers into the Playbook**: when an answer in `#objection-clinic` or `#review-my-pitch` is gold, add it to `content/playbook/objections.md` or `scripts.md` and re-run `npm run provision`. Each `# Heading` becomes a forum post; the `tags:` line picks its tags.

**Changing any wording**: edit the Markdown in `content/`, run `npm run plan` to check it fits Discord's limits, then `npm run provision`. Existing messages are edited in place.
- `{#channelKey}` becomes a clickable channel link (keys are in `src/config/server.js`)
- `<!-- split -->` starts a new Discord message (2,000-character limit per message)

**Adding channels later** (industry rooms, sales leaders, regional groups, mastermind tiers): add them to `src/config/server.js` and re-run. Resist doing this until the existing channels are busy.

---

## Development
```bash
npm test        # config limits, permissions, schedules, full provisioning run against a fake server
npm run plan    # offline validation + layout printout
```

| Path | What |
|---|---|
| `src/config/server.js` | Roles, permissions, categories, channels, onboarding, AutoMod |
| `content/` | Every message members read |
| `src/provision/` | Provisioner + offline validator |
| `src/bot/` | Automations and commands |
| `src/lib/` | Shared helpers (content rendering, permissions, client rooms, schedules) |
| `data/` | Local state: IDs of posted messages, sent reminders (git-ignored) |
