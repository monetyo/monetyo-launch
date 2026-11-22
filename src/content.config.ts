import { glob } from "astro/loaders"
import { z } from "astro/zod"
import { defineCollection } from "astro:content"

const TITLE_LIMIT = 60

const DESCRIPTION_LIMIT = 160

const searchTitle = () =>
  z
    .string()
    .max(
      TITLE_LIMIT,
      `Shorten it to ${TITLE_LIMIT} characters, which is what search results show.`
    )

const searchDescription = () =>
  z
    .string()
    .max(
      DESCRIPTION_LIMIT,
      `Shorten it to ${DESCRIPTION_LIMIT} characters, which is what search results show.`
    )

const link = () => z.object({ label: z.string(), href: z.string() })

const definitions = () =>
  z.array(z.object({ term: z.string(), description: z.string() }))

/** One collection per page, holding one YAML file per locale. */
const page = <T extends z.ZodRawShape>(name: string, shape: T) =>
  defineCollection({
    loader: glob({ pattern: "*.yaml", base: `./src/content/pages/${name}` }),
    schema: z.object({
      title: searchTitle(),
      description: searchDescription(),
      ...shape,
    }),
  })

const settings = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/settings" }),
  schema: z.object({
    siteName: z.string(),
    skipLink: z.string(),
    contactEmail: z.email(),
    header: z.object({
      homeLabel: z.string(),
      navLabel: z.string(),
      menuLabel: z.string(),
      cta: z.string(),
      nav: z.array(link()),
    }),
    languages: z.object({
      label: z.string(),
      names: z.object({
        en: z.string(),
        es: z.string(),
        ca: z.string(),
        it: z.string(),
      }),
    }),
    footer: z.object({
      copyright: z.string(),
      linksLabel: z.string(),
      links: z.array(link()),
    }),
    waitlist: z.object({
      emailLabel: z.string(),
      emailPlaceholder: z.string(),
      consent: z.string(),
      privacyLink: z.string(),
      submit: z.string(),
      sending: z.string(),
      noscript: z.string(),
      successHeading: z.string(),
      successBody: z.string(),
      errors: z.object({
        required: z.string(),
        email: z.string(),
        tooLong: z.string(),
        verification: z.string(),
        rateLimited: z.string(),
        generic: z.string(),
      }),
      notice: z.object({ heading: z.string(), items: definitions() }),
    }),
  }),
})

/** The colour each spending category has wherever it's shown. */
export const CATEGORIES = [
  "eatingOut",
  "groceries",
  "health",
  "home",
  "kids",
  "other",
  "transport",
] as const

/** The fills a person's or a shop's initial can sit on. */
export const TINTS = [
  "blue",
  "blueSoft",
  "coralSoft",
  "greenSoft",
  "ink",
  "lemonSoft",
  "peach",
  "sand",
] as const

/** A share of a bar, drawn as its width. */
const percent = () => z.number().min(0).max(100)

const category = () => z.enum(CATEGORIES)

const tint = () => z.enum(TINTS)
const source = () => z.enum(["bank", "file", "receipt", "hand"])

const headed = () => z.object({ heading: z.string(), body: z.string() })

/** A bar in a small chart: a label, its value as shown, and its length. */
const bar = () =>
  z.object({
    label: z.string(),
    value: z.string(),
    percent: percent(),
    highlight: z.boolean().default(false),
  })

