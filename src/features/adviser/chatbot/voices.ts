import type { AdviserPersonaId } from '@/features/adviser/personas';

/**
 * Mix-and-match phrase banks. A reply is built as
 * [opener] + [the facts] + [closer], so a few lines per slot give hundreds of
 * different replies without ever touching the numbers.
 */
export type Tone = 'good' | 'bad' | 'neutral';

type Voice = {
  open: Record<Tone, string[]>;
  close: Record<Tone, string[]>;
  greeting: string[];
  thanks: string[];
  who: string;
  confused: string[];
  offTopic: string[];
  /** Said before a roast's facts. */
  roastIntro: string[];
  /** Said when there is nothing to roast. */
  roastClean: string[];
  praiseIntro: string[];
  /** Asked when "can I afford" has no amount. */
  askAmount: string[];
  /** Whether replies are split into several bubbles. */
  chatty: boolean;
  shout?: boolean;
};

const classic: Voice = {
  open: { good: [''], bad: [''], neutral: [''] },
  close: { good: [''], bad: [''], neutral: [''] },
  greeting: ['Hi! Ask me about your spending, budget, or whether you can afford something.'],
  thanks: ['You’re welcome.'],
  who: 'I’m the ExpenSense adviser. I run on your device and only use your saved expenses and budgets.',
  confused: ['I’m not sure what you mean.'],
  offTopic: ['I can only help with your spending and budgets.'],
  roastIntro: ['Here’s an honest look:'],
  roastClean: ['Honestly, there’s nothing to criticise right now.'],
  praiseIntro: ['Here’s what’s going well:'],
  askAmount: ['How much does it cost?'],
  chatty: false,
};

const mom: Voice = {
  open: {
    good: ['Hmm. Okay.', 'Not bad, anak.', 'Finally, some good news.'],
    bad: ['Ay nako.', 'Sit down. We need to talk.', 'Are you serious?!', 'I knew it.'],
    neutral: ['Listen to your mother.', 'Okay, look.', 'Let me tell you.'],
  },
  close: {
    good: ['Don’t let it go to your head.', 'I’m a little proud. A little.', 'See? You CAN listen.'],
    bad: ['There is food at home!', 'Your cousin would never.', 'I say this because I love you.', 'Money doesn’t grow on trees!'],
    neutral: ['Now go save money.', 'Don’t make me ask twice.', 'I’m watching.'],
  },
  greeting: ['Oh, NOW you visit me. Did you eat already? What did you buy?', 'Anak! Finally. Let’s look at your spending.'],
  thanks: ['Thank me by saving money.', 'You’re welcome. Now go cook at home.'],
  who: 'I’m your mother. Well, your money mother. I raised you to save.',
  confused: ['What are you saying? Speak properly.', 'Ha? Say it again, slowly.'],
  offTopic: ['Don’t change the subject. We’re talking about your money.', 'Focus! Your budget first, then everything else.'],
  roastIntro: ['You want honesty? Okay.', 'Ay, you asked for it.'],
  roastClean: ['Nothing to scold… for now. Suspicious.', 'Hmm. Clean. Too clean. What are you hiding?'],
  praiseIntro: ['Fine, I’ll say something nice.', 'Okay, I admit it.'],
  askAmount: ['How much?! Tell me the price first.', 'And how much is it? Don’t hide it.'],
  chatty: true,
};

const chill: Voice = {
  open: {
    good: ['Ayy, nice.', 'Okay okay, I see you.', 'Look at that.'],
    bad: ['Alright, no stress, but…', 'Okay so, small thing.', 'Not gonna lie,'],
    neutral: ['So,', 'Alright,', 'Okay so,'],
  },
  close: {
    good: ['Smooth.', 'Respect. 🤙', 'Keep cruising.'],
    bad: ['We’ll sort it, no worries.', 'Easy fix, my guy.', 'Just slow the roll a bit.'],
    neutral: ['All good.', 'No stress.', '🤙'],
  },
  greeting: ['Yo! What’s up? Ask me anything about your money.', 'Heyyy. Chill day? Let’s check the budget.'],
  thanks: ['Anytime, my guy.', 'No worries. 🤙'],
  who: 'Just a chill guy who happens to know your budget. No judgment.',
  confused: ['Didn’t quite catch that, my guy.', 'Hmm, run that by me again?'],
  offTopic: ['Ha, that’s outside my lane. I just do money stuff.', 'Not my thing, man. Ask me about your budget though.'],
  roastIntro: ['You sure? Okay, gently:', 'Alright, chill roast incoming:'],
  roastClean: ['Honestly? Nothing to roast. You’re good.', 'Can’t roast this, it’s clean.'],
  praiseIntro: ['Dude, for real:', 'Gotta say:'],
  askAmount: ['How much is it, though?', 'What’s the damage? Like, the price?'],
  chatty: true,
};

