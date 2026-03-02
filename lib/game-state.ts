// ========================
// Brain Show: Party Game 3D
// Game State Types
// ========================

export type RoundType = 'classic' | 'true-false' | 'elimination' | 'blitz' | 'final'
export type SabotageType = 'freeze' | 'invert' | 'steal' | 'blind' | 'halve'
export type GamePhase =
  | 'waiting'
  | 'round-announce'
  | 'question'
  | 'answering'
  | 'reveal'
  | 'sabotage-result'
  | 'round-scores'
  | 'steal-vote'
  | 'steal-result'
  | 'counter-attack'
  | 'counter-result'
  | 'final-scores'
  | 'finished'

export type HostAnimation = 'idle' | 'talk' | 'point' | 'celebrate' | 'sad'

export interface SabotageEffect {
  type: SabotageType
  fromPlayerId: string
  toPlayerId: string
  expiresAt: number
}

export interface Sabotage {
  type: SabotageType
  used: boolean
}

export interface Player {
  id: string
  name: string
  color: string
  score: number
  sabotages: Sabotage[]
  isReady: boolean
  isHost: boolean
  isEliminated: boolean
  activeSabotageEffect: SabotageEffect | null
  streak: number
  lastAnswerCorrect: boolean | null
  betAmount: number
  connected: boolean
  lastActiveAt?: number
}

export interface Question {
  id: string
  category: string
  text: string
  options: string[]
  correctIndex: number
  difficulty: 'easy' | 'medium' | 'hard'
}

export interface RoundConfig {
  type: RoundType
  questionCount: number
  timePerQuestion: number
  pointsPerCorrect: number
  bonusForSpeed: boolean
}

export interface CategoryInfo {
  id: string
  name: string
  icon: string
  image: string
}

export const QUESTION_CATEGORIES: CategoryInfo[] = [
  { id: 'Matematica', name: 'Matematica', icon: 'calculator', image: '/images/cat-matematica.jpg' },
  { id: 'Conhecimento Geral', name: 'Conhecimento Geral', icon: 'brain', image: '/images/cat-conhecimento.jpg' },
  { id: 'Musica', name: 'Musica', icon: 'music', image: '/images/cat-musica.jpg' },
  { id: 'Historia', name: 'Historia', icon: 'scroll', image: '/images/cat-historia.jpg' },
  { id: 'Ciencia', name: 'Ciencia', icon: 'atom', image: '/images/cat-ciencia.jpg' },
  { id: 'Geografia', name: 'Geografia', icon: 'globe', image: '/images/cat-geografia.jpg' },
  { id: 'Filmes e Series', name: 'Filmes e Series', icon: 'film', image: '/images/cat-filmes.jpg' },
  { id: 'Esportes', name: 'Esportes', icon: 'trophy', image: '/images/cat-esportes.jpg' },
  { id: 'Cultura e Linguas', name: 'Cultura e Linguas', icon: 'book', image: '/images/cat-cultura.jpg' },
  { id: 'Tecnologia', name: 'Tecnologia', icon: 'cpu', image: '/images/cat-tecnologia.jpg' },
]

export const CATEGORY_IMAGE_MAP: Record<string, string> = Object.fromEntries(
  QUESTION_CATEGORIES.map(c => [c.id, c.image])
)

export type CounterAttackType = 'zero' | 'half' | 'shield' | 'reverse' | 'bomb' | 'nothing' | 'double-steal'

export interface CounterAttackCard {
  type: CounterAttackType
  name: string
  description: string
  color: string
}

export const ALL_COUNTER_ATTACKS: CounterAttackCard[] = [
  { type: 'zero', name: 'Zerar Alvo', description: 'Zera os pontos de um jogador a sua escolha!', color: '#e94560' },
  { type: 'half', name: 'Metade Geral', description: 'Reduz pela metade os pontos de TODOS os outros!', color: '#ff851b' },
  { type: 'shield', name: 'Escudo', description: 'Recupera todos os pontos roubados!', color: '#4da8da' },
  { type: 'reverse', name: 'Reverso', description: 'Quem votou em voce perde 50% dos pontos!', color: '#B10DC9' },
  { type: 'bomb', name: 'Bomba', description: 'O jogador com mais pontos perde 40%!', color: '#FF4136' },
  { type: 'nothing', name: 'Nada', description: 'Azar! Nenhum contra-ataque.', color: '#555' },
  { type: 'double-steal', name: 'Roubo Duplo', description: 'Rouba o dobro dos pontos de quem mais votou em voce!', color: '#ffd700' },
]

export interface Room {
  id: string
  hostId: string
  players: Player[]
  maxPlayers: number
  state: GamePhase
  currentRound: number
  totalRounds: number
  rounds: RoundConfig[]
  currentQuestion: Question | null
  currentQuestionIndex: number
  timer: number
  answers: Record<string, number>
  answerTimestamps: Record<string, number>
  hostMessage: string
  hostAnimation: HostAnimation
  eliminatedThisRound: string[]
  selectedCategories: string[]
  usedQuestionIds: string[]
  stealVotes: Record<string, string> // voterId -> targetId
  stealVictimId: string | null
  stolenPoints: number
  counterAttackTargetId: string | null
  counterAttackCards: CounterAttackCard[]
  chosenCardIndex: number | null
  roundQuestions: Question[]
  phaseStartedAt: number | null
  phaseEndsAt: number | null
  phaseDetail: string | null
  playerTokens: Record<string, string>
  createdAt: number
}

