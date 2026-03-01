import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const questionsFile = path.resolve(__dirname, '../lib/questions.ts')
const content = readFileSync(questionsFile, 'utf-8')

// Count occurrences of "id: '" which marks each question
const matches = content.match(/id: '/g)
console.log(`Total de perguntas no questions.ts: ${matches ? matches.length : 0}`)

// Count by category
const catMatches = content.match(/category: '([^']+)'/g)
if (catMatches) {
  const cats = {}
  catMatches.forEach(m => {
    const cat = m.replace("category: '", '').replace("'", '')
    cats[cat] = (cats[cat] || 0) + 1
  })
  console.log('\nPor categoria:')
  Object.entries(cats).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count} perguntas`)
  })
  console.log(`\nTotal categorias: ${Object.keys(cats).length}`)
}

// Count by difficulty
const diffMatches = content.match(/difficulty: '([^']+)'/g)
if (diffMatches) {
  const diffs = {}
  diffMatches.forEach(m => {
    const d = m.replace("difficulty: '", '').replace("'", '')
    diffs[d] = (diffs[d] || 0) + 1
  })
  console.log('\nPor dificuldade:')
  Object.entries(diffs).forEach(([d, count]) => {
    console.log(`  ${d}: ${count} perguntas`)
  })
}
