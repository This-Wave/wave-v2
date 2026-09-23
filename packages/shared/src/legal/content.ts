/**
 * The terms of service and privacy policy, as data.
 *
 * These live in `@wave/shared` rather than next to either app because both apps
 * publish them: the Expo web build writes static HTML into
 * `apps/mobile/public/legal/` (the canonical URLs the mobile app links to), and
 * the admin dashboard renders the same documents as React at `/legal/*`. Two
 * hand-maintained copies of a legal document is how a privacy policy ends up
 * describing a version of the product that no longer exists, so there is one
 * source and two renderers.
 *
 * The fee figures interpolate from `constants/platform` for the same reason —
 * change the delivery fee and the terms follow rather than quietly going stale.
 * Note those constants are defaults; `platform_config` overrides them at
 * runtime, so if an override is ever set these numbers need revisiting by hand.
 */
import {
  DEFAULT_DELIVERY_FEE_GHS,
  DEFAULT_LOYALTY_DISCOUNT_PCT,
  DEFAULT_LOYALTY_THRESHOLD,
  DEFAULT_SPECIAL_ORDER_SURCHARGE_PCT,
} from "../constants/platform";

export type LegalBlock =
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "table"; head: [string, string]; rows: Array<[string, string]> };

export interface LegalSection {
  title: string;
  blocks: LegalBlock[];
}

export interface LegalDoc {
  slug: "terms" | "privacy" | "refunds";
  title: string;
  description: string;
  sections: LegalSection[];
}

/**
 * Who Wave actually is, as a legal party.
 *
 * One object rather than loose constants because these are the details a data
 * subject, a regulator and Paystack all ask for, and they are asked for
 * together. Both apps render from here, so filling this in once updates the
 * terms, the privacy policy, the admin footer and the receipts at the same time.
 *
 * ⚠️ TODO(owner): four of these are blank and Wave must not go to production
 * with them blank. `missingLegalDetails()` below names exactly which, and
 * `LEGAL_DETAILS_COMPLETE` is false until all of them are filled. Under Ghana's
 * Data Protection Act, 2012 (Act 843) a controller has to be reachable and
 * registered — an unread address is a compliance gap, not a cosmetic one.
 *
 * Deliberately left empty rather than filled with plausible-looking values: a
 * wrong address on a legal document is worse than an obvious blank, because the
 * blank gets fixed and the wrong one gets trusted.
 */
export const LEGAL_DETAILS = {
  /** The registered business name. The agreement is with this, not with "Wave". */
  operator: "Ride the Wave Logistics",
  /** Registered postal or physical address, as filed. */
  address: "",
  /** A phone number a customer can actually reach. */
  phone: "",
  /** A monitored mailbox. Data-subject requests arrive here. */
  email: "",
  /**
   * Ghana Data Protection Commission registration number.
   *
   * If registration is still in progress, leave this blank — the documents say
   * so honestly rather than implying a registration that does not exist.
   */
  dpcRegistration: "",
} as const;

/** The fields still blank, by name. Empty array means ready to ship. */
export function missingLegalDetails(): string[] {
  return Object.entries(LEGAL_DETAILS)
    .filter(([, value]) => value.trim() === "")
    .map(([key]) => key);
}

/**
 * Whether Wave may present itself as a legal entity yet.
 *
 * Read by both renderers: while this is false the documents show what is
 * missing instead of quietly rendering a blank where an address should be.
 */
export const LEGAL_DETAILS_COMPLETE = missingLegalDetails().length === 0;

/**
 * The address a student, rider or shop owner writes to about their data.
 *
 * Kept as its own export because the documents reference it inline in a dozen
 * places. Falls back to naming the gap rather than printing an empty string,
 * so a missing mailbox reads as unfinished rather than as no contact at all.
 */
export const LEGAL_CONTACT_EMAIL =
  LEGAL_DETAILS.email.trim() || "[contact email not yet set]";

/**
 * The registered business. "Wave" is the name students know it by and stays
 * the brand everywhere in the app; this is who the agreement is actually with,
 * so it appears wherever a legal party, a receipt or a data controller is named.
 */
export const LEGAL_OPERATOR = LEGAL_DETAILS.operator;

/** The everyday name, which the documents define as meaning the operator. */
export const LEGAL_BRAND = "Wave";

/** Shown on both documents. Bump whenever the text materially changes. */
export const LEGAL_LAST_UPDATED = "21 September 2026";