// SSE Event types sent to clients
export interface GameEvent {
  type: string
  data: Partial<ClientGameState>
  timestamp: number
}

// State sent to each client (no correct answers exposed during question)
export interface ClientGameState {
  roomId: string
  phase: GamePhase
  players: Player[]
  currentRound: number
  totalRounds: number
  roundType: RoundType | null
  question: {
    id: string
    text: string
    category: string
    options: string[]
    difficulty: string
  } | null
  correctIndex: number | null // only sent during 'reveal' phase
  answersMap: Record<string, number> | null // playerId -> answerIndex, only during 'reveal'
  timer: number
  phaseEndsAt: number | null
  hostMessage: string
  hostAnimation: HostAnimation
  myPlayerId: string
  eliminatedThisRound: string[]
  selectedCategories: string[]
  stealVotes: Record<string, string>
  stealVictimId: string | null
  stolenPoints: number
  counterAttackTargetId: string | null
  counterAttackCards: CounterAttackCard[]
  chosenCardIndex: number | null
}

// 20 unique player colors
export const PLAYER_COLORS = [
  '#FF4136', // red
  '#0074D9', // blue
  '#2ECC40', // green
  '#FF851B', // orange
  '#B10DC9', // purple
  '#FFDC00', // yellow
  '#01FF70', // lime
  '#FF6BB5', // pink
  '#7FDBFF', // aqua
  '#F012BE', // fuchsia
  '#3D9970', // olive
  '#85144b', // maroon
  '#39CCCC', // teal
  '#AAAAAA', // silver
  '#001f3f', // navy
  '#FF4500', // orangered
  '#00CED1', // dark turquoise
  '#FFD700', // gold
  '#8B4513', // saddle brown
  '#00FA9A', // medium spring green
]

export const ROUND_CONFIGS: RoundConfig[] = [
  { type: 'classic', questionCount: 5, timePerQuestion: 15, pointsPerCorrect: 100, bonusForSpeed: true },
  { type: 'true-false', questionCount: 7, timePerQuestion: 8, pointsPerCorrect: 75, bonusForSpeed: false },
  { type: 'blitz', questionCount: 10, timePerQuestion: 6, pointsPerCorrect: 50, bonusForSpeed: true },
  // steal vote happens after round 3
  { type: 'classic', questionCount: 5, timePerQuestion: 14, pointsPerCorrect: 120, bonusForSpeed: true },
  { type: 'elimination', questionCount: 6, timePerQuestion: 12, pointsPerCorrect: 150, bonusForSpeed: false },
  { type: 'true-false', questionCount: 8, timePerQuestion: 7, pointsPerCorrect: 80, bonusForSpeed: false },
  // steal vote happens after round 6
  { type: 'blitz', questionCount: 12, timePerQuestion: 5, pointsPerCorrect: 60, bonusForSpeed: true },
  { type: 'classic', questionCount: 5, timePerQuestion: 13, pointsPerCorrect: 130, bonusForSpeed: true },
  { type: 'elimination', questionCount: 7, timePerQuestion: 10, pointsPerCorrect: 175, bonusForSpeed: false },
  // steal vote happens after round 9
  { type: 'final', questionCount: 5, timePerQuestion: 20, pointsPerCorrect: 200, bonusForSpeed: false },
]

export const ROUND_NAMES: Record<RoundType, string> = {
  'classic': 'Quiz Classico',
  'true-false': 'Verdadeiro ou Falso',
  'elimination': 'Eliminacao',
  'blitz': 'Blitz',
  'final': 'Rodada Final',
}

export const ROUND_DESCRIPTIONS: Record<RoundType, string> = {
  'classic': '4 alternativas, responda rapido para ganhar bonus!',
  'true-false': 'Verdadeiro ou Falso? Rapido e direto!',
  'elimination': 'Errou? Esta fora! Ultimo em pe ganha o bonus!',
  'blitz': '10 perguntas em sequencia ultra-rapida!',
  'final': 'Perguntas valem o dobro! Errar custa 100 pontos!',
}

export const SABOTAGE_NAMES: Record<SabotageType, string> = {
  freeze: 'Congelar',
  invert: 'Inverter',
  steal: 'Roubar',
  blind: 'Cegar',
  halve: 'Metade',
}

export const SABOTAGE_DESCRIPTIONS: Record<SabotageType, string> = {
  freeze: 'Congela o timer do adversario por 3s',
  invert: 'Embaralha as alternativas do adversario',
  steal: 'Rouba 50 pontos se voce acertar',
  blind: 'Esconde a pergunta do adversario por 4s',
  halve: 'Reduz pela metade os pontos da proxima resposta',
}
