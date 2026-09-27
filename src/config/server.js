// Single source of truth for the Sell Heaps More Society server.
// The provisioner reads this file and makes Discord match it. Re-running is safe:
// existing roles/channels are found by name and updated in place.

export const server = {
  name: 'Sell Heaps More Society',
  shortName: 'SHMS',
  tagline: 'Learn sales. Close more. Sell heaps more.',
  description:
    'A private sales room for Australian trade and service business owners, managers and salespeople. ' +
    'Bring real deals. Get practical coaching. Sell heaps more.',
};

// ---------------------------------------------------------------------------
// ROLES — listed top (most senior) to bottom. Order here = order in Discord.
// `perms` are role-level permissions on top of the @everyone baseline.
// ---------------------------------------------------------------------------
export const roles = [
  {
    key: 'founder',
    name: 'Founder',
    color: 0xf5b700,
    hoist: true,
    mentionable: false,
    perms: ['Administrator'],
  },
  {
    key: 'coach',
    name: 'Coach',
    color: 0xff5a1f,
    hoist: true,
    mentionable: true,
    perms: [
      'ManageMessages',
      'ManageThreads',
      'ManageEvents',
      'CreateEvents',
      'ManageNicknames',
      'ManageRoles', // assign Workshop / Private Coaching / Founding Member (only roles below Coach)
      'KickMembers',
      'BanMembers',
      'ModerateMembers', // timeouts
      'ViewAuditLog',
      'MentionEveryone',
      'CreateInstantInvite',
      'PinMessages',
      'MuteMembers',
      'DeafenMembers',
      'MoveMembers',
      'PrioritySpeaker',
      'SendPolls',
    ],
  },
  {
    key: 'foundingMember',
    name: 'Founding Member',
    color: 0x14b8a6,
    hoist: true,
    mentionable: false,
    perms: [],
  },
  {
    key: 'privateCoaching',
    name: 'Private Coaching',
    color: 0x8b5cf6,
    hoist: false,
    mentionable: false,
    perms: [],
  },
  {
    key: 'workshopMember',
    name: 'Workshop Member',
    color: 0x3b82f6,
    hoist: false,
    mentionable: false,
    perms: [],
  },
  {
    key: 'businessOwner',
    name: 'Business Owner',
    color: 0x22c55e,
    hoist: false,
    mentionable: false,
    perms: [],
  },
  {
    key: 'salesTeam',
    name: 'Sales Team',
    color: 0x94a3b8,
    hoist: false,
    mentionable: false,
    perms: [],
  },
  {
    // Opt-in ping role, picked during onboarding. Keeps clinic reminders from pinging everyone.
    key: 'clinicReminders',
    name: 'Clinic Reminders',
    color: 0x000000,
    hoist: false,
    mentionable: false, // the bot pings it; members can't
    perms: [],
  },
];

// What every member can do by default (@everyone). Invites are deliberately
// NOT included: only Founder/Coach can invite, which keeps the Society private.
export const everyonePerms = [
  'ViewChannel',
  'SendMessages',
  'SendMessagesInThreads',
  'CreatePublicThreads',
  'EmbedLinks',
  'AttachFiles',
  'ReadMessageHistory',
  'AddReactions',
  'UseExternalEmojis',
  'UseApplicationCommands',
  'ChangeNickname',
  'Connect',
  'Speak',
  'Stream',
  'UseVAD',
  'RequestToSpeak',
];

// ---------------------------------------------------------------------------
// ACCESS PRESETS — how each channel's permission overwrites are built.
//   open      : everyone can read and post (uses the @everyone baseline)
//   readonly  : everyone reads; only Founder/Coach post
//   staff     : Founder/Coach only
//   private   : Founder/Coach + Private Coaching role
// ---------------------------------------------------------------------------
export const accessPresets = {
  open: { everyone: { allow: [], deny: [] }, staff: { allow: [], deny: [] } },
  readonly: {
    everyone: {
      allow: [],
      deny: ['SendMessages', 'SendMessagesInThreads', 'CreatePublicThreads', 'CreatePrivateThreads'],
    },
    staff: { allow: ['SendMessages', 'SendMessagesInThreads', 'CreatePublicThreads'], deny: [] },
  },
  staff: {
    everyone: { allow: [], deny: ['ViewChannel', 'Connect'] },
    staff: { allow: ['ViewChannel', 'SendMessages', 'Connect'], deny: [] },
  },
  private: {
    everyone: { allow: [], deny: ['ViewChannel', 'Connect'] },
    staff: { allow: ['ViewChannel', 'SendMessages', 'Connect'], deny: [] },
    extraRoles: { privateCoaching: { allow: ['ViewChannel'], deny: [] } },
  },
};

