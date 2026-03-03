import { create } from 'zustand'
import type { GamePhase, RoundType, HostAnimation, Player, CounterAttackCard, SabotageType } from './game-state'
import { appendStoredQuestionHistory, clearStoredSession, saveStoredSession } from './client-session'

interface QuestionData {
  id: string
  text: string
  category: string
  options: string[]
  difficulty: string
}

interface GameStore {
  // Connection
  roomId: string | null
  playerId: string | null
  playerName: string | null
  playerToken: string | null
  connected: boolean

  // Game state from server
  phase: GamePhase
  players: Player[]
  currentRound: number
  totalRounds: number
  roundType: RoundType | null
  question: QuestionData | null
  correctIndex: number | null
  answersMap: Record<string, number> | null
  timer: number
  phaseEndsAt: number | null
  serverNow: number
  serverOffsetMs: number
  hostMessage: string
  hostAnimation: HostAnimation
  eliminatedThisRound: string[]
  selectedCategories: string[]
  stealVotes: Record<string, string>
  stealVictimId: string | null
  stolenPoints: number
  counterAttackTargetId: string | null
  counterAttackCards: CounterAttackCard[]
  chosenCardIndex: number | null

  // Local UI state
  selectedAnswer: number | null
  selectedSabotageTarget: string | null
  hasAnswered: boolean
  showRoundAnnouncement: boolean

  // Actions
  setConnection: (roomId: string, playerId: string, playerName: string, playerToken: string) => void
  setConnected: (connected: boolean) => void
  updateGameState: (state: Partial<GameStore>) => void
  selectAnswer: (index: number) => void
  applyOptimisticSabotage: (targetPlayerId: string, sabotageType: SabotageType) => void
  resetAnswer: () => void
  setSabotageTarget: (playerId: string | null) => void
  setShowRoundAnnouncement: (show: boolean) => void
  reset: () => void
}

const initialState = {
  roomId: null,
  playerId: null,
  playerName: null,
  playerToken: null,
  connected: false,
  phase: 'waiting' as GamePhase,
  players: [],
  currentRound: 0,
  totalRounds: 5,
  roundType: null,
  question: null,
  correctIndex: null,
  answersMap: null,
  timer: 0,
  phaseEndsAt: null,
  serverNow: 0,
  serverOffsetMs: 0,
  hostMessage: '',
  hostAnimation: 'idle' as HostAnimation,
  eliminatedThisRound: [],
  selectedCategories: [],
  stealVotes: {},
  stealVictimId: null,
  stolenPoints: 0,
  counterAttackTargetId: null,
  counterAttackCards: [],
  chosenCardIndex: null,
  selectedAnswer: null,
  selectedSabotageTarget: null,
  hasAnswered: false,
  showRoundAnnouncement: false,
}

export const useGameStore = create<GameStore>((set) => ({
  ...initialState,

  setConnection: (roomId, playerId, playerName, playerToken) => {
    saveStoredSession({ roomId, playerId, playerName, playerToken })
    set({ roomId, playerId, playerName, playerToken })
  },

  setConnected: (connected) => set({ connected }),

  updateGameState: (state) =>
    set((prev) => {
      const nextPlayers = Array.isArray(state.players) ? state.players : prev.players
      const currentPlayerStillPresent =
        !prev.playerId || nextPlayers.some((player) => player.id === prev.playerId)

      if (!currentPlayerStillPresent) {
        clearStoredSession()
        return {
          ...initialState,
          connected: false,
        }
      }

      const newPhase = state.phase ?? prev.phase
      const phaseChanged = newPhase !== prev.phase
      const incomingQuestion = state.question
      const nextServerNow = typeof state.serverNow === 'number' ? state.serverNow : prev.serverNow

      if (incomingQuestion?.id && incomingQuestion.id !== prev.question?.id) {
        appendStoredQuestionHistory(incomingQuestion.id)
      }

      return {
        ...state,
        serverOffsetMs: typeof state.serverNow === 'number' ? nextServerNow - Date.now() : prev.serverOffsetMs,
        // Reset answer when phase changes to a new question
        selectedAnswer: phaseChanged && (newPhase === 'question' || newPhase === 'answering')
          ? null
          : prev.selectedAnswer,
        hasAnswered: phaseChanged && (newPhase === 'question' || newPhase === 'answering')
          ? false
          : prev.hasAnswered,
        // Show round announcement
        showRoundAnnouncement: phaseChanged && newPhase === 'round-announce'
          ? true
          : phaseChanged
            ? false
            : prev.showRoundAnnouncement,
      }
    }),

  selectAnswer: (index) => set({ selectedAnswer: index, hasAnswered: true }),
  applyOptimisticSabotage: (targetPlayerId, sabotageType) =>
    set((prev) => {
      const now = Date.now()
      const expiresAt =
        now +
        (sabotageType === 'freeze'
          ? 3000
          : sabotageType === 'invert'
            ? 5000
            : sabotageType === 'blind'
              ? 4000
              : 999999)

      return {
        players: prev.players.map((player) => {
          if (player.id === prev.playerId) {
            return {
              ...player,
              sabotages: player.sabotages.map((sabotage) =>
                sabotage.type === sabotageType ? { ...sabotage, used: true } : sabotage
              ),
            }
          }

          if (player.id === targetPlayerId) {
            return {
              ...player,
              activeSabotageEffect: {
                type: sabotageType,
                fromPlayerId: prev.playerId || '',
                toPlayerId: targetPlayerId,
                expiresAt,
              },
            }
          }

          return player
        }),
        hostMessage: 'Sabotagem enviada!',
        hostAnimation: 'point',
      }
    }),
  resetAnswer: () => set({ selectedAnswer: null, hasAnswered: false }),
  setSabotageTarget: (playerId) => set({ selectedSabotageTarget: playerId }),
  setShowRoundAnnouncement: (show) => set({ showRoundAnnouncement: show }),
  reset: () => {
    clearStoredSession()
    set(initialState)
  },
}))
