import type { Question } from './game-state'
import { allQuestions, trueFalseQuestions } from './questions'

type Difficulty = Question['difficulty']

type QuestionIndex = {
  all: Question[]
  byCategory: Map<string, Question[]>
  byDifficulty: Map<Difficulty, Question[]>
  byCategoryAndDifficulty: Map<string, Map<Difficulty, Question[]>>
}

function buildQuestionIndex(source: Question[]): QuestionIndex {
  const byCategory = new Map<string, Question[]>()
  const byDifficulty = new Map<Difficulty, Question[]>()
  const byCategoryAndDifficulty = new Map<string, Map<Difficulty, Question[]>>()

  source.forEach((question) => {
    const categoryQuestions = byCategory.get(question.category) || []
    categoryQuestions.push(question)
    byCategory.set(question.category, categoryQuestions)

    const difficultyQuestions = byDifficulty.get(question.difficulty) || []
    difficultyQuestions.push(question)
    byDifficulty.set(question.difficulty, difficultyQuestions)

    const difficultyMap = byCategoryAndDifficulty.get(question.category) || new Map<Difficulty, Question[]>()
    const scopedQuestions = difficultyMap.get(question.difficulty) || []
    scopedQuestions.push(question)
    difficultyMap.set(question.difficulty, scopedQuestions)
    byCategoryAndDifficulty.set(question.category, difficultyMap)
  })

  return {
    all: source,
    byCategory,
    byDifficulty,
    byCategoryAndDifficulty,
  }
}

function randomize<T>(items: T[]): T[] {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }
  return copy
}

function dedupeQuestions(questions: Question[]): Question[] {
  const seen = new Set<string>()
  const result: Question[] = []

  questions.forEach((question) => {
    if (seen.has(question.id)) return
    seen.add(question.id)
    result.push(question)
  })

  return result
}

const standardIndex = buildQuestionIndex(allQuestions)
const trueFalseIndex = buildQuestionIndex(trueFalseQuestions)

function getScopedQuestions(index: QuestionIndex, categories?: string[], difficulty?: string): Question[] {
  if (!categories?.length && !difficulty) {
    return index.all
  }

  if (categories?.length && difficulty) {
    return dedupeQuestions(
      categories.flatMap((category) => index.byCategoryAndDifficulty.get(category)?.get(difficulty as Difficulty) || [])
    )
  }

  if (categories?.length) {
    return dedupeQuestions(categories.flatMap((category) => index.byCategory.get(category) || []))
  }

  return index.byDifficulty.get(difficulty as Difficulty) || []
}

function takeQuestions(source: Question[], count: number, usedSet: Set<string>): Question[] {
  const unused = source.filter((question) => !usedSet.has(question.id))
  if (unused.length >= count) {
    return randomize(unused).slice(0, count)
  }

  return randomize(source).slice(0, count)
}

function takeWeightedQuestions(source: Question[], count: number, usedSet: Set<string>): Question[] {
  const unused = source.filter((question) => !usedSet.has(question.id))
  const effectivePool = unused.length >= count ? unused : source

  const hardPool = randomize(effectivePool.filter((question) => question.difficulty === 'hard'))
  const mediumPool = randomize(effectivePool.filter((question) => question.difficulty === 'medium'))
  const easyPool = randomize(effectivePool.filter((question) => question.difficulty === 'easy'))

  const hardCount = Math.min(Math.ceil(count * 0.5), hardPool.length)
  const mediumCount = Math.min(Math.ceil(count * 0.35), mediumPool.length)
  const easyCount = Math.max(0, count - hardCount - mediumCount)

  const selected: Question[] = [
    ...hardPool.slice(0, hardCount),
    ...mediumPool.slice(0, mediumCount),
    ...easyPool.slice(0, easyCount),
  ]

  if (selected.length < count) {
    const selectedIds = new Set(selected.map((question) => question.id))
    const remaining = randomize(effectivePool.filter((question) => !selectedIds.has(question.id)))
    selected.push(...remaining.slice(0, count - selected.length))
  }

  return randomize(selected).slice(0, count)
}

export function getQuestionsForRound(
  type: string,
  count: number,
  difficulty?: string,
  categories?: string[],
  usedIds?: string[]
): Question[] {
  const usedSet = new Set(usedIds || [])
  const index = type === 'true-false' ? trueFalseIndex : standardIndex
  const scopedQuestions = getScopedQuestions(index, type === 'true-false' ? undefined : categories, difficulty)

  if (type === 'true-false') {
    return takeQuestions(scopedQuestions, count, usedSet)
  }

  if (difficulty) {
    return takeQuestions(scopedQuestions, count, usedSet)
  }

  return takeWeightedQuestions(scopedQuestions, count, usedSet)
}

export function getQuestionBankStats() {
  const categories = Array.from(standardIndex.byCategory.entries()).map(([category, questions]) => ({
    category,
    count: questions.length,
  }))

  return {
    totalStandardQuestions: standardIndex.all.length,
    totalTrueFalseQuestions: trueFalseIndex.all.length,
    categories,
  }
}
