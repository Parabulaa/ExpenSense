/**
 * Example sentences the intent classifier learns from. Adding a line here is
 * how the chatbot learns a new way of asking something. English and common
 * Taglish both appear, since the synonym map folds Tagalog words into English.
 */
export type Intent =
  | 'greeting' | 'thanks' | 'help' | 'who_are_you'
  | 'spent_total' | 'budget_left' | 'category_spent' | 'top_category' | 'compare'
  | 'can_afford' | 'how_to_save' | 'transaction_count' | 'biggest_expense' | 'daily_allowance'
  | 'roast_me' | 'praise_me' | 'why' | 'out_of_scope';

export const TRAINING_DATA: Record<Intent, string[]> = {
  greeting: ['hi', 'hello', 'hey', 'good morning', 'good evening', 'yo', 'sup', 'hello there', 'hey adviser', 'hi mom', 'kumusta', 'hey whats up'],
  thanks: ['thanks', 'thank you', 'ty', 'thanks a lot', 'appreciate it', 'salamat', 'okay thanks', 'got it thanks', 'nice thank you', 'cool thanks'],
  help: ['help', 'what can you do', 'what can i ask', 'how do you work', 'what do you know', 'show me what you can do', 'options', 'commands', 'how to use this'],
  who_are_you: ['who are you', 'what are you', 'are you a bot', 'are you real', 'whats your name', 'who am i talking to', 'are you ai'],
  spent_total: ['how much did i spend', 'how much have i spent', 'total spending', 'what is my total', 'how much this month', 'my expenses this month', 'how much money did i use', 'total expenses', 'how much did i spend this week', 'how much did i spend today', 'spending so far', 'how much spent last month'],
  budget_left: ['how much budget is left', 'budget left', 'how much is left', 'remaining budget', 'how much can i still spend', 'am i over budget', 'budget status', 'whats left in my budget', 'do i still have budget', 'is my budget okay', 'how much left'],
  category_spent: ['how much on food', 'how much did i spend on transport', 'food spending', 'shopping total', 'how much for bills', 'what did i spend on groceries', 'how much on entertainment', 'category spending', 'how much is food left', 'food budget'],
  top_category: ['where does my money go', 'top category', 'what do i spend the most on', 'biggest category', 'highest spending category', 'where am i spending most', 'what eats my money', 'main expense category'],
  compare: ['compare to last month', 'am i spending more than last month', 'is it higher than last month', 'compared with last month', 'did i spend less', 'how does this month compare', 'trend', 'better than last month', 'worse than last month'],
  can_afford: ['can i afford new shoes', 'can i buy this', 'should i buy it', 'is it okay to buy a phone', 'can i afford 2000', 'can i spend 500 on food', 'is 1500 too much', 'can i get a new bag', 'can i treat myself', 'should i buy this for 3000', 'pwede ba bumili', 'can i afford it', 'can i buy a game for 1200'],
  how_to_save: ['how can i save', 'how do i save money', 'tips to save', 'where can i cut', 'how to spend less', 'help me save', 'give me advice', 'how to reduce spending', 'saving tips', 'what should i cut', 'how to budget better'],
  transaction_count: ['how many transactions', 'how many expenses', 'number of purchases', 'how many times did i buy', 'count my expenses', 'how many did i record'],
  biggest_expense: ['biggest expense', 'largest purchase', 'most expensive thing', 'what was my biggest spend', 'highest expense', 'what cost the most'],
  daily_allowance: ['how much can i spend per day', 'daily budget', 'how much per day', 'daily allowance', 'how much can i spend today', 'spend per day until end of month', 'budget per day'],
  roast_me: ['roast me', 'roast my spending', 'be honest', 'judge me', 'roast me harder', 'tell me the truth', 'am i bad with money', 'scold me', 'be brutal'],
  praise_me: ['am i doing good', 'am i doing well', 'praise me', 'say something nice', 'motivate me', 'encourage me', 'am i good with money', 'hype me up'],
  why: ['why', 'how so', 'explain', 'tell me more', 'what do you mean', 'how did you get that', 'why is that', 'details', 'more'],
  out_of_scope: ['what is the weather', 'tell me a joke', 'who won the game', 'write my essay', 'what is the capital of france', 'play music', 'whats the news', 'solve this math', 'recommend a movie', 'how old are you'],
};

/** What a "Did you mean…?" button says for each intent. */
export const INTENT_PROMPTS: Partial<Record<Intent, string>> = {
  spent_total: 'How much have I spent?',
  budget_left: 'How much budget is left?',
  top_category: 'Where does my money go?',
  compare: 'Compare to last month',
  can_afford: 'Can I afford something?',
  how_to_save: 'How can I save?',
  biggest_expense: 'What was my biggest expense?',
  daily_allowance: 'How much can I spend per day?',
  roast_me: 'Roast me',
  praise_me: 'Am I doing well?',
  transaction_count: 'How many expenses did I record?',
};

/** Taglish and slang folded into the words the classifier was trained on. */
export const SYNONYMS: Record<string, string> = {
  magkano: 'how much', gastos: 'spent', gumastos: 'spent', ginastos: 'spent', natitira: 'left', natira: 'left', tira: 'left',
  ipon: 'save', mag: '', ba: '', ko: '', ako: 'i', pwede: 'can', puwede: 'can', bili: 'buy', bumili: 'buy', bibili: 'buy',
  kain: 'food', pagkain: 'food', pamasahe: 'transport', pera: 'money', sobra: 'over', mahal: 'expensive', salamat: 'thanks',
  kumusta: 'hello', bakit: 'why', ngayon: 'today', buwan: 'month', linggo: 'week', araw: 'day',
  u: 'you', ur: 'your', r: 'are', pls: 'please', plz: 'please', thx: 'thanks', tnx: 'thanks', bc: 'because', rn: 'now', $: 'money',
  spend: 'spent', spending: 'spent', expenses: 'expense', bucks: 'money', cash: 'money', afford: 'afford', purchase: 'buy',
};
