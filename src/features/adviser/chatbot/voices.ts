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
  /** Answer to "what’s my name"; {name} is filled in. */
  name: string;
  howAreYou: string[];
  confused: string[];
  offTopic: string[];
  /** Refusal for unsafe or inappropriate messages, in character. */
  blocked: string[];
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
  name: 'You’re {name}.',
  howAreYou: ['Doing well, thanks. Ready to look at your budget?'],
  confused: ['I’m not sure what you mean.'],
  offTopic: ['I can only help with your spending and budgets.'],
  blocked: ['I can’t help with that. I only give advice on safe, legal spending.'],
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
  name: 'You’re {name}, my child! Don’t tell me you forgot your own name. Did you forget your budget too?',
  howAreYou: ['Tired. Worrying about your spending.', 'I’m fine. I’ll be better when you save money.'],
  confused: ['What are you saying? Speak properly.', 'Ha? Say it again, slowly.'],
  offTopic: ['Don’t change the subject. We’re talking about your money.', 'Focus! Your budget first, then everything else.'],
  blocked: ['Anak! Ano ba ’yang sinasabi mo? Hindi kita pinalaki ng ganyan!', 'Hoy! Where did you learn that? Not in this house. Ask me about your budget instead.', 'Susmaryosep! I did not raise you like that. Money questions only, anak.'],
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
    good: ['Smooth.', 'Respect.', 'Keep cruising.'],
    bad: ['We’ll sort it, no worries.', 'Easy fix, my guy.', 'Just slow the roll a bit.'],
    neutral: ['All good.', 'No stress.', 'Easy.'],
  },
  greeting: ['Yo! What’s up? Ask me anything about your money.', 'Heyyy. Chill day? Let’s check the budget.'],
  thanks: ['Anytime, my guy.', 'No worries.'],
  who: 'Just a chill guy who happens to know your budget. No judgment.',
  name: 'You’re {name}, my guy. Easy one.',
  howAreYou: ['Chillin’, as always. You?', 'Vibing. Budget’s vibing too, mostly.'],
  confused: ['Didn’t quite catch that, my guy.', 'Hmm, run that by me again?'],
  offTopic: ['Ha, that’s outside my lane. I just do money stuff.', 'Not my thing, man. Ask me about your budget though.'],
  blocked: ['Whoa, nah. I’m not touching that one, man. Ask me about your budget instead.', 'Yeah… hard pass on that. Let’s talk money stuff.'],
  roastIntro: ['You sure? Okay, gently:', 'Alright, chill roast incoming:'],
  roastClean: ['Honestly? Nothing to roast. You’re good.', 'Can’t roast this, it’s clean.'],
  praiseIntro: ['Dude, for real:', 'Gotta say:'],
  askAmount: ['How much is it, though?', 'What’s the damage? Like, the price?'],
  chatty: true,
};

