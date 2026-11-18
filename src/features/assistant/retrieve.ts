import knowledge from '@/content/assistant-knowledge.json';

const STOP = new Set(
  'a an the of to and for in on is it this that are be as or if how what where when who why can i my you we they not no with from by at'.split(
    ' ',
  ),
);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

const GUIDES: { match: RegExp; answer: string }[] = [
  {
    match: /how (do i )?(find|search|look)|what.*(available|near)/i,
    answer:
      'Use Find food (or the search on the homepage). Type what you want, choose a town under Near, then Find local food. Cards show price, availability, and pickup. Contact farmer sends an inquiry — Musoko is not a shop and does not take payment.',
  },
  {
    match: /inquir|contact farmer|message|reach/i,
    answer:
      'Open a listing and choose Contact farmer. You send a short inquiry with how you want a reply (text or email). The farmer answers Available, Sold out, or Contact me. Payment and pickup are arranged directly with them. Musoko is not a party to the sale.',
  },
  {
    match: /farmer.*(join|register|sign)|join as/i,
    answer:
      'Farmers join at /join. The profile stays a draft until Musoko reviews it and consent to publish is recorded. After that, use the dashboard to keep listings current, reply to inquiries, and control whether phone, email or exact location are public.',
  },
  {
    match: /snap|ebt|verified farmer|verified farm/i,
    answer:
      'There is no “Verified farmer” badge. “Listed” only means Musoko reviewed the profile for publication. SNAP/EBT is farmer-reported unless a specific claim is marked verified with a date. Confirm SNAP/EBT with the farmer.',
  },
  {
    match: /demo|fictional|real farm/i,
    answer:
      'This version shows demonstration data. Farms, prices and availability are fictional. Every card carries a Demo mark, and the strip at the bottom of the page says so. Reset demo data restores the original seed.',
  },
  {
    match: /theme|yellow|green|dark|light/i,
    answer:
      'Use the switch in the header. Yellow is the harvest theme; green is the swap. The page peels from the top-right corner. Your choice is remembered in this browser.',
  },
  {
    match: /address|street|coordinates|phone|email|privacy|private/i,
    answer:
      'Street addresses and exact coordinates stay private unless a farmer opts in to a public pin. Phone and email stay hidden unless the farmer turns those on. Buyers reach farmers through the inquiry form by default.',
  },
  {
    match: /map|pickup|market/i,
    answer:
      'Map shows farms, farmers markets and pickup points. Pins sit at the town centre unless a farmer opted in to a more exact public pin. Street addresses stay private. Farmers markets also have their own list under Markets.',
  },
  {
    match: /compare|unit price|per (lb|pound)/i,
    answer:
      'On Find food, choose Compare on up to four listings, then open Compare in the header. Where a listing has a measurable size, the card also shows a unit price (for example $3.00 per lb). A bunch or basket without a weight shows the listed price only.',
  },
  {
    match: /admin|administrator/i,
    answer:
      'Switch Viewing as to Administrator in the demo strip, then open /admin. That is for reviewing registrations, consent, claims, moderation and pilot numbers. Raw searches are only visible there.',
  },
];

export function answerQuestion(question: string): { answer: string; passages: string[] } {
  const q = question.trim();
  if (!q) {
    return {
      answer: 'Ask how to find food, send an inquiry, join as a farmer, or what “Listed” and Demo mean.',
      passages: [],
    };
  }

  const guide = GUIDES.find((g) => g.match.test(q));
  const terms = tokens(q);
  const scored = knowledge
    .map((chunk) => {
      const hay = chunk.text.toLowerCase();
      let score = 0;
      for (const term of terms) {
        const hits = hay.split(term).length - 1;
        if (hits) score += hits * (term.length > 5 ? 2 : 1);
      }
      return { chunk, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const passages = scored.map((row) => row.chunk.text.replace(/\s+/g, ' ').slice(0, 420));
  if (guide) return { answer: guide.answer, passages };

  if (!passages.length) {
    return {
      answer:
        'I could not find that in the Musoko brief. Try Find food, Farmers, Markets, Map or Compare, or ask how inquiries, privacy or demo data work.',
      passages: [],
    };
  }

  const first = passages[0] ?? '';
  const sentence = first.split(/(?<=\.)\s/).slice(0, 3).join(' ');
  return {
    answer: `${sentence}\n\nThat comes from the Musoko brief. Browse Find food for listings, or ask a more specific question.`,
    passages,
  };
}