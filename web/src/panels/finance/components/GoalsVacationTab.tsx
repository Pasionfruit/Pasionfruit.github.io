import { useEffect, useMemo, useState } from 'react'
import { newId } from '../lib/finance'
import type { CardPoints, VacationGoal } from '../../../types/types'

interface GoalsVacationTabProps {
  goals: VacationGoal[]
  cardPoints: CardPoints[]
  onAddGoal: (goal: VacationGoal) => void
  onUpdateGoal: (goalId: string, update: Partial<VacationGoal>) => void
  onDeleteGoal: (goalId: string) => void
  onAddCardPoints: (entry: CardPoints) => void
  onUpdateCardPoints: (entryId: string, update: Partial<CardPoints>) => void
  onDeleteCardPoints: (entryId: string) => void
}

export function GoalsVacationTab(props: GoalsVacationTabProps) {
  const {
    goals,
    cardPoints,
    onAddGoal,
    onUpdateGoal,
    onDeleteGoal,
    onAddCardPoints,
    onUpdateCardPoints,
    onDeleteCardPoints,
  } = props

  const [destination, setDestination] = useState('')
  const [targetAmount, setTargetAmount] = useState(0)
  const [targetDate, setTargetDate] = useState('')
  const [cardName, setCardName] = useState('')
  const [points, setPoints] = useState(0)
  const [centsPerPoint, setCentsPerPoint] = useState(1)
  const [sourceCardId, setSourceCardId] = useState('')
  const [sourcePoints, setSourcePoints] = useState(10000)

  useEffect(() => {
    if (cardPoints.length === 0) {
      setSourceCardId('')
      return
    }

    if (!cardPoints.some((entry) => entry.id === sourceCardId)) {
      setSourceCardId(cardPoints[0].id)
    }
  }, [cardPoints, sourceCardId])

  const sourceCard = useMemo(
    () => cardPoints.find((entry) => entry.id === sourceCardId) ?? null,
    [cardPoints, sourceCardId],
  )

  const sourceValueDollars = useMemo(() => {
    if (!sourceCard) {
      return 0
    }
    const sourceCpp = sourceCard.centsPerPoint ?? 1
    return (sourcePoints * sourceCpp) / 100
  }, [sourceCard, sourcePoints])

  const conversions = useMemo(() => {
    if (!sourceCard) {
      return [] as Array<{ id: string; cardName: string; targetPoints: number; centsPerPoint: number }>
    }

    return cardPoints.map((entry) => {
      const cpp = entry.centsPerPoint ?? 1
      const targetPoints = cpp > 0 ? (sourceValueDollars * 100) / cpp : 0
      return {
        id: entry.id,
        cardName: entry.cardName,
        targetPoints,
        centsPerPoint: cpp,
      }
    })
  }, [cardPoints, sourceCard, sourceValueDollars])

  function addGoal() {
    if (!destination.trim() || !targetDate) {
      return
    }

    const now = new Date().toISOString()
    onAddGoal({
      id: newId(),
      destination: destination.trim(),
      targetAmount,
      savedAmount: 0,
      targetDate,
      createdAt: now,
      updatedAt: now,
    })

    setDestination('')
    setTargetAmount(0)
    setTargetDate('')
  }

  function addCardPoints() {
    if (!cardName.trim()) {
      return
    }

    onAddCardPoints({
      id: newId(),
      cardName: cardName.trim(),
      points,
      centsPerPoint,
      updatedAt: new Date().toISOString(),
    })

    setCardName('')
    setPoints(0)
    setCentsPerPoint(1)
  }

  return (
    <section className="tab-panel">
      <h2>Milestones</h2>
      <p className="muted">Manage trip milestones and card points with full create, edit, and delete support.</p>

      <div className="settings-grid">
        <div className="card">
          <h3>Trip Goals</h3>
          <div className="inline-form">
            <input
              type="text"
              placeholder="Destination"
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
            />
            <input
              type="number"
              placeholder="Target amount"
              value={targetAmount}
              onChange={(event) => setTargetAmount(Number(event.target.value))}
            />
            <input
              type="date"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
            />
            <button type="button" onClick={addGoal}>Add Goal</button>
          </div>

          <div className="table-wrap">
            <table className="settings-table">
              <thead>
                <tr>
                  <th>Destination</th>
                  <th>Target</th>
                  <th>Saved</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {goals.map((goal) => (
                  <tr key={goal.id}>
                    <td>
                      <input
                        type="text"
                        value={goal.destination}
                        onChange={(event) =>
                          onUpdateGoal(goal.id, {
                            destination: event.target.value,
                            updatedAt: new Date().toISOString(),
                          })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={goal.targetAmount}
                        onChange={(event) =>
                          onUpdateGoal(goal.id, {
                            targetAmount: Number(event.target.value),
                            updatedAt: new Date().toISOString(),
                          })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={goal.savedAmount}
                        onChange={(event) =>
                          onUpdateGoal(goal.id, {
                            savedAmount: Number(event.target.value),
                            updatedAt: new Date().toISOString(),
                          })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        value={goal.targetDate}
                        onChange={(event) =>
                          onUpdateGoal(goal.id, {
                            targetDate: event.target.value,
                            updatedAt: new Date().toISOString(),
                          })
                        }
                      />
                    </td>
                    <td>
                      <button type="button" className="danger" onClick={() => onDeleteGoal(goal.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {goals.length === 0 && (
                  <tr>
                    <td colSpan={5}><span className="muted">No goals created yet.</span></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3>Points Per Card</h3>
          <div className="inline-form">
            <input
              type="text"
              placeholder="Card name"
              value={cardName}
              onChange={(event) => setCardName(event.target.value)}
            />
            <input
              type="number"
              placeholder="Points"
              value={points}
              onChange={(event) => setPoints(Number(event.target.value))}
            />
            <input
              type="number"
              min={0.01}
              step={0.01}
              placeholder="Cents per point"
              value={centsPerPoint}
              onChange={(event) => setCentsPerPoint(Number(event.target.value))}
            />
            <button type="button" onClick={addCardPoints}>Add Card</button>
          </div>

          <div className="table-wrap">
            <table className="settings-table">
              <thead>
                <tr>
                  <th>Card</th>
                  <th>Points</th>
                  <th>Value (c/pt)</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {cardPoints.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <input
                        type="text"
                        value={entry.cardName}
                        onChange={(event) =>
                          onUpdateCardPoints(entry.id, {
                            cardName: event.target.value,
                            updatedAt: new Date().toISOString(),
                          })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={entry.points}
                        onChange={(event) =>
                          onUpdateCardPoints(entry.id, {
                            points: Number(event.target.value),
                            updatedAt: new Date().toISOString(),
                          })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0.01}
                        step={0.01}
                        value={entry.centsPerPoint ?? 1}
                        onChange={(event) =>
                          onUpdateCardPoints(entry.id, {
                            centsPerPoint: Number(event.target.value),
                            updatedAt: new Date().toISOString(),
                          })
                        }
                      />
                    </td>
                    <td>{entry.updatedAt.slice(0, 10)}</td>
                    <td>
                      <button type="button" className="danger" onClick={() => onDeleteCardPoints(entry.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {cardPoints.length === 0 && (
                  <tr>
                    <td colSpan={5}><span className="muted">No card points tracked yet.</span></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card table-card">
          <h3>Points Conversion</h3>
          <p className="muted">Convert points between cards using each card's cents-per-point value.</p>

          {cardPoints.length === 0 && <p className="muted">Add card points first to see conversions.</p>}

          {cardPoints.length > 0 && (
            <>
              <div className="inline-form">
                <label>
                  <span>From card</span>
                  <select
                    value={sourceCardId}
                    onChange={(event) => setSourceCardId(event.target.value)}
                  >
                    {cardPoints.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.cardName}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Points to convert</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={sourcePoints}
                    onChange={(event) => setSourcePoints(Number(event.target.value))}
                  />
                </label>
              </div>

              {sourceCard && (
                <p>
                  Value equivalent: ${sourceValueDollars.toFixed(2)} from {sourcePoints.toLocaleString()} points in{' '}
                  {sourceCard.cardName}.
                </p>
              )}

              <div className="table-wrap">
                <table className="settings-table">
                  <thead>
                    <tr>
                      <th>Target Card</th>
                      <th>Value (c/pt)</th>
                      <th>Equivalent Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conversions.map((entry) => (
                      <tr key={`${entry.id}-conversion`}>
                        <td>{entry.cardName}</td>
                        <td>{entry.centsPerPoint.toFixed(2)}</td>
                        <td>{Math.round(entry.targetPoints).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
