import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FadeIn } from "@/components/shared/motion";
import { JsonLd, faqSchema } from "@/components/shared/json-ld";

const FAQS = [
  {
    q: "How do prediction markets work here?",
    a: "Each market asks a yes-or-no question about a sporting event. You buy YES or NO at the current price, which reflects the crowd's implied probability. If your side is correct when the market resolves, every share pays out 1 USDG; if not, the position settles at zero.",
  },
  {
    q: "Can I cancel a trade after placing it?",
    a: "Yes. Any open trade can be cancelled at any time before the market resolves. A small cancellation fee between 0.30 and 1.00 USDG is charged, and the remainder returns to your available balance immediately.",
  },
  {
    q: "What fees do you charge?",
    a: "Trading costs 1% of the trade amount, floored at 0.30 USDG and capped at 1.00 USDG. Cancelling uses the same band. There are no hidden spreads or withdrawal surprises — the fee is always shown before you confirm.",
  },
  {
    q: "How do deposits and withdrawals work?",
    a: "Deposit on Robinhood Chain (ETH, USDG) or Ethereum (USDC, USDT, ETH). Send funds to the address shown and submit the transaction hash — once the transaction succeeds on the blockchain, the balance is added to your account. Withdrawals are paid to the address you provide.",
  },
  {
    q: "Do I need identity verification?",
    a: "You can trade right after signing up. Verification is required before your first withdrawal — upload a national ID, passport or driving license plus a live selfie, and a reviewer approves it, usually within a day.",
  },
  {
    q: "How does the bonus turnover requirement work?",
    a: "Bonus credit is spendable on trades but is not directly withdrawable. You must trade a multiple of the bonus amount before bonus-derived funds unlock. Your progress is tracked on the wallet page.",
  },
  {
    q: "What do I earn from referrals?",
    a: "Share your referral code and earn a commission on every trading fee your invitees generate, credited to your balance automatically. Earnings and referred users are listed on your referral dashboard.",
  },
  {
    q: "How are markets resolved?",
    a: "After the event ends, an administrator resolves the market against the official result and records a resolution note. Winners are paid instantly, and everyone involved receives a notification. If an event is voided, the market is cancelled and every stake plus fee is refunded.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="px-4 py-16 sm:px-6 lg:px-8">
      <JsonLd data={faqSchema(FAQS.map((faq) => ({ question: faq.q, answer: faq.a })))} />
      <div className="mx-auto max-w-3xl">
        <FadeIn>
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Frequently asked <span className="text-gradient">questions</span>
            </h2>
            <p className="mt-3 text-muted-foreground">
              Everything you need before placing your first prediction.
            </p>
          </div>
        </FadeIn>

        <Accordion type="single" collapsible className="w-full">
          {FAQS.map((faq, i) => (
            <AccordionItem key={faq.q} value={`item-${i}`}>
              <AccordionTrigger className="text-left">{faq.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{faq.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