const home = page("home", {
  hero: z.object({
    heading: z.array(z.string()).min(1),
    lead: z.string(),
  }),
  app: z.object({
    label: z.string(),
    household: z.string(),
    initials: z.string(),
    members: z.string(),
    nav: z.array(z.string()).length(6),
    sync: z.string(),
    title: z.string(),
    period: z.string(),
    people: z.array(z.object({ initial: z.string(), tint: tint() })),
    spent: z.object({
      label: z.string(),
      value: z.string(),
      of: z.string(),
      percent: percent(),
    }),
    stats: z.array(
      z.object({
        label: z.string(),
        value: z.string(),
        note: z.string(),
        positive: z.boolean().default(false),
      })
    ),
    budgets: z.object({
      heading: z.string(),
      more: z.string(),
      items: z.array(
        z.object({
          name: z.string(),
          category: category(),
          percent: percent(),
          note: z.string(),
          state: z.enum(["over", "paid", "within"]).default("within"),
        })
      ),
    }),
    latest: z.object({
      heading: z.string(),
      note: z.string(),
      items: z.array(
        z.object({
          initial: z.string(),
          tint: tint(),
          name: z.string(),
          detail: z.string(),
          amount: z.string(),
          converted: z.string().optional(),
        })
      ),
    }),
    assistant: z.object({
      heading: z.string(),
      question: z.string(),
      answer: z.object({ lead: z.string(), rest: z.string() }),
      bars: z.array(bar()),
      suggestions: z.array(z.string()),
      placeholder: z.string(),
    }),
  }),
  facts: z.object({
    label: z.string(),
    items: z.array(
      z.object({
        icon: z.enum(["eye", "globe", "shield", "unlock"]),
        text: z.string(),
      })
    ),
  }),
  ai: z.object({
    eyebrow: z.string(),
    heading: z.string(),
    lead: z.string(),
    ask: headed().extend({
      label: z.string(),
      question: z.string(),
      answer: z.object({ lead: z.string(), rest: z.string() }),
      bars: z.array(bar()),
      suggestions: z.array(z.string()),
    }),
    sort: headed().extend({
      label: z.string(),
      items: z.array(
        z.object({
          name: z.string(),
          raw: z.string(),
          category: category(),
          categoryName: z.string(),
          learned: z.string().optional(),
        })
      ),
    }),
    receipts: headed().extend({
      label: z.string(),
      receipt: z.object({
        store: z.string(),
        address: z.string(),
        lines: z.array(z.object({ item: z.string(), price: z.string() })),
        totalLabel: z.string(),
        total: z.string(),
      }),
      result: z.object({
        store: z.string(),
        amount: z.string(),
        splits: z.array(
          z.object({
            name: z.string(),
            category: category(),
            amount: z.string(),
          })
        ),
        meta: z.string(),
      }),
    }),
    insights: headed().extend({
      chart: z.object({
        title: z.string(),
        warning: z.string(),
        label: z.string(),
        budget: z.string(),
        today: z.string(),
        forecast: z.string(),
      }),
      notes: z.array(headed()),
    }),
  }),
  household: z.object({
    heading: z.string(),
    lead: z.string(),
    together: headed().extend({
      label: z.string(),
      title: z.string(),
      invite: z.string(),
      members: z.array(
        z.object({
          initial: z.string(),
          tint: tint(),
          name: z.string(),
          description: z.string(),
          role: z.string(),
          owner: z.boolean().default(false),
        })
      ),
    }),
    budgets: headed().extend({
      label: z.string(),
      items: z.array(
        z.object({
          kind: z.enum(["expense", "refund", "transfer"]),
          initial: z.string().optional(),
          name: z.string(),
          detail: z.string(),
          amount: z.string(),
        })
      ),
    }),
    sources: headed().extend({
      // The four ways in, and a list in the app where each one shows up.
      items: z
        .array(
          z.object({
            id: source(),
            name: z.string(),
            note: z.string(),
            badge: z.string(),
          })
        )
        .length(4),
      label: z.string(),
      title: z.string(),
      rows: z.array(
        z.object({
          source: source(),
          initial: z.string(),
          tint: tint(),
          name: z.string(),
          detail: z.string(),
          amount: z.string(),
        })
      ),
    }),
    currencies: headed().extend({
      from: z.object({ label: z.string(), amount: z.string() }),
      to: z.object({ label: z.string(), amount: z.string() }),
    }),
  }),
  roadmap: z.object({
    eyebrow: z.string(),
    heading: z.string(),
    lead: z.string(),
    steps: z.array(z.object({ title: z.string(), body: z.string() })),
    ideas: z.object({
      heading: z.string(),
      // The themes the board can be sorted by. "All" comes first and shows
      // every note at full strength.
      all: z.string(),
      filterLabel: z.string(),
      groups: z
        .array(
          z.object({
            id: z.enum(["family", "money", "everywhere", "power"]),
            label: z.string(),
          })
        )
        .min(1),
      items: z
        .array(
          z.object({
            group: z.enum(["family", "money", "everywhere", "power"]),
            icon: z.string(),
            title: z.string(),
            note: z.string(),
          })
        )
        .min(1),
      // The blank note at the end of the board, which leads to the sign-up.
      blank: z.object({ title: z.string(), note: z.string() }),
    }),
  }),
  status: z.object({
    heading: z.string(),
    items: z.array(
      z.object({ stage: z.string(), title: z.string(), body: z.string() })
    ),
    // What comes after the stages, shown apart from them.
    more: z.object({
      stage: z.string(),
      title: z.string(),
      body: z.string(),
      cta: z.string(),
    }),
  }),
  privacy: z.object({
    heading: z.string(),
    lead: z.string(),
    items: z.array(
      headed().extend({
        icon: z.enum(["download", "globe", "key", "lock", "shield", "trash"]),
        // Standards named in the body as `{id}`, each explained in a tooltip
        // for readers who don't know what it means.
        terms: z
          .array(
            z.object({ id: z.string(), label: z.string(), tip: z.string() })
          )
          .optional(),
      })
    ),
  }),
  team: z.object({
    eyebrow: z.string(),
    heading: z.string(),
    lead: z.string(),
    // The link's accessible name, with `{name}` for the person's.
    linkedin: z.string(),
    members: z
      .array(
        z.object({
          // Picks the person's illustrated portrait.
          id: z.enum(["joan", "luca", "susanna"]),
          name: z.string(),
          role: z.string(),
          bio: z.string(),
          owns: z.array(z.string()).min(1),
          url: z.url(),
        })
      )
      .min(1),
  }),
  faq: z.object({
    heading: z.string(),
    items: z.array(
      z.object({
        question: z.string(),
        // May hold links, and standards named as `{id}` with a tooltip.
        answer: z.string(),
        terms: z
          .array(
            z.object({ id: z.string(), label: z.string(), tip: z.string() })
          )
          .optional(),
      })
    ),
  }),
  join: z.object({
    heading: z.string(),
    lead: z.string(),
  }),
})