// ---------------------------------------------------------------------------
// LAYOUT
// type: text | forum | voice
// content: markdown file(s) in /content posted into the channel (pinned if pin: true)
// posts: forum posts created from a library file in /content (one post per "# " heading)
// ---------------------------------------------------------------------------
export const categories = [
  {
    key: 'startHere',
    name: 'START HERE',
    access: 'open',
    channels: [
      {
        key: 'welcome',
        name: 'welcome',
        type: 'text',
        access: 'readonly',
        topic: 'More leads won’t fix a shit sales process. What the Society is, how it works, and the rules.',
        content: [{ file: 'welcome.md' }, { file: 'rules.md', pin: true }],
      },
      {
        key: 'startHereChannel',
        name: 'start-here',
        type: 'text',
        access: 'readonly',
        topic: 'Five steps to get value out of the Society in your first week. IMPLEMENT > CONSUME.',
        content: [{ file: 'start-here.md', pin: true }],
      },
      {
        key: 'introductions',
        name: 'introductions',
        type: 'text',
        access: 'open',
        topic: 'Copy the pinned template and introduce yourself. Numbers welcome, bullshit not.',
        slowmode: 60,
        content: [{ file: 'introductions.md', pin: true }],
      },
      {
        key: 'announcements',
        name: 'announcements',
        type: 'text',
        access: 'readonly',
        topic: 'Coaching sessions, workshops, new training and important updates. Founder/Coach posts only.',
        content: [{ file: 'announcements.md' }],
      },
    ],
  },
  {
    key: 'salesFloor',
    name: 'THE SALES FLOOR',
    access: 'open',
    channels: [
      {
        key: 'helpMeCloseThis',
        name: 'help-me-close-this',
        type: 'forum',
        access: 'open',
        topic: 'forum/help-me-close-this.md',
        tags: ['New lead', 'Site visit done', 'Quote sent', 'Negotiating', 'Gone quiet', 'Won 🏆', 'Lost'],
        guidePost: { title: '📌 READ FIRST — How to post a deal', file: 'guides/help-me-close-this.md' },
      },
      {
        key: 'salesQuestions',
        name: 'sales-questions',
        type: 'text',
        access: 'open',
        topic: 'General sales questions. Answers must be practical: what would you actually say or do?',
        content: [{ file: 'sales-questions.md', pin: true }],
      },
      {
        key: 'objectionClinic',
        name: 'objection-clinic',
        type: 'forum',
        access: 'open',
        topic: 'forum/objection-clinic.md',
        tags: ['Price', 'Cheaper quote', 'Need to think', 'Decision maker', 'Just email it', 'Brush-off', 'Other'],
        guidePost: { title: '📌 READ FIRST — How to post an objection', file: 'guides/objection-clinic.md' },
      },
      {
        key: 'followUp',
        name: 'follow-up',
        type: 'text',
        access: 'open',
        topic: 'Leads and quotes that have gone quiet. Post the situation, get your next message.',
        content: [{ file: 'follow-up.md', pin: true }],
      },
      {
        key: 'reviewMyPitch',
        name: 'review-my-pitch',
        type: 'forum',
        access: 'open',
        topic: 'forum/review-my-pitch.md',
        tags: ['Email', 'SMS', 'Phone script', 'Proposal / quote', 'Call recording', 'Video', 'Website / ad'],
        guidePost: { title: '📌 READ FIRST — How to get useful feedback', file: 'guides/review-my-pitch.md' },
      },
      {
        key: 'lostDeals',
        name: 'lost-deals',
        type: 'forum',
        access: 'open',
        topic: 'forum/lost-deals.md',
        tags: ['Price', 'Follow-up', 'Qualification', 'Competitor', 'Timing', 'Trust', 'No idea'],
        guidePost: { title: '📌 READ FIRST — Why we post lost deals', file: 'guides/lost-deals.md' },
      },
      {
        key: 'wins',
        name: 'wins',
        type: 'text',
        access: 'open',
        topic: 'Post your wins with the lesson attached. Screenshots welcome — blur customer details first.',
        content: [{ file: 'wins.md', pin: true }],
      },
    ],
  },
  {
    key: 'playbook',
    name: 'SELL HEAPS MORE PLAYBOOK',
    access: 'readonly',
    channels: [
      {
        key: 'theFramework',
        name: 'the-framework',
        type: 'text',
        access: 'readonly',
        topic: 'INTRIGUE → PAIN → EMPATHY → ANTIDOTE → ACTION. The Sell Heaps More framework, with trade examples.',
        content: [{ file: 'playbook/framework.md' }],
      },
      {
        key: 'scriptsAndTemplates',
        name: 'scripts-and-templates',
        type: 'forum',
        access: 'readonly',
        topic: 'forum/scripts-and-templates.md',
        tags: [
          'Cold call',
          'Lead response',
          'Qualifying',
          'Site visit',
          'Quote presentation',
          'Follow-up',
          'Closing',
          'Reactivation',
          'Referrals & reviews',
        ],
        posts: 'playbook/scripts.md',
      },
      {
        key: 'objectionPlaybook',
        name: 'objection-playbook',
        type: 'forum',
        access: 'readonly',
        topic: 'forum/objection-playbook.md',
        tags: ['Price', 'Stall', 'Decision maker', 'Competitor', 'Brush-off'],
        posts: 'playbook/objections.md',
      },
      {
        key: 'followUpPlaybook',
        name: 'follow-up-playbook',
        type: 'text',
        access: 'readonly',
        topic: 'The Sell Heaps More follow-up system, from new enquiry to old database reactivation. Read top to bottom.',
        content: [{ file: 'playbook/follow-up-system.md' }],
      },
    ],
  },
  {
    key: 'numbers',
    name: 'THE NUMBERS',
    access: 'open',
    channels: [
      {
        key: 'scoreboard',
        name: 'scoreboard',
        type: 'text',
        access: 'open',
        topic: 'Weekly scorecard. Copy the pinned template every Friday. What gets measured gets sold.',
        content: [{ file: 'scoreboard.md', pin: true }],
      },
      {
        key: 'salesNumbers',
        name: 'sales-numbers',
        type: 'text',
        access: 'open',
        topic: 'Close rate, quote conversion, average sale, revenue per lead, pipeline, sales capacity.',
        content: [{ file: 'sales-numbers.md', pin: true }],
      },
    ],
  },
  {
    key: 'coaching',
    name: 'COACHING',
    access: 'open',
    channels: [
      {
        key: 'coachingCalendar',
        name: 'coaching-calendar',
        type: 'text',
        access: 'readonly',
        topic: 'Weekly Sales Clinics, workshops, guest sessions and events. Click "Events" at the top of the channel list to RSVP.',
        content: [{ file: 'coaching-calendar.md', pin: true }],
      },
      {
        key: 'submitAQuestion',
        name: 'submit-a-question',
        type: 'text',
        access: 'open',
        topic: 'Drop the deal, objection or question you want covered at the next Sales Clinic.',
        content: [{ file: 'submit-a-question.md', pin: true }],
      },
      {
        key: 'salesClinic',
        name: 'Sell Heaps More Sales Clinic',
        type: 'voice',
        access: 'open',
      },
      {
        key: 'workshopRoom',
        name: 'Workshop Room',
        type: 'voice',
        access: 'open',
      },
    ],
  },
  {
    key: 'society',
    name: 'SOCIETY',
    access: 'open',
    channels: [
      {
        key: 'general',
        name: 'general',
        type: 'text',
        access: 'open',
        topic: 'Business, sales and community chat that doesn’t fit anywhere else.',
      },
      {
        key: 'resources',
        name: 'resources',
        type: 'text',
        access: 'open',
        topic: 'Useful books, podcasts, videos, software and tools. Say why it’s good. No self-promo.',
        content: [{ file: 'resources.md', pin: true }],
      },
      {
        key: 'offTopic',
        name: 'off-topic',
        type: 'text',
        access: 'open',
        topic: 'Footy, fishing, utes, dogs, whatever. Be decent.',
      },
    ],
  },
  {
    key: 'privateCoachingHub',
    name: 'PRIVATE COACHING',
    access: 'private',
    channels: [
      {
        key: 'coachingHub',
        name: 'coaching-hub',
        type: 'text',
        access: 'private',
        topic: 'Shared space for all private coaching clients: bookings, session notes format, resources. No client-specific numbers here — use your business’s private category.',
        content: [{ file: 'coaching-hub.md', pin: true }],
      },
    ],
  },
  {
    key: 'staff',
    name: 'STAFF',
    access: 'staff',
    channels: [
      {
        key: 'modLog',
        name: 'mod-log',
        type: 'text',
        access: 'staff',
        topic: 'AutoMod alerts, member reports, joins/leaves and bans. Founder/Coach only.',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// PER-CLIENT PRIVATE CATEGORY — the repeatable structure for private coaching.
// Created with `/client-room create` (or listed in privateClients below).
// ---------------------------------------------------------------------------
export const clientRoomTemplate = {
  categoryName: (business) => `${business.toUpperCase()} — PRIVATE`,
  roleName: (business) => `Client · ${business}`,
  channels: [
    {
      name: 'coaching-chat',
      topic: 'Day-to-day coaching communication between your team and your coach.',
      intro: 'client/coaching-chat.md',
    },
    {
      name: 'pipeline',
      topic: 'Current opportunities: what’s live, what it’s worth, what’s the next step.',
      intro: 'client/pipeline.md',
    },
    {
      name: 'deal-review',
      topic: 'Specific deals that need detailed help. One thread per deal.',
      intro: 'client/deal-review.md',
    },
    {
      name: 'numbers',
      topic: 'Private KPI tracking. Leads, quotes, close rate, revenue — week by week.',
      intro: 'client/numbers.md',
    },
  ],
};

// Businesses to pre-create private categories for when running the provisioner.
// Usually you'll use `/client-room create` in Discord instead.
export const privateClients = [
  // "Andy's Tiling",
];

// ---------------------------------------------------------------------------
// ONBOARDING — Discord's native onboarding questions (shown when someone joins).
// ---------------------------------------------------------------------------
export const onboarding = {
  prompts: [
    {
      title: 'What best describes you?',
      singleSelect: true,
      required: true,
      options: [
        {
          title: 'Business owner / manager',
          description: 'I own or run the business',
          emoji: '🧰',
          roles: ['businessOwner'],
        },
        {
          title: 'Sales team',
          description: 'I sell for a business in the Society',
          emoji: '📞',
          roles: ['salesTeam'],
        },
      ],
    },
    {
      title: 'Want a heads-up before each live Sales Clinic?',
      singleSelect: true,
      required: false,
      options: [
        {
          title: 'Yes, ping me',
          description: 'Reminder the day before and an hour before',
          emoji: '🔔',
          roles: ['clinicReminders'],
        },
        {
          title: 'No thanks',
          description: 'I’ll check #coaching-calendar myself',
          emoji: '🔕',
          roles: [],
        },
      ],
    },
  ],
  // Channels every new member sees straight away (Discord requires 7+, 5+ postable).
  defaultChannels: [
    'welcome',
    'startHereChannel',
    'introductions',
    'announcements',
    'helpMeCloseThis',
    'salesQuestions',
    'objectionClinic',
    'followUp',
    'reviewMyPitch',
    'lostDeals',
    'wins',
    'theFramework',
    'scriptsAndTemplates',
    'objectionPlaybook',
    'followUpPlaybook',
    'scoreboard',
    'salesNumbers',
    'coachingCalendar',
    'submitAQuestion',
    'salesClinic',
    'workshopRoom',
    'general',
    'resources',
    'offTopic',
  ],
};

// ---------------------------------------------------------------------------
// MODERATION — Discord AutoMod rules. Founder/Coach are exempt from all rules.
// ---------------------------------------------------------------------------
export const automod = [
  {
    name: 'SHMS — Spam',
    trigger: 'spam',
  },
  {
    name: 'SHMS — Mention spam',
    trigger: 'mentionSpam',
    mentionLimit: 5,
    blockMessage: 'Easy on the mentions. Tag the people you actually need.',
  },
  {
    name: 'SHMS — Slurs & sexual content',
    trigger: 'preset',
    presets: ['Slurs', 'SexualContent'],
    blockMessage: 'That message was blocked. Keep it professional enough that you’d say it in front of a client.',
  },
  {
    name: 'SHMS — Invite links & scams',
    trigger: 'keyword',
    regexPatterns: [
      'discord(?:app)?\\.(?:gg|com/invite|me)/\\S+',
      '(?:free|claim)\\s+(?:discord\\s+)?nitro',
      'steam\\s*community\\S*gift',
    ],
    keywords: ['*nitro gift*', '*airdrop*', 'dm me for *crypto*', '*onlyfans*'],
    blockMessage:
      'Invite links and promo aren’t allowed here (Rule 5). If you think this was a mistake, message a Coach.',
  },
];
