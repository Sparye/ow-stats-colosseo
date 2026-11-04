import { createMemoryHistory } from '@tanstack/react-router'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
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

/** The BattleTags in the open Recent Players list, in order. */
const suggestions = () =>
  within(screen.getByRole('listbox', { name: 'Recent Players' }))
    .getAllByRole('option')
    .map((option) => option.textContent)

/** The cells of a Stat Row, in on-screen order, as "rowheader:text" / "cell:text". */
async function rowCells(label: string) {
  const header = await screen.findByRole('rowheader', { name: label })
  const row = header.closest('[role="row"]') as HTMLElement
  return Array.from(row.querySelectorAll('[role="rowheader"], [role="cell"]')).map((el) => `${el.getAttribute('role')}:${el.textContent}`)
}

beforeEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
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
    const input = screen.getByRole('combobox', { name: 'BattleTag' })
    // Empty, so the browser's suggestions aren't narrowed down to the current tag.
    expect(input).toHaveValue('')
    expect(input).toHaveAttribute('placeholder', 'Anna#1111')
    expect(input).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
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

  it('puts the cursor in the new Slot after + Add player, and hides the button at five Slots', async () => {
    fakeOverfast({})
    renderAt('/')
    const user = userEvent.setup()

    for (const slots of [3, 4, 5]) {
      await user.click(await screen.findByRole('button', { name: '+ Add player' }))
      const inputs = screen.getAllByRole('combobox', { name: 'BattleTag' })
      expect(inputs).toHaveLength(slots)
      expect(inputs.at(-1)).toHaveFocus()
    }
    expect(screen.queryByRole('button', { name: '+ Add player' })).not.toBeInTheDocument()
  })

  it('suggests BattleTags that loaded before, but not ones that were never found', async () => {
    fakeOverfast({
      'Anna-1111': { stats: anaStats(9000, 6) },
      'Hidden-3333': { stats: {}, isPublic: false },
    })
    renderAt('/?players=Anna-1111,Hidden-3333,Ghost-9999&hero=ana')
    await screen.findByText(/This profile is private/)
    await screen.findByText(/Player not found/)
    cleanup()

    const router = renderAt('/?players=Anna-1111')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('combobox', { name: 'BattleTag' }))
    // Anna is already in this Matchup, so offering her again would only be turned away.
    expect(suggestions()).toEqual(['Hidden#3333'])

    await user.click(screen.getByRole('option', { name: 'Hidden#3333' }))
    await waitFor(() => expect(router.state.location.search.players).toEqual(['Anna-1111', 'Hidden-3333']))
  })

  it("suggests a Slot's own Player in its Change form, since putting them back is allowed", async () => {
    fakeOverfast({ 'Anna-1111': { stats: anaStats(9000, 6) }, 'Bob-2222': { stats: anaStats(8000, 4) } })
    renderAt('/?players=Anna-1111,Bob-2222&hero=ana')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Change Anna#1111' }))
    // The input has the cursor, so the list is already open. Bob is in the other Slot, so only Anna can go here.
    expect(screen.getByRole('combobox', { name: 'BattleTag' })).toHaveAttribute('aria-expanded', 'true')
    expect(suggestions()).toEqual(['Anna#1111'])
  })

  it('narrows the suggestions as you type, and places the one picked with the keyboard', async () => {
    localStorage.setItem('recentPlayers', JSON.stringify(['Cleo-3333', 'Dana-4444']))
    fakeOverfast({
      'Anna-1111': { stats: anaStats(9000, 6) },
      'Bob-2222': { stats: anaStats(8000, 4) },
      'Cleo-3333': { stats: anaStats(7000, 5) },
    })
    const router = renderAt('/?players=Anna-1111,Bob-2222&hero=ana')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Change Anna#1111' }))
    await waitFor(() => expect(suggestions()).toEqual(['Anna#1111', 'Cleo#3333', 'Dana#4444']))
    const input = screen.getByRole('combobox', { name: 'BattleTag' })
    await user.type(input, 'cl')
    expect(suggestions()).toEqual(['Cleo#3333'])

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    await user.keyboard('{ArrowDown}')
    expect(input).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Cleo#3333' }).id)
    await user.keyboard('{Enter}')

    await waitFor(() => expect(router.state.location.search.players).toEqual(['Cleo-3333', 'Bob-2222']))
  })

  it('picks a hero with Select Hero in the hero cell, then offers Change Hero', async () => {
    fakeOverfast({ 'Anna-1111': { stats: anaStats(9000, 6) }, 'Bob-2222': { stats: anaStats(8000, 4) } })
    const router = renderAt('/?players=Anna-1111,Bob-2222')
    const user = userEvent.setup()

    const heroCell = await screen.findByRole('columnheader', { name: 'Stat' })
    expect(within(heroCell).getByText('All Heroes', { selector: '.hero-portrait' })).toBeInTheDocument()
    const select = within(heroCell).getByRole('button', { name: 'Select Hero' })
    expect(select).toHaveAttribute('popovertarget', 'hero-picker')
    // jsdom has no Popover API, so the closed popover's choices stay hidden from role queries.
    await user.click(select)
    await user.click(await screen.findByRole('button', { name: 'Ana', hidden: true }))

    await waitFor(() => expect(router.state.location.search.hero).toBe('ana'))
    expect(await rowCells('Healing Done - Avg per 10 Min')).toEqual([
      'cell:▲9,000',
      'rowheader:Healing Done - Avg per 10 Min',
      'cell:8,000',
    ])
    await user.click(within(heroCell).getByRole('button', { name: 'Change Hero' }))
    await user.click(screen.getByRole('button', { name: 'All Heroes', hidden: true }))

    await waitFor(() => expect(router.state.location.search.hero).toBe('all-heroes'))
    expect(within(heroCell).getByRole('button', { name: 'Select Hero' })).toBeInTheDocument()
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

  describe('section tabs', () => {
    /** Ana stats with one Fair, one Volume and one Best Stat. */
    const sectionStats = (healingPer10: number, healingTotal: number, mostHealing: number) => ({
      ana: [
        {
          category: 'game',
          label: 'Game',
          stats: [{ key: 'time_played', label: 'Time Played', value: 3600 }],
        },
        {
          category: 'average',
          label: 'Average',
          stats: [{ key: 'healing_done_avg_per_10_min', label: 'Healing Done - Avg per 10 Min', value: healingPer10 }],
        },
        {
          category: 'combat',
          label: 'Combat',
          stats: [{ key: 'healing_done', label: 'Healing Done', value: healingTotal }],
        },
        {
          category: 'best',
          label: 'Best',
          stats: [{ key: 'healing_done_most_in_game', label: 'Healing Done - Most in Game', value: mostHealing }],
        },
      ],
    })

    beforeEach(() => {
      fakeOverfast({
        'Anna-1111': { stats: sectionStats(9000, 50000, 20000) },
        'Bob-2222': { stats: sectionStats(8000, 90000, 25000) },
      })
    })

    it('shows Fair Stats first, with the Sample Size always above', async () => {
      renderAt('/?players=Anna-1111,Bob-2222&hero=ana')

      expect(await screen.findByRole('rowheader', { name: 'Healing Done - Avg per 10 Min' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Fair Stats' })).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByRole('rowheader', { name: 'Time Played' })).toBeInTheDocument()
      expect(screen.queryByRole('rowheader', { name: 'Healing Done' })).not.toBeInTheDocument()
    })

    it('switches sections with a click and keeps the choice in the URL', async () => {
      const router = renderAt('/?players=Anna-1111,Bob-2222&hero=ana')
      const user = userEvent.setup()
      await screen.findByRole('rowheader', { name: 'Healing Done - Avg per 10 Min' })
      const annaScore = () => within(screen.getByRole('columnheader', { name: 'Anna#1111' })).getByText(/Leads/)
      expect(annaScore()).toHaveTextContent('Leads 1 of 1')

      await user.click(screen.getByRole('tab', { name: 'Volume Stats' }))

      expect(await rowCells('Healing Done')).toEqual(['cell:50,000', 'rowheader:Healing Done', 'cell:▲90,000'])
      // The Score counts the section on show.
      expect(annaScore()).toHaveTextContent('Leads 0 of 1')
      expect(screen.getByRole('rowgroup', { name: 'Volume Stats' })).toBeInTheDocument()
      expect(screen.queryByRole('rowheader', { name: 'Healing Done - Avg per 10 Min' })).not.toBeInTheDocument()
      expect(screen.getByRole('rowheader', { name: 'Time Played' })).toBeInTheDocument()
      await waitFor(() => expect(router.state.location.search.stats).toBe('volume'))
    })

    it('opens on the section a shared link names', async () => {
      renderAt('/?players=Anna-1111,Bob-2222&hero=ana&stats=best')

      expect(await screen.findByRole('rowheader', { name: 'Healing Done - Most in Game' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Best Stats' })).toHaveAttribute('aria-selected', 'true')
    })

    it('switches with F, V and B, and with the arrow keys on the tabs', async () => {
      const router = renderAt('/?players=Anna-1111,Bob-2222&hero=ana')
      const user = userEvent.setup()
      await screen.findByRole('rowheader', { name: 'Healing Done - Avg per 10 Min' })

      await user.keyboard('b')
      await waitFor(() => expect(router.state.location.search.stats).toBe('best'))
      await user.keyboard('v')
      await waitFor(() => expect(router.state.location.search.stats).toBe('volume'))

      screen.getByRole('tab', { name: 'Volume Stats' }).focus()
      await user.keyboard('{ArrowLeft}')
      await waitFor(() => expect(router.state.location.search.stats).toBe('fair'))
      expect(screen.getByRole('tab', { name: 'Fair Stats' })).toHaveFocus()
    })

    it("doesn't switch sections while typing a BattleTag", async () => {
      const router = renderAt('/?players=Anna-1111,Bob-2222&hero=ana')
      const user = userEvent.setup()
      await screen.findByRole('rowheader', { name: 'Healing Done - Avg per 10 Min' })

      await user.click(screen.getByRole('button', { name: 'Change Anna#1111' }))
      await user.keyboard('Bob')

      expect(router.state.location.search.stats).toBe('fair')
    })
  })
})

describe('global hero stats', () => {
  const ranked = (division: string) => ({
    username: 'x',
    avatar: null,
    competitive: { pc: { season: 22, support: { division, tier: 3, rank_icon: 'https://example.test/rank.png' } } },
  })
  const unranked = () => ({ username: 'x', avatar: null, competitive: { pc: { season: 22, support: null } } })

  const statsWith = (winRate: number, healing = 9000) => ({
    ana: [
      {
        category: 'game',
        label: 'Game',
        stats: [
          { key: 'games_played', label: 'Games Played', value: 10 },
          { key: 'win_percentage', label: 'Win Percentage', value: winRate },
        ],
      },
      {
        category: 'average',
        label: 'Average',
        stats: [{ key: 'healing_done_avg_per_10_min', label: 'Healing Done - Avg per 10 Min', value: healing }],
      },
    ],
  })

  type Row = { winrate: number; pickrate: number; banrate?: number | null }

  /**
   * Adds OverFast's `/heroes/stats` to the fake. `answer` gets the region and division
   * and returns Ana's row, or a status code to fail with. Returns the requests made.
   */
  function fakeGlobalStats(answer: (region: string, division: string | null) => Row | number) {
    const requests: Array<{ region: string; division: string | null; gamemode: string | null }> = []
    const players = vi.mocked(fetch).getMockImplementation()!
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        const url = new URL(input)
        if (url.pathname !== '/heroes/stats') return players(input)
        const region = url.searchParams.get('region')!
        const division = url.searchParams.get('competitive_division')
        requests.push({ region, division, gamemode: url.searchParams.get('gamemode') })
        const row = answer(region, division)
        return typeof row === 'number'
          ? new Response('{}', { status: row })
          : new Response(JSON.stringify([{ hero: 'ana', ...row }]))
      }),
    )
    return requests
  }

  const flat = (winrate: number) => (): Row => ({ winrate, pickrate: 33, banrate: 10.2 })
  const benchmarkHeader = () => within(screen.getByRole('columnheader', { name: 'Benchmark' }))
  /** The heroes load first, so the column can take a moment to appear. */
  const benchmarkLoaded = () => screen.findByRole('columnheader', { name: 'Benchmark' })
  const score = (name: string) => within(screen.getByRole('columnheader', { name })).getByText(/Leads/)

  describe('Benchmark', () => {
    it('adds a faded column after two Players, with the global win rate and rates in its header', async () => {
      fakeOverfast({
        'Anna-1111': { summary: ranked('gold'), stats: statsWith(55) },
        'Bob-2222': { summary: ranked('diamond'), stats: statsWith(51) },
      })
      fakeGlobalStats((_, division) => (division === 'diamond' ? flat(47.2)() : flat(50)()))
      const router = renderAt('/?players=Anna-1111,Bob-2222&hero=ana')
      const user = userEvent.setup()
      await screen.findByRole('rowheader', { name: 'Win Percentage' })
      expect(screen.queryByRole('columnheader', { name: 'Benchmark' })).not.toBeInTheDocument()

      await user.click(screen.getByRole('switch', { name: 'Benchmark' }))

      await waitFor(() => expect(router.state.location.search.benchmark).toBe(true))
      // Defaults to the highest rank among the Players.
      await benchmarkLoaded()
      expect(await benchmarkHeader().findByText('Avg Diamond Ana')).toBeInTheDocument()
      expect(await benchmarkHeader().findByText('Pick 33%')).toBeInTheDocument()
      expect(benchmarkHeader().getByText('Ban 10.2%')).toBeInTheDocument()
      await waitFor(async () => expect((await rowCells('Win Percentage')).at(-1)).toBe('cell:47.2%'))
      const [first, label, second] = await rowCells('Win Percentage')
      expect(first).toMatch(/^cell:▲55%/)
      expect(label).toBe('rowheader:Win Percentage')
      expect(second).toMatch(/^cell:51%/)
      // Other rows have nothing to show for it.
      expect((await rowCells('Healing Done - Avg per 10 Min')).at(-1)).toBe('cell:—')
    })

    it('goes after the Players with three, and stays out of Leaders and the Score', async () => {
      fakeOverfast({
        'Anna-1111': { summary: ranked('gold'), stats: statsWith(40) },
        'Bob-2222': { summary: ranked('gold'), stats: statsWith(45) },
        'Cleo-3333': { summary: ranked('gold'), stats: statsWith(42) },
      })
      fakeGlobalStats(flat(99))
      renderAt('/?players=Anna-1111,Bob-2222,Cleo-3333&hero=ana&benchmark=on')

      await benchmarkLoaded()
      await benchmarkHeader().findByText('Pick 33%')
      const cells = await rowCells('Win Percentage')
      expect(cells[0]).toBe('rowheader:Win Percentage')
      expect(cells[2]).toMatch(/^cell:▲45%/)
      expect(cells.at(-1)).toBe('cell:99%')
      expect(cells).toHaveLength(5)
      // Every Player ties on healing, so the win rate row is the only one with a Leader.
      expect(score('Bob#2222')).toHaveTextContent('Leads 1 of 1')
    })

    it("doesn't use up a Player spot", async () => {
      fakeOverfast({
        'Anna-1111': { stats: statsWith(40) },
        'Bob-2222': { stats: statsWith(45) },
        'Cleo-3333': { stats: statsWith(42) },
        'Dee-4444': { stats: statsWith(42) },
      })
      fakeGlobalStats(flat(50))
      renderAt('/?players=Anna-1111,Bob-2222,Cleo-3333,Dee-4444&hero=ana&benchmark=on')

      await benchmarkLoaded()
      await benchmarkHeader().findByText('Pick 33%')
      expect(screen.getByRole('button', { name: '+ Add player' })).toBeInTheDocument()
    })

    it('is disabled with a reason on All Heroes, hiding the column a link asked for', async () => {
      fakeOverfast({ 'Anna-1111': { stats: { 'all-heroes': statsWith(50).ana } } })
      const requests = fakeGlobalStats(flat(50))
      renderAt('/?players=Anna-1111&hero=all-heroes&benchmark=on')

      const toggle = await screen.findByRole('switch', { name: 'Benchmark Pick a hero' })
      expect(toggle).toBeDisabled()
      expect(screen.queryByRole('columnheader', { name: 'Benchmark' })).not.toBeInTheDocument()
      expect(requests).toEqual([])
    })

    it('falls back to all ranks when no Player has a rank for the role', async () => {
      fakeOverfast({
        'Anna-1111': { summary: unranked(), stats: statsWith(55) },
        'Bob-2222': { summary: unranked(), stats: statsWith(51) },
      })
      const requests = fakeGlobalStats(flat(50))
      renderAt('/?players=Anna-1111,Bob-2222&hero=ana&benchmark=on')

      await benchmarkLoaded()
      expect(await benchmarkHeader().findByText('Avg Ana')).toBeInTheDocument()
      await waitFor(() => expect(requests.length).toBe(3))
      expect(requests.every((r) => r.division === null)).toBe(true)
    })

    it('averages the three regions equally by default and says so on hover', async () => {
      fakeOverfast({ 'Anna-1111': { summary: ranked('gold'), stats: statsWith(55) } })
      const requests = fakeGlobalStats((region) => ({
        winrate: { europe: 50, americas: 47.2, asia: 47.3 }[region]!,
        pickrate: 20,
        banrate: 4,
      }))
      renderAt('/?players=Anna-1111&hero=ana&benchmark=on')

      await benchmarkLoaded()
      expect(await benchmarkHeader().findByText('Pick 20%')).toBeInTheDocument()
      expect(requests.map((r) => r.region).sort()).toEqual(['americas', 'asia', 'europe'])
      expect((await rowCells('Win Percentage')).at(-1)).toBe('cell:48.2%')
      expect(benchmarkHeader().getByRole('combobox', { name: 'Region' })).toHaveAttribute(
        'title',
        'Average of Europe, Americas and Asia, each counted equally',
      )
    })

    it('uses one region when picked, and keeps both pickers in the URL', async () => {
      fakeOverfast({ 'Anna-1111': { summary: ranked('gold'), stats: statsWith(55) } })
      const requests = fakeGlobalStats((region, division) => ({
        winrate: region === 'asia' && division === 'master' ? 44 : 50,
        pickrate: 20,
      }))
      const router = renderAt('/?players=Anna-1111&hero=ana&benchmark=on')
      const user = userEvent.setup()
      await benchmarkLoaded()
      await benchmarkHeader().findByText('Avg Gold Ana')

      await user.selectOptions(benchmarkHeader().getByRole('combobox', { name: 'Region' }), 'asia')
      await user.selectOptions(benchmarkHeader().getByRole('combobox', { name: 'Rank tier' }), 'master')

      expect(await benchmarkHeader().findByText('Avg Master Ana')).toBeInTheDocument()
      await waitFor(async () => expect((await rowCells('Win Percentage')).at(-1)).toBe('cell:44%'))
      expect(router.state.location.search).toMatchObject({ region: 'asia', benchmarkTier: 'master' })
      expect(requests).toContainEqual({ region: 'asia', division: 'master', gamemode: 'competitive' })
      expect(requests).not.toContainEqual({ region: 'europe', division: 'master', gamemode: 'competitive' })
    })

    it('has no tier and no ban rate in Quick Play', async () => {
      fakeOverfast({ 'Anna-1111': { summary: ranked('gold'), stats: statsWith(55) } })
      const requests = fakeGlobalStats(() => ({ winrate: 46.9, pickrate: 21, banrate: null }))
      renderAt('/?players=Anna-1111&hero=ana&gamemode=quickplay&tier=master&benchmark=on')

      await benchmarkLoaded()
      expect(await benchmarkHeader().findByText('Pick 21%')).toBeInTheDocument()
      expect(benchmarkHeader().getByText('Avg Ana')).toBeInTheDocument()
      expect(benchmarkHeader().queryByRole('combobox', { name: 'Rank tier' })).not.toBeInTheDocument()
      expect(benchmarkHeader().queryByText(/Ban/)).not.toBeInTheDocument()
      expect(requests.every((r) => r.division === null && r.gamemode === 'quickplay')).toBe(true)
    })

    it('averages the regions that answered when one fails, and says which', async () => {
      fakeOverfast({ 'Anna-1111': { summary: ranked('gold'), stats: statsWith(55) } })
      fakeGlobalStats((region) => (region === 'asia' ? 404 : { winrate: region === 'europe' ? 50 : 40, pickrate: 20 }))
      renderAt('/?players=Anna-1111&hero=ana&benchmark=on')

      await benchmarkLoaded()
      expect(await benchmarkHeader().findByText('Pick 20%')).toBeInTheDocument()
      expect((await rowCells('Win Percentage')).at(-1)).toBe('cell:45%')
      expect(benchmarkHeader().getByRole('combobox', { name: 'Region' })).toHaveAttribute(
        'title',
        "Average of Europe and Americas, each counted equally. Asia didn't load.",
      )
    })

    it("offers a retry in its own column when it can't load, and leaves the Slots alone", async () => {
      fakeOverfast({
        'Anna-1111': { summary: ranked('gold'), stats: statsWith(55) },
        'Bob-2222': { summary: ranked('gold'), stats: statsWith(51) },
      })
      let up = false
      fakeGlobalStats(() => (up ? flat(50)() : 404))
      renderAt('/?players=Anna-1111,Bob-2222&hero=ana&benchmark=on')
      const user = userEvent.setup()

      await benchmarkLoaded()
      const retry = await benchmarkHeader().findByRole('button', { name: 'Retry' })
      const [first, , second, last] = await rowCells('Win Percentage')
      expect(first).toMatch(/^cell:▲55%/)
      expect(second).toMatch(/^cell:51%/)
      expect(last).toBe('cell:—')

      up = true
      await user.click(retry)
      expect(await benchmarkHeader().findByText('Pick 33%')).toBeInTheDocument()
    })
  })

  describe('Rank-Adjusted Win Rate', () => {
    /** A Gold Player on 55% against the Gold field's 50.8, and a Grandmaster on 58% against their field's 56.9. */
    const goldVsGrandmaster = () => {
      fakeOverfast({
        'Anna-1111': { summary: ranked('gold'), stats: statsWith(55, 8000) },
        'Bob-2222': { summary: ranked('grandmaster'), stats: statsWith(58, 9000) },
      })
      return fakeGlobalStats((_, division) => flat(division === 'gold' ? 50.8 : 56.9)())
    }

    it("shows each Player's difference from the global win rate at their own Rank Tier", async () => {
      const requests = goldVsGrandmaster()
      renderAt('/?players=Anna-1111,Bob-2222&hero=ana')

      expect(await screen.findByText('+4.2 vs Gold')).toBeInTheDocument()
      expect(await screen.findByText('+1.1 vs Grandmaster')).toBeInTheDocument()
      expect(new Set(requests.map((r) => r.division))).toEqual(new Set(['gold', 'grandmaster']))
      // Without the toggle the raw win rate still decides the row.
      expect(await rowCells('Win Percentage')).toEqual([
        'cell:55%+4.2 vs Gold',
        'rowheader:Win Percentage',
        'cell:▲58%+1.1 vs Grandmaster',
      ])
    })

    it('shows a value below the field with a minus sign', async () => {
      fakeOverfast({ 'Anna-1111': { summary: ranked('gold'), stats: statsWith(47) } })
      fakeGlobalStats(flat(50.8))
      renderAt('/?players=Anna-1111&hero=ana')

      expect(await screen.findByText('−3.8 vs Gold')).toBeInTheDocument()
    })

    it('makes the win rate row lead by the difference with the toggle on, in the URL and the Score', async () => {
      goldVsGrandmaster()
      const router = renderAt('/?players=Anna-1111,Bob-2222&hero=ana')
      const user = userEvent.setup()
      await screen.findByText('+4.2 vs Gold')
      expect(score('Anna#1111')).toHaveTextContent('Leads 0 of 2')

      await user.click(screen.getByRole('switch', { name: 'Rank-adjusted' }))

      await waitFor(() => expect(router.state.location.search.rankAdjusted).toBe(true))
      expect(await rowCells('Win Percentage')).toEqual([
        'cell:▲55%+4.2 vs Gold',
        'rowheader:Win Percentage',
        'cell:58%+1.1 vs Grandmaster',
      ])
      expect(score('Anna#1111')).toHaveTextContent('Leads 1 of 2')
      expect(score('Bob#2222')).toHaveTextContent('Leads 1 of 2')
    })

    it('leaves a Player without a rank out of the row with the toggle on', async () => {
      fakeOverfast({
        'Anna-1111': { summary: ranked('gold'), stats: statsWith(55) },
        'Bob-2222': { summary: ranked('gold'), stats: statsWith(53) },
        'Cleo-3333': { summary: unranked(), stats: statsWith(90) },
      })
      fakeGlobalStats(flat(50))
      renderAt('/?players=Anna-1111,Bob-2222,Cleo-3333&hero=ana&adjusted=on')

      await screen.findByText('+5 vs Gold')
      expect(await rowCells('Win Percentage')).toEqual([
        'rowheader:Win Percentage',
        'cell:▲55%+5 vs Gold',
        'cell:53%+3 vs Gold',
        'cell:90%No rank',
      ])
    })

    it('says nothing about a missing rank with the toggle off', async () => {
      fakeOverfast({
        'Anna-1111': { summary: ranked('gold'), stats: statsWith(55) },
        'Bob-2222': { summary: unranked(), stats: statsWith(90) },
      })
      fakeGlobalStats(flat(50))
      renderAt('/?players=Anna-1111,Bob-2222&hero=ana')

      await screen.findByText('+5 vs Gold')
      expect(await rowCells('Win Percentage')).toEqual([
        'cell:55%+5 vs Gold',
        'rowheader:Win Percentage',
        'cell:▲90%',
      ])
    })

    it('uses the region picked for the Benchmark', async () => {
      fakeOverfast({ 'Anna-1111': { summary: ranked('gold'), stats: statsWith(55) } })
      const requests = fakeGlobalStats(flat(50))
      renderAt('/?players=Anna-1111&hero=ana&region=asia')

      await screen.findByText('+5 vs Gold')
      expect(requests).toEqual([{ region: 'asia', division: 'gold', gamemode: 'competitive' }])
    })

    it.each([
      ['Quick Play', '/?players=Anna-1111&hero=ana&gamemode=quickplay&adjusted=on', 'Competitive only'],
      ['All Heroes', '/?players=Anna-1111&hero=all-heroes&adjusted=on', 'Pick a hero'],
    ])('is off in %s, with a reason on the toggle and raw Leaders', async (_, url, reason) => {
      const stats = { ...statsWith(55), 'all-heroes': statsWith(55).ana }
      fakeOverfast({
        'Anna-1111': { summary: ranked('gold'), stats },
        'Bob-2222': { summary: unranked(), stats: { ...statsWith(60), 'all-heroes': statsWith(60).ana } },
      })
      const requests = fakeGlobalStats(flat(50))
      renderAt(url.replace('Anna-1111', 'Anna-1111,Bob-2222'))

      const toggle = await screen.findByRole('switch', { name: /Rank-adjusted/ })
      expect(toggle).toBeDisabled()
      expect(toggle).toHaveTextContent(reason)
      expect((await rowCells('Win Percentage')).at(-1)).toBe('cell:▲60%')
      expect(screen.queryByText(/ vs /)).not.toBeInTheDocument()
      expect(requests).toEqual([])
    })
  })
})
