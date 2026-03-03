import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const questionsFile = path.resolve(__dirname, '../lib/questions.ts')
const content = readFileSync(questionsFile, 'utf-8')

const questionLineRegex = /\{ id: '([^']+)', category: '([^']+)', text: '([^']+)', options: \[([^\]]+)\], correctIndex: (\d+), difficulty: '([^']+)' \}/g
const parsedQuestions = []

for (const match of content.matchAll(questionLineRegex)) {
  const [, id, category, text, optionsRaw, correctIndexRaw, difficulty] = match
  const options = Array.from(optionsRaw.matchAll(/'([^']*)'/g), (optionMatch) => optionMatch[1])
  parsedQuestions.push({
    id,
    category,
    text,
    options,
    correctIndex: Number(correctIndexRaw),
    difficulty,
  })
}

const duplicateIds = new Map()
const duplicatePrompts = new Map()
const invalidQuestions = []
const mojibakeQuestions = []

for (const question of parsedQuestions) {
  duplicateIds.set(question.id, (duplicateIds.get(question.id) || 0) + 1)

  const promptKey = `${question.category}::${question.text.trim().toLowerCase()}`
  duplicatePrompts.set(promptKey, (duplicatePrompts.get(promptKey) || 0) + 1)

  if (question.options.length < 2) {
    invalidQuestions.push({ id: question.id, problem: 'menos de 2 alternativas' })
  }

  if (question.correctIndex < 0 || question.correctIndex >= question.options.length) {
    invalidQuestions.push({ id: question.id, problem: 'correctIndex fora do intervalo das alternativas' })
  }

  if (new Set(question.options).size !== question.options.length) {
    invalidQuestions.push({ id: question.id, problem: 'alternativas duplicadas' })
  }

  const normalizedText = `${question.text} ${question.options.join(' ')}`
  if (/[ÃÂ�]/.test(normalizedText)) {
    mojibakeQuestions.push(question.id)
  }
}

const duplicateIdEntries = Array.from(duplicateIds.entries()).filter(([, count]) => count > 1)
const duplicatePromptEntries = Array.from(duplicatePrompts.entries()).filter(([, count]) => count > 1)

console.log(`Perguntas parseadas: ${parsedQuestions.length}`)
console.log(`IDs duplicados: ${duplicateIdEntries.length}`)
console.log(`Perguntas duplicadas por categoria/texto: ${duplicatePromptEntries.length}`)
console.log(`Perguntas com problema estrutural: ${invalidQuestions.length}`)
console.log(`Perguntas com possivel texto corrompido: ${mojibakeQuestions.length}`)

if (duplicateIdEntries.length > 0) {
  console.log('\nIDs duplicados:')
  duplicateIdEntries.slice(0, 20).forEach(([id, count]) => console.log(`  ${id}: ${count}`))
}

if (duplicatePromptEntries.length > 0) {
  console.log('\nPerguntas duplicadas por texto:')
  duplicatePromptEntries.slice(0, 20).forEach(([key, count]) => console.log(`  ${key}: ${count}`))
}

if (invalidQuestions.length > 0) {
  console.log('\nProblemas estruturais:')
  invalidQuestions.slice(0, 40).forEach(({ id, problem }) => console.log(`  ${id}: ${problem}`))
}

if (mojibakeQuestions.length > 0) {
  console.log('\nPossivel texto corrompido:')
  mojibakeQuestions.slice(0, 40).forEach((id) => console.log(`  ${id}`))
}