/**
 * Flip to `true` once a qualified adviser has reviewed both documents.
 *
 * Until then both renderers show a draft banner. The text below was written
 * from what the code actually does — the Prisma schema, the fee rules, the
 * processor list — which makes it accurate about Wave's behaviour. Accuracy is
 * not legal sufficiency, and nobody with a practising certificate has read it.
 */
export const LEGAL_REVIEWED = false;

const fee = DEFAULT_DELIVERY_FEE_GHS.toFixed(2);

export const TERMS: LegalDoc = {
  slug: "terms",
  title: "Terms of Service",
  description: "The rules for ordering, paying and delivery on Wave.",
  sections: [
    {
      title: "1. Who these terms are between",
      blocks: [
        {
          kind: "p",
          text: `These terms are an agreement between you and ${LEGAL_OPERATOR} ("${LEGAL_BRAND}", "we"), a registered business operating a campus delivery service at Ashesi University, Berekuso, Ghana. By creating an account or placing an order you accept them. If you do not accept them, do not use Wave.`,
        },
      ],
    },
    {
      title: "2. Your account",
      blocks: [
        {
          kind: "p",
          text: "Wave accounts are tied to a phone number. You sign in with a one-time code sent by SMS to that number, so whoever controls the number controls the account. Keep your SIM and device secure, and tell us at once if you lose control of the number.",
        },
        {
          kind: "p",
          text: "One person, one account. Give accurate details — a wrong name or phone number mainly harms your own deliveries, because that is how a rider identifies you at handover. We may suspend an account that is used fraudulently, that abuses riders or shop staff, or that repeatedly refuses accepted deliveries.",
        },
      ],
    },
    {
      title: "3. What Wave does, and what it does not do",
      blocks: [
        {
          kind: "p",
          text: "Wave arranges for a rider to buy goods on your behalf from an off-campus shop and bring them to a checkpoint. Wave is a delivery and coordination service. It is not the manufacturer or, except where stated, the seller of the goods.",
        },
        {
          kind: "p",
          text: "Wave does not guarantee that a shop has a particular item in stock, or that a price shown in the app still stands when the rider reaches the till. Where an item is bought on an open list rather than from the in-app catalogue, its price is not known until it is purchased.",
        },
      ],
    },
    {
      title: "4. Orders and prices",
      blocks: [
        {
          kind: "p",
          text: "Placing an order is an offer, not a completed contract. An order is accepted when it is confirmed in the app after payment.",
        },
        {
          kind: "p",
          text: "Every amount you are charged is calculated by Wave's servers, not by the app on your phone. If the two ever disagree, the server figure is the one that applies.",
        },
        {
          kind: "p",
          text: `Standard delivery days are Sunday and Wednesday. An order requested outside those days is a special order and carries a surcharge of ${DEFAULT_SPECIAL_ORDER_SURCHARGE_PCT}% on the delivery fee. The base delivery fee is GH₵${fee}. Fees may change; the fee shown at checkout is the fee for that order.`,
        },
        {
          kind: "p",
          text: `After ${DEFAULT_LOYALTY_THRESHOLD} completed deliveries you receive a loyalty discount of ${DEFAULT_LOYALTY_DISCOUNT_PCT}%. It applies to the delivery fee only, never to the cost of the goods.`,
        },
        {
          kind: "p",
          text: "For orders where the rider pays at the till, there is a ceiling on the goods value Wave will front on your behalf. It is set by Wave and shown to you before you order.",
        },
      ],
    },
    {
      title: "5. Paying",
      blocks: [
        {
          kind: "p",
          text: "Payment is taken up front, through Paystack, by card or by mobile money. Wave does not see or store your card number or your mobile money PIN — those are handled by Paystack and by your provider.",
        },
        {
          kind: "p",
          text: "An order that is not paid within a short window is cancelled automatically. Before cancelling anything, Wave checks with Paystack whether a payment in fact succeeded, so a slow mobile money approval does not cost you your order. If money did leave your account, the order is confirmed rather than cancelled.",
        },
      ],
    },
    {
      title: "6. Delivery and the delivery PIN",
      blocks: [
        {
          kind: "p",
          text: "Delivery is to a checkpoint you choose, not to a room or hostel door. Be at the checkpoint when the app tells you the rider has arrived.",
        },
        {
          kind: "p",
          text: "When your order is confirmed you receive a six-digit delivery PIN. Give it to the rider only when you have your goods in hand — it is the rider's proof of delivery, and once entered the order is treated as delivered. Do not share it in advance or with anyone else. There is a limit on how many times a PIN can be entered incorrectly, after which handover has to be resolved with support.",
        },
      ],
    },
    {
      title: "7. Cancellations and refunds",
      blocks: [
        {
          kind: "p",
          text: "You may cancel free of charge until a rider has bought your goods. Once a rider has paid at the till, the goods have been bought on your behalf and the cost of those goods is not automatically refundable.",
        },
        {
          kind: "p",
          text: "Where a refund is due, it is returned through Paystack to the method you paid with. Refunds are subject to your bank's or mobile money provider's own timing, which Wave does not control.",
        },
        {
          kind: "p",
          text: "If an order cannot be fulfilled — the shop is shut, the item is unavailable, no rider is found — it is cancelled and refunded in full.",
        },
        {
          kind: "p",
          text: "The full Refund Policy sets out what is refundable, how long it takes and how to ask. It forms part of these terms.",
        },
      ],
    },
    {
      title: "8. Riders",
      blocks: [
        {
          kind: "p",
          text: "Riders are independent providers, not employees of Wave. Before a rider may accept orders they submit identity documents for verification, and Wave may decline or withdraw verification at its discretion.",
        },
        {
          kind: "p",
          text: "A rider's earnings are a share of the standard delivery fee for each completed delivery, recorded in the app as they accrue. Settlement timing and method are notified separately. A rider who abandons orders, mishandles goods, or misuses a customer's details may be removed from the platform.",
        },
      ],
    },
    {
      title: "9. Shops",
      blocks: [
        {
          kind: "p",
          text: "A shop listed on Wave is responsible for the accuracy of its listings, the quality and legality of what it sells, and its own regulatory obligations. Wave may remove a listing or a shop at any time.",
        },
      ],
    },
    {
      title: "10. Acceptable use",
      blocks: [
        {
          kind: "p",
          text: "Do not use Wave to order anything you may not lawfully buy, to place orders you do not intend to collect, to interfere with its operation, or to harass anyone using it. Do not attempt to access another person's account, order or delivery PIN.",
        },
      ],
    },
    {
      title: "11. Liability",
      blocks: [
        {
          kind: "p",
          text: "Wave is provided as it stands. Nothing in these terms excludes liability that cannot lawfully be excluded, including for death or personal injury caused by negligence, or for fraud.",
        },
        {
          kind: "p",
          text: "Subject to that, Wave is not liable for indirect or consequential loss, and its total liability for any order is limited to the amount you paid for that order.",
        },
      ],
    },
    {
      title: "12. Changes and governing law",
      blocks: [
        {
          kind: "p",
          text: "These terms may change. Material changes will be notified in the app, and the date at the top of this page will be updated. Continuing to use Wave after a change means you accept it.",
        },
        { kind: "p", text: "These terms are governed by the laws of the Republic of Ghana." },
      ],
    },
  ],
};