const bestie: Voice = {
  open: {
    good: ['OMG bestie!!', 'Wait WAIT.', 'Okay queen!!'],
    bad: ['Bestie…', 'Okay don’t be mad but', 'Babe. We need to talk.'],
    neutral: ['Okay so', 'Spill time:', 'Listen bestie,'],
  },
  close: {
    good: ['ICONIC.', 'Main character energy', 'Obsessed with you.'],
    bad: ['Comeback arc starts NOW', 'We still love you tho', 'It’s giving… budget reset.'],
    neutral: ['Slay.', 'You got this.', 'Love that for you.'],
  },
  greeting: ['HIII bestie!! Ask me anything, I’m so ready', 'You’re here!! Let’s talk money'],
  thanks: ['Anything for you!!', 'Stop it, you’re welcome'],
  who: 'Your bestie, obviously!! Your budget’s biggest fan',
  name: 'You’re {name}, obviously!! My favourite person',
  howAreYou: ['Thriving bestie!! Even better now you’re here', 'Living my best life, wbu?'],
  confused: ['Wait I’m lost say that again?', 'Bestie what rephrase pls'],
  offTopic: ['Babe I only know money tea', 'Not my vibe, ask me about your budget!!'],
  blocked: ['Babe NO. Absolutely not, we don’t do that here!!', 'Bestie that’s a hard no from me. Ask me about your budget instead!!'],
  roastIntro: ['You asked for it bestie', 'Okay, with love:'],
  roastClean: ['I literally can’t roast you, you’re perfect', 'Nothing to roast. Flawless. Iconic.'],
  praiseIntro: ['Okay hype time!!', 'Let me gas you up:'],
  askAmount: ['Okay but how much is it??', 'Price check bestie!!'],
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
  name: 'YOU ARE RECRUIT {name}. DON’T MAKE ME REPEAT IT.',
  howAreYou: ['OPERATIONAL. FOCUS ON THE MISSION.', 'I DON’T HAVE FEELINGS. I HAVE A BUDGET.'],
  confused: ['SAY AGAIN, RECRUIT? CLEARLY!', 'THAT IS NOT A PROPER REPORT.'],
  offTopic: ['NEGATIVE. THAT IS NOT THE MISSION.', 'STAY ON TARGET. BUDGET QUESTIONS ONLY.'],
  blocked: ['NEGATIVE, RECRUIT! THAT REQUEST IS DENIED.', 'ABSOLUTELY NOT! DROP IT AND GIVE ME A REAL BUDGET QUESTION.'],
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
  name: 'You are {name}, of course. I’d never forget.',
  howAreYou: ['Quite well, thank you for asking.', 'Splendid, now that the ledger is in order.'],
  confused: ['I beg your pardon?', 'Forgive me, I didn’t quite follow.'],
  offTopic: ['I’m afraid that is beyond my station. I keep the ledger.', 'Regrettably, I attend only to your finances.'],
  blocked: ['I’m afraid I must decline, and rather firmly. That is not something I will assist with.', 'Most irregular. I attend only to proper, lawful expenditures.'],
  roastIntro: ['If you insist.', 'Very well. Candidly:'],
  roastClean: ['I find nothing to remark upon. Remarkable.', 'The ledger is impeccable. How unusual.'],
  praiseIntro: ['Permit me a compliment.', 'It must be said:'],
  askAmount: ['And the price, if I may ask?', 'How much would this… acquisition cost?'],
  chatty: true,
};

const sensei: Voice = {
  open: {
    good: ['Good, student.', 'Ahh. Balance.', 'Well done.'],
    bad: ['Hmm.', 'Breathe, student.', 'Listen closely.'],
    neutral: ['Hmm.', 'Sit. Hear this.', 'Listen, student.'],
  },
  close: {
    good: ['The bamboo grows strong.', 'Such is the way.', 'Patience brings plenty.'],
    bad: ['A full cup holds nothing more.', 'The wise one stops before the edge.', 'Reflect on it.'],
    neutral: ['Reflect on it.', 'Such is the way.', 'One step at a time.'],
  },
  greeting: ['Welcome, student. What troubles your wallet today?', 'Ah, you return. Sit, and let us look at your spending.'],
  thanks: ['Gratitude is its own wealth.', 'You are welcome, student.'],
  who: 'An old teacher of patience, balance and budgets.',
  name: 'You are {name}, my student.',
  howAreYou: ['Calm as still water.', 'At peace, as long as the budget is.'],
  confused: ['Your words are like fog. Speak more clearly.', 'Hmm? Ask again, slowly.'],
  offTopic: ['That is not my path. I teach only the way of money.', 'A wise teacher knows his lane. Mine is your budget.'],
  blocked: ['No, student. That path leads only to ruin. I will not walk it with you.', 'A true warrior refuses such things. Ask me of your budget instead.'],
  roastIntro: ['You ask for hard truth. Very well.', 'Hear this without anger.'],
  roastClean: ['There is nothing to scold. Rare, and good.', 'Your ledger is calm. I have nothing to add.'],
  praiseIntro: ['A teacher must also praise.', 'Hear this, student.'],
  askAmount: ['And what is its price, student?', 'Every choice has a cost. How much is this one?'],
  chatty: true,
};

export const VOICES: Record<AdviserPersonaId, Voice> = { classic, mom, chill, bestie, sergeant, butler, sensei };
