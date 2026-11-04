import { createMemoryHistory } from '@tanstack/react-router'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App'
import { createQueryClient } from '../api/queries'
import { createAppRouter } from '../router'

type Fake = {
  summary?: object
  stats?: object | null
  isPublic?: boolean
  /** The `heroes` of `/stats/summary`, or a status code to fail with. */
  heroTotals?: object | number
}

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
        return json([
          { key: 'ana', name: 'Ana', portrait: 'https://example.test/ana.png', role: 'support' },
          { key: 'mercy', name: 'Mercy', portrait: 'https://example.test/mercy.png', role: 'support' },
        ])
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
      if (rest.join('/') === 'stats/summary') {
        const { heroTotals } = player
        if (typeof heroTotals === 'number') return json({ error: 'Nope' }, heroTotals)
        return json({ general: null, roles: null, heroes: heroTotals ?? null })
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
  vi.useRealTimers()
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

  describe('Heroes section', () => {
    const hero = (games: number, winrate: number, kda = 2, timePlayed = games * 600) => ({
      games_played: games,
      winrate,
      kda,
      time_played: timePlayed,
    })
    /** The cells of a Shared Hero's row, in on-screen order. */
    const heroRow = async (name: string) => {
      const button = await screen.findByRole('button', { name })
      const row = button.closest('[role="row"]') as HTMLElement
      return Array.from(row.querySelectorAll('[role="rowheader"], [role="cell"]')).map((el) => el.textContent)
    }

    beforeEach(() => {
      fakeOverfast({
        'Anna-1111': {
          stats: { ...anaStats(9000, 6), 'all-heroes': anaStats(9000, 6).ana },
          heroTotals: { ana: hero(10, 70, 4.32), mercy: hero(2, 100), lucio: hero(5, 50) },
        },
        'Bob-2222': {
          stats: { ...anaStats(8000, 4), 'all-heroes': anaStats(8000, 4).ana },
          heroTotals: { ana: hero(4, 50, 1.5), mercy: hero(20, 40), genji: hero(1, 0, 0, 90) },
        },
      })
    })

    it('offers the tab on All Heroes but not on a single hero', async () => {
      renderAt('/?players=Anna-1111,Bob-2222')
      expect(await screen.findByRole('tab', { name: 'Heroes' })).toBeInTheDocument()
      cleanup()

      renderAt('/?players=Anna-1111,Bob-2222&hero=ana')
      expect(await screen.findByRole('tab', { name: 'Fair Stats' })).toBeInTheDocument()
      expect(screen.queryByRole('tab', { name: 'Heroes' })).not.toBeInTheDocument()
    })

    it('opens with H and keeps the choice in the URL', async () => {
      const router = renderAt('/?players=Anna-1111,Bob-2222')
      const user = userEvent.setup()
      await screen.findByRole('tab', { name: 'Heroes' })

      await user.keyboard('h')

      await waitFor(() => expect(router.state.location.search.stats).toBe('heroes'))
      expect(router.state.location.searchStr).toContain('stats=heroes')
      expect(screen.getByRole('rowgroup', { name: 'Heroes' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Heroes' })).toHaveAttribute('aria-selected', 'true')
    })

    it('ignores H on a single hero', async () => {
      const router = renderAt('/?players=Anna-1111,Bob-2222&hero=ana')
      const user = userEvent.setup()
      await screen.findByRole('rowheader', { name: 'Healing Done - Avg per 10 Min' })

      await user.keyboard('h')

      expect(router.state.location.search.stats).toBe('fair')
    })

    it('falls back to Fair Stats when a link asks for it on a single hero', async () => {
      const router = renderAt('/?players=Anna-1111,Bob-2222&hero=ana&stats=heroes')

      expect(await screen.findByRole('rowheader', { name: 'Healing Done - Avg per 10 Min' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Fair Stats' })).toHaveAttribute('aria-selected', 'true')
      expect(router.state.location.search.stats).toBe('fair')
    })

    it('marks heroes at least two Players have played in their Hero Pools', async () => {
      renderAt('/?players=Anna-1111,Bob-2222&stats=heroes')

      expect(await screen.findAllByRole('button', { name: /^Ana, .* played, Shared Hero$/ })).toHaveLength(2)
      // `/heroes` doesn't list Genji here, so the portrait falls back to the hero key.
      expect(screen.getByRole('button', { name: /^genji, .* played$/ })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^genji, .*Shared Hero$/ })).not.toBeInTheDocument()
    })

    it('shows a Player’s top heroes, with a way to see the rest', async () => {
      const heroTotals = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`hero-${i}`, hero(10 - i, 50)]))
      fakeOverfast({ 'Anna-1111': { stats: anaStats(9000, 6), heroTotals }, 'Bob-2222': { stats: anaStats(8000, 4), heroTotals: {} } })
      renderAt('/?players=Anna-1111,Bob-2222&stats=heroes')
      const user = userEvent.setup()

      const more = await screen.findByRole('button', { name: '+2 more' })
      expect(screen.getAllByRole('button', { name: /^hero-\d, / })).toHaveLength(8)

      await user.click(more)
      expect(screen.getAllByRole('button', { name: /^hero-\d, / })).toHaveLength(10)
      expect(screen.getByRole('button', { name: 'Show fewer' })).toBeInTheDocument()
    })

    it('puts the hero between two Players and leads on win rate', async () => {
      renderAt('/?players=Anna-1111,Bob-2222&stats=heroes')

      expect(await heroRow('Ana')).toEqual(['▲70%4.32 KDA 10 games', 'Ana', '50%1.5 KDA 4 games'])
      const leader = screen.getByRole('cell', { name: '70% win rate, 4.32 KDA, 10 games, leads' })
      expect(leader).toHaveClass('leader')
    })

    it('puts the hero on the left with three Players, with — for a Player who has not played it', async () => {
      fakeOverfast({
        'Anna-1111': { stats: anaStats(9000, 6), heroTotals: { ana: hero(10, 70), mercy: hero(10, 40) } },
        'Bob-2222': { stats: anaStats(8000, 4), heroTotals: { ana: hero(10, 50), mercy: hero(10, 60) } },
        'Cleo-3333': { stats: anaStats(7000, 5), heroTotals: { mercy: hero(10, 50) } },
      })
      renderAt('/?players=Anna-1111,Bob-2222,Cleo-3333&stats=heroes')

      expect(await heroRow('Ana')).toEqual(['Ana', '▲70%2 KDA 10 games', '50%2 KDA 10 games', '—'])
    })

    it('dims a Player under 3 games and keeps them from leading, and says so', async () => {
      renderAt('/?players=Anna-1111,Bob-2222&stats=heroes')

      expect(await heroRow('Mercy')).toEqual(['100%2 KDA 2 games', 'Mercy', '40%2 KDA 20 games'])
      expect(screen.getByRole('cell', { name: /^100% win rate.*too few games to compare$/ })).toHaveClass('thin')
      expect(screen.getByText(/Under 3 games is dimmed/)).toBeInTheDocument()
    })

    it('tallies the Shared Heroes each Player leads, in the section and in the Score', async () => {
      renderAt('/?players=Anna-1111,Bob-2222&stats=heroes')

      await screen.findByRole('button', { name: 'Ana' })
      const [anna, bob] = screen.getAllByText(/^Leads on/).map((el) => el.textContent)
      // Mercy has no Leader, so Ana is the only hero that counts.
      expect(anna).toBe('Leads on 1 of 1 shared hero')
      expect(bob).toBe('Leads on 0 of 1 shared hero')
      const score = await within(screen.getByRole('columnheader', { name: 'Anna#1111' })).findByText(/Leads/)
      expect(score).toHaveTextContent('Leads 1 of 1')
    })

    it('says when no Shared Hero has a Leader', async () => {
      fakeOverfast({
        'Anna-1111': { stats: anaStats(9000, 6), heroTotals: { ana: hero(1, 100) } },
        'Bob-2222': { stats: anaStats(8000, 4), heroTotals: { ana: hero(1, 0) } },
      })
      renderAt('/?players=Anna-1111,Bob-2222&stats=heroes')

      expect(await screen.findByText(/None has a Leader yet/)).toBeInTheDocument()
      expect(screen.queryByText(/^Leads on/)).not.toBeInTheDocument()
    })

    it('says when the Players have no heroes in common', async () => {
      fakeOverfast({
        'Anna-1111': { stats: anaStats(9000, 6), heroTotals: { ana: hero(5, 50) } },
        'Bob-2222': { stats: anaStats(8000, 4), heroTotals: { mercy: hero(5, 50) } },
      })
      renderAt('/?players=Anna-1111,Bob-2222&stats=heroes')

      expect(await screen.findByText('These Players have no heroes in common.')).toBeInTheDocument()
    })

    it.each([
      ['a Shared Hero', () => screen.findByRole('button', { name: 'Ana' })],
      ['a row', async () => (await screen.findByRole('button', { name: 'Ana' })).closest('[role="row"]') as HTMLElement],
      ['a portrait', async () => (await screen.findAllByRole('button', { name: /^Ana, / }))[0]],
    ])('sets the Hero Scope from %s and opens its Fair Stats', async (_, find) => {
      const router = renderAt('/?players=Anna-1111,Bob-2222&stats=heroes')
      const user = userEvent.setup()

      await user.click(await find())

      await waitFor(() => expect(router.state.location.search.hero).toBe('ana'))
      expect(router.state.location.search.stats).toBe('fair')
      expect(router.state.location.searchStr).not.toContain('stats=')
      expect(await screen.findByRole('rowheader', { name: 'Healing Done - Avg per 10 Min' })).toBeInTheDocument()
      expect(screen.queryByRole('tab', { name: 'Heroes' })).not.toBeInTheDocument()
    })

    it('moves to Fair Stats when the hero picker sets a single hero', async () => {
      const router = renderAt('/?players=Anna-1111,Bob-2222&stats=heroes')
      const user = userEvent.setup()

      await user.click(await screen.findByRole('button', { name: 'Select Hero' }))
      await user.click(await screen.findByRole('button', { name: 'Ana', hidden: true, pressed: false }))

      await waitFor(() => expect(router.state.location.search.hero).toBe('ana'))
      expect(router.state.location.search.stats).toBe('fair')
    })

    it('hides only the failing Player’s Hero Pool, and leaves their Stat Rows alone', async () => {
      fakeOverfast({
        'Anna-1111': { stats: { 'all-heroes': anaStats(9000, 6).ana }, heroTotals: { ana: hero(5, 50) } },
        'Bob-2222': { stats: { 'all-heroes': anaStats(8000, 4).ana }, heroTotals: 404 },
      })
      renderAt('/?players=Anna-1111,Bob-2222&stats=heroes')

      expect(await screen.findByText("Couldn't load this Hero Pool")).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^Ana, / })).toBeInTheDocument()
      const bob = screen.getByRole('columnheader', { name: 'Bob#2222' })
      expect(within(bob).queryByText("Couldn't load stats")).not.toBeInTheDocument()
      expect(within(bob).queryByText(/Player not found/)).not.toBeInTheDocument()
    })

    it('asks for hero totals only on All Heroes, and once per Player', async () => {
      const router = renderAt('/?players=Anna-1111,Bob-2222&hero=ana')
      const user = userEvent.setup()
      await screen.findByRole('rowheader', { name: 'Healing Done - Avg per 10 Min' })
      const totalsRequests = () =>
        vi.mocked(fetch).mock.calls.filter(([url]) => String(url).includes('/stats/summary')).length
      expect(totalsRequests()).toBe(0)

      await user.click(screen.getByRole('button', { name: 'Change Hero' }))
      await user.click(await screen.findByRole('button', { name: 'All Heroes', hidden: true }))
      await waitFor(() => expect(router.state.location.search.hero).toBe('all-heroes'))
      await screen.findByRole('tab', { name: 'Heroes' })
      await user.keyboard('h')
      await screen.findByRole('button', { name: 'Ana' })

      expect(totalsRequests()).toBe(2)
    })
  })
})
describe('Player header flair', () => {
  const flair = {
    username: 'x',
    avatar: null,
    competitive: null,
    namecard: 'https://example.test/namecard.png',
    title: 'Data Broker',
    endorsement: { level: 4, frame: 'https://example.test/endorsement.svg#icon' },
  }

  const header = async (name: string) => {
    const found = await screen.findByRole('columnheader', { name })
    await within(found).findByRole('button', { name: `Change ${name}` })
    return found
  }

  it('shows the namecard, title and endorsement of a Player who has them', async () => {
    fakeOverfast({ 'Anna-1111': { summary: flair, stats: anaStats(9000, 6) }, 'Bob-2222': { stats: anaStats(8000, 4) } })
    renderAt('/?players=Anna-1111,Bob-2222&hero=ana')

    const anna = await header('Anna#1111')
    expect(await within(anna).findByText('Data Broker')).toBeInTheDocument()
    expect(anna.querySelector('.namecard')).toHaveAttribute('src', flair.namecard)
    const endorsement = within(anna).getByRole('img', { name: 'Endorsement level 4' })
    expect(endorsement).toHaveTextContent('4')
    expect(endorsement.querySelector('img')).toHaveAttribute('src', flair.endorsement.frame)
    // The strip still marks the Slot.
    expect(anna.querySelector('.slot-strip')).toBeInTheDocument()
  })

  it('shows nothing for a Player without them, or with OverFast\'s "no information" level 0', async () => {
    fakeOverfast({
      'Anna-1111': { summary: flair, stats: anaStats(9000, 6) },
      'Bob-2222': {
        summary: { ...summary(), namecard: null, title: null, endorsement: { level: 0, frame: 'https://example.test/0.svg' }, last_updated_at: null },
        stats: anaStats(8000, 4),
      },
      'Cleo-3333': { stats: anaStats(7000, 5) },
    })
    renderAt('/?players=Anna-1111,Bob-2222,Cleo-3333&hero=ana')

    await screen.findByText('Data Broker')
    for (const name of ['Bob#2222', 'Cleo#3333']) {
      const slot = await header(name)
      await within(slot).findByText(/Leads/)
      expect(slot.querySelector('.namecard, .flair')).not.toBeInTheDocument()
      expect(within(slot).queryByText(/Profile changed/)).not.toBeInTheDocument()
    }
  })

  it('leaves the namecard out of the Change form', async () => {
    fakeOverfast({ 'Anna-1111': { summary: flair, stats: anaStats(9000, 6) }, 'Bob-2222': { stats: anaStats(8000, 4) } })
    renderAt('/?players=Anna-1111,Bob-2222&hero=ana')
    const user = userEvent.setup()

    const anna = await header('Anna#1111')
    await within(anna).findByText('Data Broker')
    await user.click(within(anna).getByRole('button', { name: 'Change Anna#1111' }))

    expect(screen.getByRole('columnheader', { name: 'Anna#1111' }).querySelector('.namecard')).not.toBeInTheDocument()
  })

  it('says when the profile changed, with the exact time on hover', async () => {
    const now = new Date('2026-11-04T12:00:00Z')
    vi.useFakeTimers({ toFake: ['Date'], now })
    const changedAt = new Date(now.getTime() - 3 * 60 * 1000)
    fakeOverfast({
      'Anna-1111': { summary: { ...flair, last_updated_at: changedAt.getTime() / 1000 }, stats: anaStats(9000, 6) },
      'Bob-2222': { stats: anaStats(8000, 4) },
    })
    renderAt('/?players=Anna-1111,Bob-2222&hero=ana')

    const changed = await within(await header('Anna#1111')).findByText('Profile changed 3 min ago')
    expect(changed).toHaveAttribute('dateTime', changedAt.toISOString())
    expect(changed).toHaveAttribute('title', changedAt.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }))
  })

  it('ticks forward each minute without fetching again', async () => {
    const now = new Date('2026-11-04T12:00:00Z')
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'], now })
    fakeOverfast({
      'Anna-1111': { summary: { ...flair, last_updated_at: now.getTime() / 1000 - 3 * 60 }, stats: anaStats(9000, 6) },
      'Bob-2222': { stats: anaStats(8000, 4) },
    })
    renderAt('/?players=Anna-1111,Bob-2222&hero=ana')

    const anna = await header('Anna#1111')
    await within(anna).findByText('Profile changed 3 min ago')
    await screen.findByRole('rowheader', { name: 'Healing Done - Avg per 10 Min' })
    const fetches = vi.mocked(fetch).mock.calls.length

    act(() => {
      vi.advanceTimersByTime(60 * 1000)
    })
    expect(within(anna).getByText('Profile changed 4 min ago')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(2 * 60 * 60 * 1000)
    })
    expect(within(anna).getByText('Profile changed 2 hr ago')).toBeInTheDocument()
    expect(vi.mocked(fetch).mock.calls.length).toBe(fetches)
  })
})
