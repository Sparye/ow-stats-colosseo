import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App'
import { createQueryClient } from '../api/queries'
import { createAppRouter } from '../router'

type Fake = { summary?: object; stats?: object | null; isPublic?: boolean }

/**
 * Stands in for OverFast: answers each player request from `players`, 404 otherwise.
 * `nextChecks` gives the epoch seconds OverFast reports for when it will look up an unknown Player again.
 */
function fakeOverfast(
  players: Record<string, Fake>,
  nextChecks: Record<string, number> = {},
  notFoundShape: 'flat' | 'nested' = 'flat',
) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const url = new URL(input)
      const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
      if (url.pathname === '/heroes') {
        return json([{ key: 'ana', name: 'Ana', portrait: 'https://example.test/ana.png', role: 'support' }])
      }
      if (url.pathname === '/players') {
        const id = url.searchParams.get('name')!
        return json({ results: [{ player_id: id, is_public: players[id]?.isPublic ?? true }] })
      }
      const [, , rawId, ...rest] = url.pathname.split('/')
      const player = players[decodeURIComponent(rawId)]
      if (!player) {
        const nextCheckAt = nextChecks[decodeURIComponent(rawId)]
        const details = { error: 'Player not found', ...(nextCheckAt && { next_check_at: nextCheckAt }) }
        return json(notFoundShape === 'nested' ? { error: details } : details, 404)
      }
      return rest.join('/') === 'summary' ? json(player.summary ?? summary()) : json(player.stats ?? null)
    }),
  )
}

const summary = () => ({ username: 'x', avatar: null, competitive: null })

function anaStats(healingPer10: number, deathsPer10: number) {
  return {
    ana: [
      {
        category: 'game',
        label: 'Game',
        stats: [{ key: 'time_played', label: 'Time Played', value: 3600 }],
      },
      {
        category: 'average',
        label: 'Average',
        stats: [
          { key: 'healing_done_avg_per_10_min', label: 'Healing Done - Avg per 10 Min', value: healingPer10 },
          { key: 'deaths_avg_per_10_min', label: 'Deaths - Avg per 10 Min', value: deathsPer10 },
        ],
      },
    ],
  }
}

function renderAt(url: string) {
  const router = createAppRouter({ history: createMemoryHistory({ initialEntries: [url] }) })
  render(<App router={router} queryClient={createQueryClient()} />)
  return router
}