// Privacy, cookies, legal notice, security and AI content all read the same
// way: a date, an introduction, then sections of paragraphs and terms.
const legal = {
  updated: z.coerce.date(),
  updatedLabel: z.string().includes("{date}"),
  intro: z.string(),
  sections: z.array(
    z.object({
      heading: z.string(),
      body: z.union([z.string(), z.array(z.string()).min(1)]).optional(),
      items: definitions().optional(),
    })
  ),
}

const privacy = page("privacy", legal)
const cookies = page("cookies", legal)
const legalNotice = page("legal-notice", legal)
const security = page("security", legal)
const aiContent = page("ai-content", legal)

const confirm = page("confirm", {
  heading: z.string(),
  body: z.string(),
  button: z.string(),
  sending: z.string(),
  noscript: z.string(),
  successHeading: z.string(),
  successBody: z.string(),
  expiredHeading: z.string(),
  expiredBody: z.string(),
  genericError: z.string(),
  back: z.string(),
})

const unsubscribe = page("unsubscribe", {
  heading: z.string(),
  body: z.string(),
  button: z.string(),
  sending: z.string(),
  noscript: z.string(),
  successHeading: z.string(),
  successBody: z.string(),
  invalidHeading: z.string(),
  invalidBody: z.string(),
  genericError: z.string(),
  back: z.string(),
})

const notFound = page("not-found", {
  heading: z.string(),
  body: z.string(),
  back: z.string(),
})

// Read at request time by `api/`; a collection only so the build fails on a
// missing field rather than an email going out with a hole in it.
const email = (name: string, fields: string[]) =>
  defineCollection({
    loader: glob({ pattern: "*.yaml", base: `./src/content/emails/${name}` }),
    schema: z.object(
      Object.fromEntries(fields.map((field) => [field, z.string()]))
    ),
  })

const confirmationEmails = email("confirm", [
  "subject",
  "preheader",
  "heading",
  "body",
  "button",
  "fallback",
  "ignore",
  "unsubscribe",
])

// Sent to the whole list by `api/notify`.
const surveyEmails = email("survey", [
  "subject",
  "preheader",
  "heading",
  "body",
  "button",
  "fallback",
  "anonymity",
  "reason",
  "unsubscribe",
])

const inviteEmails = email("invite", [
  "subject",
  "preheader",
  "heading",
  "body",
  "button",
  "fallback",
  "feedback",
  "reason",
  "unsubscribe",
])

// The frame around a notice; its subject and body come from `notices/`.
const policyEmails = email("policy", [
  "preheader",
  "button",
  "fallback",
  "rights",
  "reason",
  "unsubscribe",
])

// Sent by `api/unsubscribe` once an address is deleted.
const deletionEmails = email("deletion", [
  "subject",
  "preheader",
  "heading",
  "body",
  "records",
  "rejoin",
])

export const collections = {
  aiContent,
  confirm,
  confirmationEmails,
  cookies,
  deletionEmails,
  home,
  inviteEmails,
  legalNotice,
  notFound,
  policyEmails,
  privacy,
  security,
  settings,
  surveyEmails,
  unsubscribe,
}
