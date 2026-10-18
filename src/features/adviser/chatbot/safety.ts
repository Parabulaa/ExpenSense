/**
 * The adviser's content filter. Runs before anything else in the chat, so an
 * unsafe message is never priced, budgeted or remembered as an item.
 */

export type SafetyVerdict = 'self_harm' | 'blocked' | null;

/** Undoes common disguises: "w33d", "s.e.x", "c0caine", "guuun". */
function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[0134@$5]/g, (c) => ({ '0': 'o', '1': 'i', '3': 'e', '4': 'a', '@': 'a', '$': 's', '5': 's' })[c] ?? c)
    .replace(/(\w)[.\-_*](?=\w)/g, '$1')
    .replace(/(\w)\1{2,}/g, '$1$1');
}

const SELF_HARM = /\b(suicide|suicidal|kill (myself|my self)|end (my|it all|my life)|self[- ]?harm|cut (myself|my wrists?)|want to die|wanna die|magpakamatay|patayin ang sarili)\b/;

const BLOCKED: RegExp[] = [
  // Illegal drugs and paraphernalia.
  /\b(weed|marijuana|marihuana|cannabis|kush|ganja|shabu|meth|methamphetamine|cocaine|heroin|ecstasy|mdma|molly|lsd|acid tabs?|ketamine|fentanyl|opium|crack|dope|bong|illegal drugs?|droga|damo)\b/,
  // Weapons and explosives.
  /\b(guns?|firearms?|pistols?|rifles?|shotguns?|revolvers?|ammo|ammunition|bullets?|grenades?|bombs?|explosives?|dynamite|baril|armas)\b/,
  // Violence against people or animals.
  /\b(kill|murder|stab|shoot|hurt|poison|attack|beat up|kidnap|torture)\s+(someone|somebody|him|her|them|you|people|a person|my \w+|the \w+)\b/,
  /\b(murder|assassinate|hitman|massacre|terrorist|terrorism|patayin)\b/,
  // Sexual content.
  /\b(sex|sexy|porn|porno|pornography|nudes?|naked|horny|escort|prostitutes?|hooker|onlyfans|xxx|hentai|blowjob|boobs|dick|pussy|penis|vagina|kantot|jakol)\b/,
  // Profanity and abuse.
  /\b(fuck|fucking|shit|bitch|bastard|asshole|cunt|nigga|nigger|faggot|retard|putang ?ina|tangina|gago|bobo|tanga)\b/,
  // Attempts to make the adviser break its rules.
  /\b(prompt injection|jailbreak|system prompt|developer mode|ignore (all |your |previous |the )?(instructions|rules)|pretend (you are|to be)|act as)\b/,
  // Clearly illegal purchases.
  /\b(stolen|counterfeit|fake (id|money|passport)|hack(ing)? (someone|an account)|hire a hacker)\b/,
];

export function checkSafety(text: string): SafetyVerdict {
  const clean = normalize(text);
  if (SELF_HARM.test(clean)) return 'self_harm';
  return BLOCKED.some((pattern) => pattern.test(clean)) ? 'blocked' : null;
}
