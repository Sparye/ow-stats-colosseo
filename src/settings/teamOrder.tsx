import { createContext, useContext, useState, type ReactNode } from 'react'
import { loadTeamOrder, saveTeamOrder, type TeamOrder } from '../domain/teamOrder'

const TeamOrderContext = createContext<[TeamOrder, (order: TeamOrder) => void] | null>(null)

export function TeamOrderProvider({ children }: { children: ReactNode }) {
  const [order, setOrder] = useState(loadTeamOrder)
  const update = (next: TeamOrder) => {
    setOrder(next)
    saveTeamOrder(next)
  }
  return <TeamOrderContext.Provider value={[order, update]}>{children}</TeamOrderContext.Provider>
}

export function useTeamOrder() {
  const value = useContext(TeamOrderContext)
  if (!value) throw new Error('useTeamOrder needs a TeamOrderProvider')
  return value
}