/**
 * Every row of the data table below is drawn from the live Prisma schema rather
 * than from a template. If a column holding personal data is added, add it here
 * too — a policy that under-describes what is stored is worse than none.
 */
export const PRIVACY: LegalDoc = {
  slug: "privacy",
  title: "Privacy Policy",
  description: "What Wave collects, why it collects it, and who else sees it.",
  sections: [
    {
      title: "Who is responsible for your data",
      blocks: [
        {
          kind: "p",
          text: `${LEGAL_OPERATOR} ("${LEGAL_BRAND}") operates a campus delivery service at Ashesi University, Berekuso, Ghana, and is the data controller for the information described here. This policy is written with reference to Ghana's Data Protection Act, 2012 (Act 843).`,
        },
      ],
    },
    {
      title: "What Wave collects, and why",
      blocks: [
        {
          kind: "table",
          head: ["Data", "Why"],
          rows: [
            ["Name and phone number", "Required. Phone is how you sign in and how a rider identifies you at handover."],
            ["Email address", "Optional. Used only to tell you when a shop you suggested comes online."],
            ["Student ID and university", "Identifies you as a member of the campus Wave serves."],
            ["Profile photo", "Optional. Shown to the rider handling your order."],
            ["Push notification token", "Sends order updates and your delivery PIN to your device."],
            ["Orders, items and prices", "Fulfils and supports your order, and produces your receipts."],
            ["Delivery checkpoint", "Tells the rider where to bring your order."],
            ["Delivery count", "Determines when you qualify for the loyalty discount."],
            ["Shop suggestions", "Decides which shops to onboard next."],
            ["Rider ID document and selfie", "Riders only. Verifies identity before a rider may accept orders."],
            ["Rider earnings records", "Riders only. Records what is owed for completed deliveries."],
            [
              "Activity records",
              "What was done on your account and when — orders, payments, sign-ins, changes — with the IP address and device type it came from. Kept to investigate disputes and fraud, and for audit. Wave staff viewing your phone number or documents is recorded the same way.",
            ],
            ["Beta programme", "Optional. Your application, and any feedback you send as a tester."],
          ],
        },
        {
          kind: "p",
          text: "Wave does not collect your card number or your mobile money PIN. Those go directly to Paystack and to your provider; Wave receives only a reference and whether the payment succeeded.",
        },
        {
          kind: "p",
          text: "Wave does not track your location in the background. A rider's app may use location while the app is open in order to navigate to a checkpoint.",
        },
      ],
    },
    {
      title: "How it is protected",
      blocks: [
        {
          kind: "p",
          text: "Sign-in codes and delivery PINs are never stored in a form Wave can read back — PINs are held as a one-way hash and checked by comparison. Rider identity documents are kept in private storage that is not publicly reachable; an administrator reviewing one is issued a link that expires shortly after it is created.",
        },
      ],
    },
    {
      title: "Who else sees it",
      blocks: [
        {
          kind: "p",
          text: "Your name, phone number, order contents and chosen checkpoint are shown to the rider handling your order, because they cannot deliver it otherwise. A shop sees what has been ordered from it. Riders and shops are not permitted to use those details for anything other than fulfilling the order.",
        },
        {
          kind: "p",
          text: "Wave relies on these service providers, each of which processes data on Wave's instructions:",
        },
        {
          kind: "ul",
          items: [
            "Supabase — sign-in, and private storage of rider verification images.",
            "Neon — the database holding accounts, orders and earnings.",
            "Render — runs Wave's servers.",
            "Paystack — takes payment and issues refunds.",
            "mNotify — delivers sign-in codes and delivery PINs by SMS.",
            "Expo — delivers push notifications.",
            "Sentry — reports crashes and errors so they can be fixed.",
            "Resend — sends the occasional service email, such as a suggested shop going live.",
          ],
        },
        { kind: "p", text: "Wave does not sell your personal data, and does not share it for advertising." },
      ],
    },
    {
      title: "Where it is stored",
      blocks: [
        {
          kind: "p",
          text: "Wave's servers and database are hosted in Europe, so your information is transferred outside Ghana and stored there. Payment processing is carried out by Paystack, and SMS delivery by mNotify, both operating in Ghana. By using Wave you consent to this transfer.",
        },
      ],
    },
    {
      title: "How long it is kept",
      blocks: [
        {
          kind: "p",
          text: "Account details are kept while your account is open. Order and payment records are kept after that where Wave needs them for accounting, tax or dispute purposes. Rider verification documents are kept for as long as the rider is active on the platform, and deleted afterwards.",
        },
      ],
    },
    {
      title: "Your rights",
      blocks: [
        {
          kind: "p",
          text: "You may ask what Wave holds about you, ask for it to be corrected, ask for it to be deleted, withdraw consent, or object to a particular use. Write to the address below and Wave will respond within a reasonable period. Note that deleting your account does not remove records Wave is required to keep, such as completed payment records.",
        },
        {
          kind: "p",
          text: "You may also complain to the Data Protection Commission of Ghana if you believe your information has been mishandled.",
        },
      ],
    },
    {
      title: "Children",
      blocks: [
        {
          kind: "p",
          text: "Wave is intended for university students and staff and is not directed at children under 13. If you believe a child has created an account, write to the address below and it will be removed.",
        },
      ],
    },
    {
      title: "Changes",
      blocks: [
        {
          kind: "p",
          text: "If this policy changes materially you will be notified in the app, and the date at the top of this page will be updated.",
        },
      ],
    },
  ],
};


