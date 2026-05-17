import { z } from 'zod';

const autoAggRuleSchema = z.object({
  id: z.string().min(1),
  pattern: z.string().min(1),
  displayName: z.string().min(1),
});

export const autoAggRuleListSchema = z.array(autoAggRuleSchema).max(200);

export type AutoAggRuleItem = z.output<typeof autoAggRuleSchema>;

export function parseAutoAggRuleListPayload(input: unknown):
  { success: true; data: AutoAggRuleItem[] } | { success: false; error: string } {
  const result = autoAggRuleListSchema.safeParse(input);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const path = firstIssue?.path.join('.') || 'root';
    return {
      success: false,
      error: `auto_agg_rules.${path}: ${firstIssue?.message || '格式错误'}`,
    };
  }
  return { success: true, data: result.data };
}
