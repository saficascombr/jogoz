import { useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { loadPlayers, savePlayers } from './storage'
import type { Player } from './types'
import './App.css'

function createId(): string {
  return crypto.randomUUID()
}

function buildPool(players: Player[]): string[] {
  const pool: string[] = []
  for (const player of players) {
    for (let i = 0; i < player.chances; i += 1) {
      pool.push(player.name)
    }
  }
  return pool
}

function pickWinner(pool: string[]): string {
  const index = Math.floor(Math.random() * pool.length)
  return pool[index]!
}

type ConfettiPiece = {
  id: string
  left: number
  delay: number
  duration: number
  color: string
  rotate: number
  drift: number
  width: number
  height: number
  round: boolean
}

const CONFETTI_COLORS = ['#ffe7ac', '#f05a28', '#3ecfbf', '#ffffff', '#ff8f66', '#7ef0e4']

function createConfetti(count = 90): ConfettiPiece[] {
  return Array.from({ length: count }, () => {
    const round = Math.random() > 0.65
    const size = 10 + Math.random() * 14
    return {
      id: createId(),
      left: Math.random() * 100,
      delay: Math.random() * 0.55,
      duration: 2.8 + Math.random() * 2.2,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]!,
      rotate: Math.random() * 360,
      drift: -140 + Math.random() * 280,
      width: round ? size : 8 + Math.random() * 10,
      height: round ? size : 14 + Math.random() * 18,
      round,
    }
  })
}

const REEL_ITEM_HEIGHT = 78
const REEL_SPIN_MS = 3400

function buildReel(names: string[], winnerName: string): string[] {
  const strip: string[] = []
  const loops = Math.max(10, Math.ceil(28 / Math.max(names.length, 1)))
  for (let loop = 0; loop < loops; loop += 1) {
    for (const entry of names) {
      strip.push(entry)
    }
  }
  strip.push(winnerName)
  return strip
}