/** The cells of a Stat Row, in on-screen order, as "rowheader:text" / "cell:text". */
async function rowCells(label: string) {
  const header = await screen.findByRole('rowheader', { name: label })
  const row = header.closest('[role="row"]') as HTMLElement
  return Array.from(row.querySelectorAll('[role="rowheader"], [role="cell"]')).map((el) => `${el.getAttribute('role')}:${el.textContent}`)
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Matchup page', () => {
  it('puts the stat label between two Players and highlights the Leader', async () => {
    fakeOverfast({
      'Anna-1111': { stats: anaStats(9000, 6) },
      'Bob-2222': { stats: anaStats(8000, 4) },
    })
    renderAt('/?players=Anna-1111,Bob-2222&hero=ana')

    expect(await rowCells('Healing Done - Avg per 10 Min')).toEqual([
      'cell:▲9,000',
      'rowheader:Healing Done - Avg per 10 Min',
      'cell:8,000',
    ])
    expect(screen.getByRole('cell', { name: '9,000, leads' })).toHaveClass('leader')
    // Deaths are Lower-Is-Better, so Bob leads that one.
    expect(screen.getByRole('cell', { name: '4, leads' })).toHaveClass('leader')
    expect(within(screen.getByRole('columnheader', { name: 'Anna#1111' })).getByText(/Leads/)).toHaveTextContent(
      'Leads 1 of 2',
    )
  })

  it('moves the stat label to the left with three Players', async () => {
    fakeOverfast({
      'Anna-1111': { stats: anaStats(9000, 6) },
      'Bob-2222': { stats: anaStats(8000, 4) },
      'Cleo-3333': { stats: anaStats(7000, 5) },
    })
    renderAt('/?players=Anna-1111,Bob-2222,Cleo-3333&hero=ana')

    expect(await rowCells('Healing Done - Avg per 10 Min')).toEqual([
      'rowheader:Healing Done - Avg per 10 Min',
      'cell:▲9,000',
      'cell:8,000',
      'cell:7,000',
    ])
  })

  it('shows a Private Profile in its own Slot while the others still compare', async () => {
    fakeOverfast({
      'Anna-1111': { stats: anaStats(9000, 6) },
      'Bob-2222': { stats: anaStats(8000, 4) },
      'Hidden-3333': { stats: {}, isPublic: false },
    })
    renderAt('/?players=Anna-1111,Bob-2222,Hidden-3333&hero=ana')

    const hidden = await screen.findByRole('columnheader', { name: 'Hidden#3333' })
    expect(
      await within(hidden).findByText(
        'This profile is private. They can make it public in Overwatch under Options → Social → Career Profile Visibility.',
      ),
    ).toBeInTheDocument()
    expect(await rowCells('Healing Done - Avg per 10 Min')).toEqual([
      'rowheader:Healing Done - Avg per 10 Min',
      'cell:▲9,000',
      'cell:8,000',
      'cell:—',
    ])
  })

  it('says when a Player has no games on the hero', async () => {
    fakeOverfast({
      'Anna-1111': { stats: anaStats(9000, 6) },
      'Bob-2222': { stats: { 'all-heroes': anaStats(1, 1).ana } },
    })
    renderAt('/?players=Anna-1111,Bob-2222&hero=ana')

    const bob = await screen.findByRole('columnheader', { name: 'Bob#2222' })
    expect(await within(bob).findByText('No Ana games in Competitive on PC')).toBeInTheDocument()
  })

  it('says a Player who cannot be found may have a wrong BattleTag or a Private Profile', async () => {
    fakeOverfast({ 'Anna-1111': { stats: anaStats(9000, 6) } })
    renderAt('/?players=Anna-1111,Ghost-9999&hero=ana')

    const ghost = await screen.findByRole('columnheader', { name: 'Ghost#9999' })
    expect(
      await within(ghost).findByText(
        "Player not found. Check the BattleTag (it's case-sensitive) and that the profile is public.",
      ),
    ).toBeInTheDocument()
    expect(within(ghost).queryByText(/Try again after/)).not.toBeInTheDocument()
  })

  it.each(['flat', 'nested'] as const)('says when OverFast will look for a missing Player again (%s 404)', async (shape) => {
    const nextCheckAt = new Date(2026, 9, 21, 2, 46)
    fakeOverfast({ 'Anna-1111': { stats: anaStats(9000, 6) } }, { 'Ghost-9999': nextCheckAt.getTime() / 1000 }, shape)
    renderAt('/?players=Anna-1111,Ghost-9999&hero=ana')

    const ghost = await screen.findByRole('columnheader', { name: 'Ghost#9999' })
    expect(await within(ghost).findByText(/Try again after 2:46\s?am\./i)).toBeInTheDocument()
  })

  it('swaps the Player in a Slot with Change, keeping the Slot', async () => {
    fakeOverfast({
      'Anna-1111': { stats: anaStats(9000, 6) },
      'Bob-2222': { stats: anaStats(8000, 4) },
      'Cleo-3333': { stats: anaStats(7000, 5) },
    })
    const router = renderAt('/?players=Anna-1111,Bob-2222&hero=ana')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Change Anna#1111' }))
    const input = screen.getByRole('textbox', { name: 'BattleTag' })
    expect(input).toHaveValue('Anna#1111')
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
    await user.clear(input)
    await user.type(input, 'Cleo#3333{Enter}')

    await waitFor(() => expect(router.state.location.search.players).toEqual(['Cleo-3333', 'Bob-2222']))
    expect(await screen.findByRole('columnheader', { name: 'Cleo#3333' })).toBeInTheDocument()
  })

  it('puts the same Player back when Add is pressed without changing the BattleTag', async () => {
    fakeOverfast({ 'Anna-1111': { stats: anaStats(9000, 6) }, 'Bob-2222': { stats: anaStats(8000, 4) } })
    renderAt('/?players=Anna-1111,Bob-2222&hero=ana')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Change Anna#1111' }))
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByRole('button', { name: 'Change Anna#1111' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('offers Remove only when there are more than two Slots', async () => {
    fakeOverfast({
      'Anna-1111': { stats: anaStats(9000, 6) },
      'Bob-2222': { stats: anaStats(8000, 4) },
      'Cleo-3333': { stats: anaStats(7000, 5) },
    })
    const router = renderAt('/?players=Anna-1111,Bob-2222,Cleo-3333&hero=ana')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Change Bob#2222' }))
    await user.click(screen.getByRole('button', { name: 'Remove' }))

    await waitFor(() => expect(router.state.location.search.players).toEqual(['Anna-1111', 'Cleo-3333']))
  })

  it("shows which season each Player's Competitive stats come from", async () => {
    const withSeason = (season: number) => ({ ...summary(), competitive: { pc: { season, support: null } } })
    fakeOverfast({
      'Anna-1111': { summary: withSeason(22), stats: anaStats(9000, 6) },
      'Bob-2222': { summary: withSeason(18), stats: anaStats(8000, 4) },
    })
    renderAt('/?players=Anna-1111,Bob-2222&hero=ana&gamemode=competitive')

    const anna = await screen.findByRole('columnheader', { name: 'Anna#1111' })
    const bob = await screen.findByRole('columnheader', { name: 'Bob#2222' })
    expect(await within(anna).findByText('Season 22')).toBeInTheDocument()
    expect(await within(bob).findByText('Season 18')).toBeInTheDocument()
  })

  it('leaves the season out in Quick Play, where stats cover every season', async () => {
    fakeOverfast({
      'Anna-1111': {
        summary: { ...summary(), competitive: { pc: { season: 22 } } },
        stats: anaStats(9000, 6),
      },
      'Bob-2222': { stats: anaStats(8000, 4) },
    })
    renderAt('/?players=Anna-1111,Bob-2222&hero=ana&gamemode=quickplay')

    const anna = await screen.findByRole('columnheader', { name: 'Anna#1111' })
    await within(anna).findByText(/Leads/)
    expect(within(anna).queryByText(/Season/)).not.toBeInTheDocument()
  })
})
