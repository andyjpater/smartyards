// Offline checks against Discord's limits, so mistakes show up before touching the server.
import {
  automod,
  categories,
  clientRoomTemplate,
  everyonePerms,
  onboarding,
  roles,
} from '../config/server.js';
import { allChannels, bits, buildOverwrites, roleByKey } from '../lib/layout.js';
import { parseLibrary, readContent, render, renderMessages } from '../lib/content.js';

// Fake IDs so content can be rendered without a live server.
export function fakeContext() {
  const ctx = { channels: {}, roles: {} };
  allChannels().forEach((c, i) => (ctx.channels[c.key] = String(1000 + i)));
  roles.forEach((r, i) => (ctx.roles[r.key] = String(2000 + i)));
  return ctx;
}

export function validate() {
  const errors = [];
  const check = (cond, msg) => cond || errors.push(msg);
  const ctx = fakeContext();
  const roleIds = { everyone: '1', ...ctx.roles };

  bits(everyonePerms);
  const roleKeys = new Set();
  for (const r of roles) {
    check(!roleKeys.has(r.key), `Duplicate role key ${r.key}`);
    roleKeys.add(r.key);
    bits(r.perms);
  }
  check(!everyonePerms.includes('CreateInstantInvite'), '@everyone must not be able to create invites (private server)');

  const keys = new Set();
  const channels = allChannels();
  for (const cat of categories) {
    buildOverwrites(cat.access, 'category', roleIds);
    check(cat.name.length <= 100, `Category name too long: ${cat.name}`);
  }
  for (const ch of channels) {
    check(!keys.has(ch.key), `Duplicate channel key ${ch.key}`);
    keys.add(ch.key);
    buildOverwrites(ch.access, ch.type, roleIds);
    if (ch.type !== 'voice') {
      check(/^[a-z0-9-]{1,100}$/.test(ch.name), `Channel name "${ch.name}" must be lowercase-with-dashes`);
    }
    try {
      if (ch.type === 'text' && ch.topic) check(ch.topic.length <= 1024, `#${ch.name} topic over 1024 chars`);
      if (ch.type === 'forum') {
        const topic = render(readContent(ch.topic), ctx);
        check(topic.length <= 4096, `#${ch.name} post guidelines over 4096 chars`);
        check(ch.tags.length <= 20, `#${ch.name} has more than 20 tags`);
        for (const t of ch.tags) check(t.length <= 20, `#${ch.name} tag "${t}" over 20 chars`);
        if (ch.guidePost) {
          const body = render(readContent(ch.guidePost.file), ctx);
          check(body.length <= 2000, `#${ch.name} guide post is ${body.length} chars (limit 2000)`);
          check(ch.guidePost.title.length <= 100, `#${ch.name} guide title too long`);
        }
        if (ch.posts) {
          const posts = parseLibrary(ch.posts, ctx);
          check(posts.length > 0, `#${ch.name} library ${ch.posts} has no posts`);
          const titles = new Set();
          for (const p of posts) {
            check(!titles.has(p.title), `#${ch.name} duplicate post title "${p.title}"`);
            titles.add(p.title);
            for (const t of p.tags) check(ch.tags.includes(t), `#${ch.name} post "${p.title}" uses unknown tag "${t}"`);
          }
        }
      }
      for (const item of ch.content ?? []) renderMessages(item.file, ctx);
    } catch (err) {
      errors.push(`#${ch.name}: ${err.message}`);
    }
  }

  for (const def of clientRoomTemplate.channels) {
    try {
      renderMessages(def.intro, ctx);
    } catch (err) {
      errors.push(`client room #${def.name}: ${err.message}`);
    }
  }

  // Discord onboarding: at least 7 default channels, 5 of which @everyone can post in.
  const defaults = onboarding.defaultChannels.map((k) => channels.find((c) => c.key === k));
  check(defaults.every(Boolean), 'Onboarding references an unknown channel key');
  check(defaults.length >= 7, 'Onboarding needs at least 7 default channels');
  const postable = defaults.filter((c) => c && c.access === 'open' && c.type === 'text');
  check(postable.length >= 5, 'Onboarding needs at least 5 default channels members can post in');
  check(
    defaults.every((c) => !c || ['open', 'readonly'].includes(c.access)),
    'Onboarding default channels must be visible to @everyone',
  );
  for (const p of onboarding.prompts) {
    check(p.title.length <= 100, `Onboarding prompt title too long: ${p.title}`);
    for (const o of p.options) {
      check(o.title.length <= 50, `Onboarding option title too long: ${o.title}`);
      check((o.description ?? '').length <= 100, `Onboarding option description too long: ${o.title}`);
      for (const k of o.roles) {
        roleByKey(k);
        check(roleByKey(k).perms.length === 0, `Onboarding can't hand out role "${k}" (it has permissions)`);
      }
    }
  }

  for (const rule of automod) {
    check((rule.blockMessage ?? '').length <= 150, `AutoMod "${rule.name}" block message over 150 chars`);
    for (const re of rule.regexPatterns ?? []) check(re.length <= 260, `AutoMod regex too long: ${re}`);
  }

  if (errors.length) throw new Error(`Config problems:\n  - ${errors.join('\n  - ')}`);
}

export function printPlan() {
  console.log('Sell Heaps More Society — planned layout (config is valid)\n');
  console.log('ROLES (top → bottom)');
  for (const r of roles) {
    console.log(`  ${r.name.padEnd(18)} ${r.perms.length ? r.perms.join(', ') : '(badge / access only)'}`);
  }
  console.log('\nCHANNELS');
  for (const cat of categories) {
    console.log(`  📁 ${cat.name}  [${cat.access}]`);
    for (const ch of cat.channels) {
      const icon = { text: '#', forum: '🗂️', voice: '🔊' }[ch.type];
      const extra = ch.type === 'forum' ? `  tags: ${ch.tags.join(' · ')}` : '';
      console.log(`     ${icon} ${ch.name.padEnd(30)} [${ch.access}]${extra}`);
    }
  }
  console.log(`\n  📁 <BUSINESS> — PRIVATE  (per client, via /client-room create)`);
  for (const ch of clientRoomTemplate.channels) console.log(`     # ${ch.name}`);
  console.log('\nONBOARDING');
  for (const p of onboarding.prompts) {
    console.log(`  ? ${p.title}`);
    for (const o of p.options) console.log(`      ${o.emoji} ${o.title} → ${o.roles.map((k) => roleByKey(k).name).join(', ') || '—'}`);
  }
  console.log('\nAUTOMOD');
  for (const rule of automod) console.log(`  • ${rule.name}`);
}
