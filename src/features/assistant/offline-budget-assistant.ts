import type { MonthAnalytics } from '@/features/analytics/analytics';
import { budgetUsage, type MonthlyBudget } from '@/features/budget/types';
import type { DashboardCategory } from '@/features/dashboard/dashboard-data';
import { formatPeso, percentOf } from '@/lib/format';

export type BudgetAssistantContext = { current: MonthAnalytics; previous: MonthAnalytics; categories: DashboardCategory[]; budget?: MonthlyBudget };
export type BudgetAssistantMemory = { lastIntent?: 'spending' | 'budget' | 'category' | 'comparison' | 'recommendation'; lastCategoryId?: string };
export type BudgetAssistantReply = { text: string; memory: BudgetAssistantMemory };

const REFUSAL = "I’m your ExpenSense budget helper, so I can only help with your spending, transactions, categories, and budgets. Try asking how much you spent or what budget you have left.";
const normalize = (value: string) => value.toLocaleLowerCase().replace(/[^a-z0-9\s&]/g, ' ').replace(/\s+/g, ' ').trim();
const categoryTotal = (context: BudgetAssistantContext, categoryId: string) => context.current.expenses.filter((expense) => expense.categoryId === categoryId).reduce((sum, expense) => sum + expense.amountCents, 0);

export function answerBudgetQuestion(question: string, context: BudgetAssistantContext, memory: BudgetAssistantMemory = {}): BudgetAssistantReply {
  const query = normalize(question);
  const reply = (text: string, next: BudgetAssistantMemory = memory): BudgetAssistantReply => ({ text, memory: next });
  if (!query) return reply('Ask me about this month’s spending, remaining budget, categories, or comparison with last month.');
  if (/^(hi|hello|hey|help|what can you do)/.test(query)) return reply('I can explain your current spending, remaining budget, category totals, transaction count, and changes from last month—all locally on this device.');
  const explicitCategory = [...context.categories].sort((a, b) => b.fullLabel.length - a.fullLabel.length).find((item) => query.includes(normalize(item.fullLabel)) || query.includes(normalize(item.label)));
  const category = explicitCategory ?? (/^(what about|and|how about|that category|it)/.test(query) && memory.lastCategoryId ? context.categories.find((item) => item.id === memory.lastCategoryId) : undefined);
  if (category) {
    const spent = categoryTotal(context, category.id);
    const limit = context.budget?.categoryBudgets.find((item) => item.categoryId === category.id);
    if (/budget|limit|left|remain|available|over/.test(query)) {
      if (!limit) return reply(`You have spent ${formatPeso(spent)} on ${category.fullLabel} this month, but no category budget is set for it.`, { lastIntent: 'category', lastCategoryId: category.id });
      const remaining = limit.amountCents - spent;
      return reply(remaining < 0 ? `${category.fullLabel} is ${formatPeso(Math.abs(remaining))} over its ${formatPeso(limit.amountCents)} limit.` : `${category.fullLabel} has ${formatPeso(remaining)} left from its ${formatPeso(limit.amountCents)} limit.`, { lastIntent: 'category', lastCategoryId: category.id });
    }
    return reply(`You have spent ${formatPeso(spent)} on ${category.fullLabel} this month.`, { lastIntent: 'category', lastCategoryId: category.id });
  }
  if (/how many|transaction count|transactions/.test(query)) return reply(`You recorded ${context.current.expenses.length} transaction${context.current.expenses.length === 1 ? '' : 's'} this month.`, { lastIntent: 'spending' });
  if (/compare|last month|higher|lower|change|trend/.test(query)) {
    if (context.previous.totalCents <= 0) return reply('There is not enough spending history from last month for a reliable comparison yet.', { lastIntent: 'comparison' });
    const change = Math.round(((context.current.totalCents - context.previous.totalCents) / context.previous.totalCents) * 100);
    if (change === 0) return reply(`Your spending matches last month at ${formatPeso(context.current.totalCents)}.`, { lastIntent: 'comparison' });
    return reply(`You have spent ${Math.abs(change)}% ${change > 0 ? 'more' : 'less'} than last month (${formatPeso(context.previous.totalCents)}).`, { lastIntent: 'comparison' });
  }
  if (/top|highest|most|largest category|where.*money/.test(query)) {
    const top = context.current.categorySlices[0];
    const topCategory = top ? context.categories.find((item) => item.id === top.id) : undefined;
    return reply(top ? `${top.label} is your highest category at ${formatPeso(top.amountCents)}, or ${Math.round(top.percentage)}% of this month’s spending.` : 'There are no expenses in the selected month yet.', { lastIntent: 'category', lastCategoryId: topCategory?.id });
  }
  if (/left|remain|available|over budget|budget status|budget/.test(query)) {
    const usage = budgetUsage(context.budget, context.current.expenses);
    if (!usage.hasBudget) return reply(`You have spent ${formatPeso(context.current.totalCents)}, but no category budgets are set for this month.`, { lastIntent: 'budget' });
    const used = percentOf(usage.spentCents, usage.limitCents) ?? 0;
    return reply(usage.remainingCents < 0 ? `You are ${formatPeso(Math.abs(usage.remainingCents))} over your ${formatPeso(usage.limitCents)} in category budgets (${used}% used).` : `You have ${formatPeso(usage.remainingCents)} left from your ${formatPeso(usage.limitCents)} in category budgets (${used}% used).`, { lastIntent: 'budget' });
  }
  if (/spent|spending|expense|total/.test(query)) return reply(`You have spent ${formatPeso(context.current.totalCents)} this month across ${context.current.expenses.length} transaction${context.current.expenses.length === 1 ? '' : 's'}.`, { lastIntent: 'spending' });
  if (/save|reduce|recommend|advice|cut/.test(query)) {
    const top = context.current.categorySlices[0];
    return reply(top ? `${top.label} is currently your largest category at ${formatPeso(top.amountCents)}. Review its transactions first and consider setting a category limit.` : 'Add a few expenses first and I’ll suggest where you may be able to reduce spending.', { lastIntent: 'recommendation', lastCategoryId: top?.id });
  }
  if (/^(why|tell me more|explain|how so)/.test(query) && memory.lastIntent) return reply('That answer is calculated from the selected month’s saved transactions and budget limits. I don’t estimate or invent amounts.', memory);
  return reply(REFUSAL, memory);
}
