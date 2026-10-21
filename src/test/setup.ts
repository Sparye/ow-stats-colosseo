import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom has no Popover API; the hero picker closes itself after a choice.
HTMLElement.prototype.hidePopover ??= () => {}

afterEach(() => {
  cleanup()
})
