import { createMemoryHistory } from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App'
import { createQueryClient } from '../api/queries'
import { createAppRouter } from '../router'

const HEROES = [
  { key: 'reinhardt', name: 'Reinhardt', portrait: 'https://example.test/reinhardt.png', role: 'tank' },
  { key: 'ana', name: 'Ana', portrait: 'https://example.test/ana.png', role: 'support' },
]

const REINHARDT = {
  name: 'Reinhardt',
  role: 'tank',
  subrole: 'stalwart',
  hitpoints: { health: 400, armor: 300, shields: 0, total: 700 },
  abilities: [
    { name: 'Charge', description: 'Charge forward and pin an enemy.', icon: 'https://example.test/charge.png' },
    { name: 'Fire Strike', description: 'Launch a fiery projectile.', icon: 'https://example.test/strike.png' },
  ],
}

/** Stands in for OverFast: only the hero list and the given heroes answer; anything else is a 404. */
function fakeOverfast(details: Record<string, object>) {
  const fetchFake = vi.fn(async (input: string) => {
    const { pathname } = new URL(input)
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
    if (pathname === '/heroes') return json(HEROES)
    const hero = details[pathname.replace('/heroes/', '')]
    return hero ? json(hero) : json({ error: 'Not found' }, 404)
  })
  vi.stubGlobal('fetch', fetchFake)
  return fetchFake
}

const requestedPaths = (fetchFake: ReturnType<typeof fakeOverfast>) =>
  fetchFake.mock.calls.map(([input]) => new URL(input).pathname)

function renderAt(url: string) {
  const router = createAppRouter({ history: createMemoryHistory({ initialEntries: [url] }) })
  render(<App router={router} queryClient={createQueryClient()} />)
  return router
}

