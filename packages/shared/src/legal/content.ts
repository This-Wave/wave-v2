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
  slug: "terms" | "privacy";
  title: string;
  description: string;
  sections: LegalSection[];
}

/**
 * The address a student, rider or shop owner writes to about their data.
 *
 * TODO(owner): point this at a mailbox that is actually monitored. `wave.app`
 * appears elsewhere in this repo only as a synthetic sender for Paystack
 * customer records and receives no mail, so it is deliberately not used here.
 * Ghana's Data Protection Act gives a data subject the right to reach the data
 * controller, which makes an unread address a compliance gap rather than a
 * cosmetic one.
 */
export const LEGAL_CONTACT_EMAIL = "REPLACE-ME@example.com";

export const LEGAL_OPERATOR = "Wave";

/** Shown on both documents. Bump whenever the text materially changes. */
export const LEGAL_LAST_UPDATED = "2 September 2026";

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
          text: `These terms are an agreement between you and ${LEGAL_OPERATOR}, a campus delivery service operating at Ashesi University, Berekuso, Ghana. By creating an account or placing an order you accept them. If you do not accept them, do not use Wave.`,
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
          text: "Wave arranges for a rider to buy goods on your behalf from an off-campus shop and bring them to a campus checkpoint. Wave is a delivery and coordination service. It is not the manufacturer or, except where stated, the seller of the goods.",
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
          text: "Delivery is to a campus checkpoint you choose, not to a room or hostel door. Be at the checkpoint when the app tells you the rider has arrived.",
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
          text: `${LEGAL_OPERATOR} operates a campus delivery service at Ashesi University, Berekuso, Ghana, and is the data controller for the information described here. This policy is written with reference to Ghana's Data Protection Act, 2012 (Act 843).`,
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

export const LEGAL_DOCS: LegalDoc[] = [TERMS, PRIVACY];