/**
 * Who Wave is, rendered from `LEGAL_DETAILS`.
 *
 * Both documents carry it, because a data subject reading the privacy policy
 * and a customer reading the terms both need to know who they are dealing with
 * and where to write. Built as a function so the blanks are reported in the
 * document itself while they are still blank — a legal page that silently
 * renders an empty address looks finished and is not.
 */
function businessDetailsSection(number: string): LegalSection {
  const missing = missingLegalDetails();
  const lines: string[] = [`Registered name: ${LEGAL_DETAILS.operator}`];
  if (LEGAL_DETAILS.address) lines.push(`Registered address: ${LEGAL_DETAILS.address}`);
  if (LEGAL_DETAILS.phone) lines.push(`Telephone: ${LEGAL_DETAILS.phone}`);
  if (LEGAL_DETAILS.email) lines.push(`Email: ${LEGAL_DETAILS.email}`);
  lines.push(
    LEGAL_DETAILS.dpcRegistration
      ? `Ghana Data Protection Commission registration: ${LEGAL_DETAILS.dpcRegistration}`
      : "Ghana Data Protection Commission registration: application in progress.",
  );

  const blocks: LegalBlock[] = [
    { kind: "p", text: `${LEGAL_BRAND} is operated by ${LEGAL_DETAILS.operator}.` },
    { kind: "ul", items: lines },
  ];
  if (missing.length > 0) {
    blocks.push({
      kind: "p",
      text: `This section is incomplete. Still to be published: ${missing.join(", ")}.`,
    });
  }
  return { title: `${number}. Business details`, blocks };
}