const heroCell = () => screen.findByRole('columnheader', { name: 'Stat' })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('hero cell flair', () => {
  it("shows the hero's subrole, Hitpoints and Abilities when a single hero is picked", async () => {
    fakeOverfast({ reinhardt: REINHARDT })
    renderAt('/?hero=reinhardt')

    const cell = await heroCell()
    const bar = await within(cell).findByRole('img', { name: 'Hitpoints: 400 health, 300 armor, 700 total' })
    expect(bar).toHaveTextContent('400300')
    expect(within(cell).getByText('stalwart')).toBeInTheDocument()
    expect(within(cell).getByText('Reinhardt', { selector: '.hero-name' })).toBeInTheDocument()
    expect(within(cell).getByRole('button', { name: 'Change Hero' })).toBeInTheDocument()
    expect(within(cell).getByRole('button', { name: 'Charge' })).toHaveAccessibleDescription(
      'Charge forward and pin an enemy.',
    )
    expect(within(cell).getByRole('button', { name: 'Fire Strike' })).toBeInTheDocument()
  })

  it('leaves out a Hitpoints bar when OverFast has none for the hero, keeping the Abilities', async () => {
    fakeOverfast({ reinhardt: { ...REINHARDT, hitpoints: null } })
    renderAt('/?hero=reinhardt')

    const cell = await heroCell()
    expect(await within(cell).findByRole('button', { name: 'Charge' })).toBeInTheDocument()
    expect(within(cell).queryByRole('img', { name: /Hitpoints/ })).not.toBeInTheDocument()
  })

  it("doesn't ask for hero details with All Heroes", async () => {
    const fetchFake = fakeOverfast({ reinhardt: REINHARDT })
    renderAt('/')

    const cell = await heroCell()
    await within(cell).findByRole('button', { name: 'Select Hero' })
    await waitFor(() => expect(requestedPaths(fetchFake)).toContain('/heroes'))
    expect(requestedPaths(fetchFake).filter((path) => path.startsWith('/heroes/'))).toEqual([])
    expect(within(cell).queryByRole('img', { name: /Hitpoints/ })).not.toBeInTheDocument()
  })

  it("doesn't ask for hero details for a hero key that doesn't exist", async () => {
    const fetchFake = fakeOverfast({})
    renderAt('/?hero=nobody')

    const cell = await heroCell()
    await within(cell).findByRole('button', { name: 'Select Hero' })
    await waitFor(() => expect(requestedPaths(fetchFake)).toContain('/heroes'))
    expect(requestedPaths(fetchFake)).not.toContain('/heroes/nobody')
  })

  it("looks the same as without flair when the hero's details can't be loaded", async () => {
    const fetchFake = fakeOverfast({})
    renderAt('/?hero=ana')

    const cell = await heroCell()
    await within(cell).findByText('Ana', { selector: '.hero-main span' })
    await waitFor(() => expect(requestedPaths(fetchFake)).toContain('/heroes/ana'))
    expect(within(cell).getByRole('button', { name: 'Change Hero' })).toBeInTheDocument()
    expect(within(cell).queryByRole('img', { name: /Hitpoints/ })).not.toBeInTheDocument()
    expect(within(cell).queryByRole('list', { name: 'Abilities' })).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('swaps to the new hero when the Hero Scope changes', async () => {
    fakeOverfast({ reinhardt: REINHARDT, ana: { ...REINHARDT, name: 'Ana', abilities: [] } })
    renderAt('/?hero=reinhardt')
    const user = userEvent.setup()

    const cell = await heroCell()
    await within(cell).findByRole('button', { name: 'Charge' })
    await user.click(within(cell).getByRole('button', { name: 'Change Hero' }))
    await user.click(await screen.findByRole('button', { name: 'Ana', hidden: true }))

    await waitFor(() => expect(within(cell).queryByRole('button', { name: 'Charge' })).not.toBeInTheDocument())
  })

  describe('ability descriptions', () => {
    const ability = async () => {
      fakeOverfast({ reinhardt: REINHARDT })
      renderAt('/?hero=reinhardt')
      return within(await heroCell()).findByRole('button', { name: 'Charge' })
    }

    it('are closed until asked for', async () => {
      await ability()
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })

    it('show on mouse hover and go when the mouse leaves', async () => {
      const button = await ability()
      const user = userEvent.setup()

      await user.hover(button)
      expect(screen.getByRole('tooltip')).toHaveTextContent('Charge forward and pin an enemy.')

      await user.unhover(button)
      await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument())
    })

    it('stay open while the mouse moves onto them', async () => {
      const button = await ability()
      const user = userEvent.setup()

      await user.hover(button)
      await user.hover(screen.getByRole('tooltip'))
      await new Promise((resolve) => setTimeout(resolve, 300))
      expect(screen.getByRole('tooltip')).toBeInTheDocument()

      await user.unhover(screen.getByRole('tooltip'))
      await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument())
    })

    it('show on keyboard focus, and Escape or moving on closes them', async () => {
      const button = await ability()
      const user = userEvent.setup()

      button.focus()
      await waitFor(() => expect(screen.getByRole('tooltip')).toHaveTextContent('Charge forward'))

      await user.keyboard('{Escape}')
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
      expect(button).toHaveFocus()

      await user.tab({ shift: true })
      await user.tab()
      expect(screen.getByRole('tooltip')).toBeInTheDocument()
      await user.tab()
      expect(screen.getByRole('tooltip')).toHaveTextContent('Launch a fiery projectile.')
    })

    it('show on a tap and go on a tap elsewhere', async () => {
      const button = await ability()
      const user = userEvent.setup()

      await user.pointer({ keys: '[TouchA]', target: button })
      expect(screen.getByRole('tooltip')).toHaveTextContent('Charge forward')
      // A second tap on the same icon doesn't hide what was just asked for.
      await user.pointer({ keys: '[TouchA]', target: button })
      expect(screen.getByRole('tooltip')).toBeInTheDocument()

      await user.pointer({ keys: '[TouchA]', target: document.body })
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })
  })
})
