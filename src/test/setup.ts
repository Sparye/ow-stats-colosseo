import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom hides [popover] elements but has no Popover API to show them.
if (!HTMLElement.prototype.showPopover) {
  HTMLElement.prototype.showPopover = function () {
    this.style.display = 'block'
  }
  HTMLElement.prototype.hidePopover = function () {
    this.style.display = ''
  }
}

afterEach(() => {
  cleanup()
})