/**
 * The refund policy, as its own document.
 *
 * It was section 7 of the terms and nothing else, which is the wrong shape for
 * it twice over: Paystack and the app stores both expect a refund policy to be
 * findable on its own, and a student trying to get money back should not have
 * to read a contract to find out how. The terms still cover it and now point
 * here, so there is one authority and one copy of the rules.
 */
export const REFUNDS: LegalDoc = {
  slug: "refunds",
  title: "Refund Policy",
  description: "What Wave refunds, how long it takes, and how to ask.",
  sections: [
    {
      title: "1. The short version",
      blocks: [
        {
          kind: "p",
          text: `Cancel before a rider has bought your goods and you pay nothing. If ${LEGAL_BRAND} cannot deliver, you get everything back. Once a rider has paid at the till on your behalf, the cost of those goods is no longer automatically refundable.`,
        },
      ],
    },
    {
      title: "2. Two separate charges",
      blocks: [
        {
          kind: "p",
          text: `An order can involve two payments: the delivery fee, taken when you place the order, and — on a "buy for me" order — the cost of the goods, taken after a rider has bought them. They are refunded independently, because they are owed to different people at different times.`,
        },
        {
          kind: "ul",
          items: [
            `Delivery fee (GHS ${DEFAULT_DELIVERY_FEE_GHS.toFixed(2)} base): refunded in full whenever the delivery does not happen for a reason that is not your doing.`,
            "Cost of goods: refundable while nobody has bought them yet. After a rider has paid at the till, the goods are yours and a refund is at Wave's discretion — for example where the wrong item was bought, or it arrived unusable.",
          ],
        },
      ],
    },
    {
      title: "3. When you get a full refund",
      blocks: [
        {
          kind: "ul",
          items: [
            "You cancel before a rider has bought the goods.",
            "No rider takes the order and the Wave passes.",
            "The shop is shut, or the item turns out to be unavailable.",
            `${LEGAL_BRAND} cancels the order for any reason of its own.`,
            "The parcel or goods are lost or damaged in Wave's hands.",
          ],
        },
      ],
    },
    {
      title: "4. When a refund may be partial or refused",
      blocks: [
        {
          kind: "ul",
          items: [
            "You are not at the checkpoint and cannot be reached, so the delivery fails. The goods were still bought and the rider still made the run.",
            "You change your mind after the goods have been bought.",
            "You gave a wrong or incomplete description and the rider bought what you asked for.",
          ],
        },
        {
          kind: "p",
          text: "Where a refund is refused you will be told the reason, and you can ask for it to be looked at again using the contact details below.",
        },
      ],
    },
    {
      title: "5. How to ask",
      blocks: [
        {
          kind: "p",
          text: `Cancel from the order screen in the app while cancelling is still possible — that is the fastest route and needs nobody's approval. Otherwise write to ${LEGAL_CONTACT_EMAIL} with your order number, which is on the order screen and in your receipt.`,
        },
        {
          kind: "p",
          text: "A refund on a completed payment is reviewed by Wave head office before it is issued, so there is a person in the loop rather than an automatic decision.",
        },
      ],
    },
    {
      title: "6. How long it takes",
      blocks: [
        {
          kind: "p",
          text: `${LEGAL_BRAND} issues refunds through Paystack, to the card or mobile money wallet you paid with — never to a different account. Once issued, the time it takes to appear is set by your bank or mobile money provider and is outside Wave's control. Mobile money is usually quick; a card can take several working days.`,
        },
      ],
    },
    {
      title: "7. Loyalty stamps",
      blocks: [
        {
          kind: "p",
          text: "If a refunded order used your delivery-stamp reward, the stamps are returned to your card so the reward is not lost with the order.",
        },
      ],
    },
    businessDetailsSection("8"),
  ],
};

export const LEGAL_DOCS: LegalDoc[] = [TERMS, PRIVACY, REFUNDS];
