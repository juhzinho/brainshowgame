import { z } from 'zod'
import { QUESTION_CATEGORIES } from './game-state'

const validCategories = QUESTION_CATEGORIES.map((category) => category.id)

export const playerNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(15)
  .transform((value) => value.replace(/\s+/g, ' '))

export const playerAuthSchema = z.object({
  playerId: z.string().uuid(),
  playerToken: z.string().min(16).max(128).optional(),
})

export const createRoomSchema = z.object({
  playerName: playerNameSchema,
  historyOwnerId: z.string().uuid().optional(),
  usedQuestionIds: z.array(z.string()).max(500).optional(),
})

export const joinRoomSchema = z.object({
  playerName: playerNameSchema,
})

export const answerSchema = playerAuthSchema.extend({
  answerIndex: z.number().int().min(0).max(3),
})

export const sabotageSchema = playerAuthSchema.extend({
  targetPlayerId: z.string().uuid(),
  sabotageType: z.enum(['freeze', 'invert', 'steal', 'blind', 'halve']),
})

export const categoriesSchema = playerAuthSchema.extend({
  categories: z.array(z.enum(validCategories as [string, ...string[]])).max(validCategories.length),
})

export const stealVoteSchema = playerAuthSchema.extend({
  targetId: z.string().uuid(),
})

export const counterAttackSchema = playerAuthSchema.extend({
  cardIndex: z.number().int().min(0).max(4),
})