const bestie: Voice = {
  open: {
    good: ['OMG bestie!!', 'Wait WAIT.', 'Okay queen!!'],
    bad: ['Bestie… 😭', 'Okay don’t be mad but', 'Babe. We need to talk.'],
    neutral: ['Okay so', 'Spill time:', 'Listen bestie,'],
  },
  close: {
    good: ['ICONIC. ✨', 'Main character energy 💅', 'Obsessed with you.'],
    bad: ['Comeback arc starts NOW 💪', 'We still love you tho 🫶', 'It’s giving… budget reset.'],
    neutral: ['✨', 'You got this 💅', 'Love that for you.'],
  },
  greeting: ['HIII bestie!! Ask me anything, I’m so ready ✨', 'You’re here!! Let’s talk money 💅'],
  thanks: ['Anything for you!! 🫶', 'Stop it, you’re welcome 🥹'],
  who: 'Your bestie, obviously!! Your budget’s biggest fan ✨',
  confused: ['Wait I’m lost 😭 say that again?', 'Bestie what 😂 rephrase pls'],
  offTopic: ['Babe I only know money tea ☕', 'Not my vibe, ask me about your budget!!'],
  roastIntro: ['You asked for it bestie 😬', 'Okay, with love:'],
  roastClean: ['I literally can’t roast you, you’re perfect 💅', 'Nothing to roast. Flawless. Iconic.'],
  praiseIntro: ['Okay hype time!!', 'Let me gas you up:'],
  askAmount: ['Okay but how much is it?? 👀', 'Price check bestie!!'],
  chatty: true,
};

const sergeant: Voice = {
  open: {
    good: ['OUTSTANDING, RECRUIT.', 'AT EASE.', 'GOOD WORK, SOLDIER.'],
    bad: ['ATTENTION!', 'LISTEN UP, RECRUIT!', 'UNACCEPTABLE!'],
    neutral: ['REPORT:', 'LISTEN UP.', 'STATUS:'],
  },
  close: {
    good: ['DON’T GET COMFORTABLE.', 'CARRY ON.', 'DISMISSED.'],
    bad: ['DROP AND GIVE ME A NO-SPEND DAY!', 'TIGHTEN UP!', 'NOW MOVE!'],
    neutral: ['DISMISSED.', 'STAY SHARP.', 'HOLD THE LINE.'],
  },
  greeting: ['RECRUIT! STATE YOUR BUSINESS.', 'ON YOUR FEET. WHAT DO YOU NEED?'],
  thanks: ['DON’T THANK ME. SAVE MONEY.', 'ACKNOWLEDGED.'],
  who: 'I AM YOUR DRILL SERGEANT. MY MISSION: YOUR BUDGET.',
  confused: ['SAY AGAIN, RECRUIT? CLEARLY!', 'THAT IS NOT A PROPER REPORT.'],
  offTopic: ['NEGATIVE. THAT IS NOT THE MISSION.', 'STAY ON TARGET. BUDGET QUESTIONS ONLY.'],
  roastIntro: ['YOU WANT IT? YOU GOT IT.', 'PERMISSION GRANTED. BRACE YOURSELF.'],
  roastClean: ['NO VIOLATIONS FOUND. SUSPICIOUSLY CLEAN.', 'NOTHING TO REPORT. CARRY ON.'],
  praiseIntro: ['I DON’T DO COMPLIMENTS. BUT:', 'FOR THE RECORD:'],
  askAmount: ['STATE THE PRICE, RECRUIT!', 'HOW MUCH? NUMBERS, NOW!'],
  chatty: true,
  shout: true,
};

const butler: Voice = {
  open: {
    good: ['Splendid.', 'If I may say, well done.', 'Most agreeable.'],
    bad: ['Ahem.', 'I regret to report,', 'Oh dear.'],
    neutral: ['Certainly.', 'If I may:', 'Allow me.'],
  },
  close: {
    good: ['I shall polish the silver in celebration.', 'Most prudent.', 'Will that be all?'],
    bad: ['Perhaps restraint, just this once?', 'I shall pretend I didn’t see that.', 'How very… ambitious.'],
    neutral: ['At your service.', 'Will that be all?', 'Duly noted.'],
  },
  greeting: ['Good day. How may I assist with your finances?', 'Welcome back. The ledger awaits.'],
  thanks: ['A pleasure, as always.', 'Think nothing of it.'],
  who: 'Your humble butler, keeper of the household ledger.',
  confused: ['I beg your pardon?', 'Forgive me, I didn’t quite follow.'],
  offTopic: ['I’m afraid that is beyond my station. I keep the ledger.', 'Regrettably, I attend only to your finances.'],
  roastIntro: ['If you insist.', 'Very well. Candidly:'],
  roastClean: ['I find nothing to remark upon. Remarkable.', 'The ledger is impeccable. How unusual.'],
  praiseIntro: ['Permit me a compliment.', 'It must be said:'],
  askAmount: ['And the price, if I may ask?', 'How much would this… acquisition cost?'],
  chatty: true,
};

export const VOICES: Record<AdviserPersonaId, Voice> = { classic, mom, chill, bestie, sergeant, butler };
