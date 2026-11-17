import { z } from 'zod';

/** The six categories required by the team plan. */
export const CATEGORY_KEYS = [
  'codeStyle',
  'bestPractices',
  'designPatterns',
  'possibleBugs',
  'securityIssues',
  'refactoring',
] as const;

export const SEVERITIES = ['info', 'low', 'medium', 'high', 'critical'] as const;

const findingSchema = z.object({
  title: z.string().min(1).max(200),
  severity: z.enum(SEVERITIES),
  /** 1-based line number, or null when the finding is about the whole file. */
  line: z.number().int().positive().nullable(),
  description: z.string().min(1),
  suggestion: z.string().min(1),
});

const categorySchema = z.object({
  score: z.number().int().min(0).max(100),
  findings: z.array(findingSchema),
});

/** Used by Member 2 for the code visualization (nodes + connections). */
const structureSchema = z.object({
  nodes: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      type: z.enum(['module', 'function', 'class', 'variable', 'other']),
      line: z.number().int().positive().nullable(),
    }),
  ),
  edges: z.array(
    z.object({
      from: z.string().min(1),
      to: z.string().min(1),
      relation: z.enum(['contains', 'calls', 'extends', 'uses', 'imports']),
    }),
  ),
});

export const reviewSchema = z.object({
  overallScore: z.number().int().min(0).max(100),
  summary: z.string().min(1),
  categories: z.object({
    codeStyle: categorySchema,
    bestPractices: categorySchema,
    designPatterns: categorySchema,
    possibleBugs: categorySchema,
    securityIssues: categorySchema,
    refactoring: categorySchema,
  }),
  refactoredCode: z.string(),
  documentation: z.string().min(1),
  unitTestStubs: z.string().min(1),
  structure: structureSchema,
});

export type Review = z.infer<typeof reviewSchema>;
export type Finding = z.infer<typeof findingSchema>;
export type CategoryKey = (typeof CATEGORY_KEYS)[number];