export default function App() {
  const [players, setPlayers] = useState<Player[]>(() => loadPlayers())
  const [name, setName] = useState('')
  const [chances, setChances] = useState('1')
  const [formError, setFormError] = useState('')
  const [listOpen, setListOpen] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [spinning, setSpinning] = useState(false)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [winner, setWinner] = useState<string | null>(null)
  const [sorteioHint, setSorteioHint] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([])
  const [reelItems, setReelItems] = useState<string[]>([])
  const [reelOffset, setReelOffset] = useState(0)
  const [reelTransition, setReelTransition] = useState(false)
  const spinTimer = useRef<number | null>(null)
  const confettiTimer = useRef<number | null>(null)
  const nameInputId = useId()
  const chancesInputId = useId()

  useEffect(() => {
    savePlayers(players)
  }, [players])

  useEffect(() => {
    return () => {
      if (spinTimer.current !== null) {
        window.clearTimeout(spinTimer.current)
      }
      if (confettiTimer.current !== null) {
        window.clearTimeout(confettiTimer.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const timeoutId = window.setTimeout(() => setToast(null), 3000)
    return () => window.clearTimeout(timeoutId)
  }, [toast])

  function handleAdd(event: FormEvent) {
    event.preventDefault()
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }

    const trimmed = name.trim()
    const parsedChances = Number.parseInt(chances, 10)

    if (!trimmed) {
      setFormError('Escreva o nome da pessoa.')
      return
    }
    if (!Number.isFinite(parsedChances) || parsedChances < 1) {
      setFormError('Chances precisa ser um número inteiro de pelo menos 1.')
      return
    }

    setPlayers((current) => [
      ...current,
      { id: createId(), name: trimmed, chances: parsedChances },
    ])
    const label = parsedChances === 1 ? 'entrada' : 'entradas'
    setToast(`${trimmed} foi incluído com ${parsedChances} ${label} no sorteio`)
    setName('')
    setChances('1')
    setFormError('')
  }

  function updateChances(id: string, next: number) {
    if (!Number.isFinite(next) || next < 1) return
    setPlayers((current) =>
      current.map((player) =>
        player.id === id ? { ...player, chances: Math.floor(next) } : player,
      ),
    )
  }

  function removePlayer(id: string) {
    setPlayers((current) => current.filter((player) => player.id !== id))
  }

  function clearList() {
    setPlayers([])
    setWinner(null)
    setDisplayName(null)
    setConfetti([])
    setReelItems([])
    setReelOffset(0)
    setReelTransition(false)
    setSorteioHint('')
    setConfirmClear(false)
    setListOpen(false)
  }

  function revealWinner(chosen: string) {
    if (spinTimer.current !== null) {
      window.clearTimeout(spinTimer.current)
      spinTimer.current = null
    }

    setDisplayName(chosen)
    setWinner(chosen)
    setSpinning(false)
    setReelTransition(false)
    setReelItems([])
    setReelOffset(0)
    setConfetti(createConfetti())

    if (confettiTimer.current !== null) {
      window.clearTimeout(confettiTimer.current)
    }
    confettiTimer.current = window.setTimeout(() => {
      setConfetti([])
      confettiTimer.current = null
    }, 5200)
  }

  function handleSortear() {
    if (spinning) return

    const pool = buildPool(players)
    if (pool.length === 0) {
      setSorteioHint('Adicione pelo menos uma pessoa antes de sortear.')
      return
    }

    const chosen = pickWinner(pool)
    const names = players.map((player) => player.name)
    const strip = buildReel(names, chosen)
    const finalOffset = -(strip.length - 1) * REEL_ITEM_HEIGHT

    setSorteioHint('')
    setWinner(null)
    setDisplayName(null)
    setConfetti([])
    setReelItems(strip)
    setReelTransition(false)
    setReelOffset(0)
    setSpinning(true)

    if (spinTimer.current !== null) {
      window.clearTimeout(spinTimer.current)
      spinTimer.current = null
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setReelTransition(true)
        setReelOffset(finalOffset)
      })
    })

    spinTimer.current = window.setTimeout(() => {
      revealWinner(chosen)
    }, REEL_SPIN_MS + 80)
  }

  const totalEntries = players.reduce((sum, player) => sum + player.chances, 0)

  return (
    <div className="page">
      <div className="page-glow" aria-hidden="true" />

      <header className="brand">
        <img
          className="brand-logo"
          src="/logo-jogoz.png"
          alt="JOGOZ — Jogatina em Oz City"
        />
      </header>

      <main className="main">
        <section className="add-section" aria-labelledby="add-heading">
          <h2 id="add-heading" className="section-title">
            Adicionar jogador
          </h2>
          <p className="section-copy">
            Cada vitória vale +1 chance. Coloque o nome e quantas vezes ele entra
            no sorteio.
          </p>

          <form className="add-form" onSubmit={handleAdd}>
            <div className="field">
              <label htmlFor={nameInputId}>Nome</label>
              <input
                id={nameInputId}
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex.: Giovanna"
                autoComplete="off"
                enterKeyHint="done"
              />
            </div>
            <div className="field field-chances">
              <label htmlFor={chancesInputId}>Chances</label>
              <input
                id={chancesInputId}
                type="number"
                min={1}
                step={1}
                value={chances}
                onChange={(event) => setChances(event.target.value)}
                placeholder="10"
                enterKeyHint="done"
              />
            </div>
            <button type="submit" className="btn btn-add">
              Adicionar novo jogador
            </button>
          </form>
          {formError ? <p className="form-error">{formError}</p> : null}
        </section>

        <section className="draw-section" aria-labelledby="draw-heading">
          <h2 id="draw-heading" className="visually-hidden">
            Sorteio
          </h2>

          <div className="draw-actions">
            <button
              type="button"
              className={`btn btn-sortear${spinning || winner ? ' is-drawing' : ''}`}
              onClick={handleSortear}
              disabled={spinning}
            >
              {spinning ? 'Sorteando...' : 'SORTEAR'}
            </button>
            <button
              type="button"
              className="btn btn-list"
              onClick={() => setListOpen(true)}
            >
              Ver lista de nomes
            </button>
          </div>

          {sorteioHint ? <p className="form-error">{sorteioHint}</p> : null}

          <div
            className={`result-stage${winner && !spinning ? ' is-winner' : ''}${spinning ? ' is-spinning' : ''}`}
            aria-live="polite"
          >
            {winner && !spinning ? (
              <p className="congrats-title">PARABÉNS!</p>
            ) : null}

            {spinning || (reelItems.length > 0 && !winner) ? (
              <div className="reel-window" aria-hidden={false}>
                <div
                  className={`reel-strip${reelTransition ? ' is-spinning' : ''}`}
                  style={{
                    transform: `translate3d(0, ${reelOffset}px, 0)`,
                    transitionDuration: reelTransition ? `${REEL_SPIN_MS}ms` : '0ms',
                  }}
                >
                  {reelItems.map((entry, index) => (
                    <div key={`${entry}-${index}`} className="reel-item">
                      {entry}
                    </div>
                  ))}
                </div>
              </div>
            ) : displayName ? (
              <p className="result-name">{displayName}</p>
            ) : (
              <p className="result-placeholder">O nome sorteado aparece aqui</p>
            )}

            {winner && !spinning ? (
              <p className="result-caption">o prêmio é seu!</p>
            ) : null}
          </div>
        </section>
      </main>

      <footer className="footer">
        {!confirmClear ? (
          <button
            type="button"
            className="btn btn-clear"
            onClick={() => setConfirmClear(true)}
          >
            Zerar lista
          </button>
        ) : (
          <div className="clear-confirm" role="group" aria-label="Confirmar zerar lista">
            <p>Tem certeza que quer fazer isso?</p>
            <div className="clear-actions">
              <button type="button" className="btn btn-clear-yes" onClick={clearList}>
                Sim, zerar
              </button>
              <button
                type="button"
                className="btn btn-clear-no"
                onClick={() => setConfirmClear(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </footer>

      {listOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setListOpen(false)}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="list-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="list-title">Lista de nomes</h2>
              <button
                type="button"
                className="btn btn-close"
                onClick={() => setListOpen(false)}
              >
                Fechar
              </button>
            </div>
            <p className="modal-summary">
              {players.length === 0
                ? 'Ninguém na lista ainda.'
                : `${players.length} pessoa(s) · ${totalEntries} entrada(s) no sorteio`}
            </p>

            {players.length > 0 ? (
              <ul className="player-list">
                {players.map((player) => (
                  <li key={player.id} className="player-row">
                    <span className="player-name">{player.name}</span>
                    <label className="player-chances">
                      <span className="visually-hidden">Chances de {player.name}</span>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={player.chances}
                        onChange={(event) =>
                          updateChances(
                            player.id,
                            Number.parseInt(event.target.value, 10),
                          )
                        }
                      />
                      <span aria-hidden="true">×</span>
                    </label>
                    <button
                      type="button"
                      className="btn btn-remove"
                      onClick={() => removePlayer(player.id)}
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="toast" role="status">
          <p className="toast-message">{toast}</p>
          <button
            type="button"
            className="btn btn-toast-close"
            onClick={() => setToast(null)}
            aria-label="Fechar confirmação"
          >
            ×
          </button>
        </div>
      ) : null}

      {confetti.length > 0 ? (
        <div className="confetti-layer" aria-hidden="true">
          {confetti.map((piece) => (
            <span
              key={piece.id}
              className={`confetti-piece${piece.round ? ' is-round' : ''}`}
              style={{
                left: `${piece.left}%`,
                width: `${piece.width}px`,
                height: `${piece.height}px`,
                backgroundColor: piece.color,
                animationDelay: `${piece.delay}s`,
                animationDuration: `${piece.duration}s`,
                '--confetti-rotate': `${piece.rotate}deg`,
                '--confetti-drift': `${piece.drift}px`,
              } as CSSProperties}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
