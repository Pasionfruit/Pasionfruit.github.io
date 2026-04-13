import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})

if (!window.requestAnimationFrame) {
  window.requestAnimationFrame = (callback) => setTimeout(callback, 0)
}

if (!window.cancelAnimationFrame) {
  window.cancelAnimationFrame = (id) => clearTimeout(id)
}

class MockAudioContext {
  constructor() {
    this.state = 'running'
    this.currentTime = 0
    this.destination = {}
  }

  createOscillator() {
    return {
      type: 'sine',
      frequency: {
        setValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {},
      },
      connect: () => {},
      start: () => {},
      stop: () => {},
    }
  }

  createGain() {
    return {
      gain: {
        setValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {},
      },
      connect: () => {},
    }
  }

  resume() {
    return Promise.resolve()
  }

  close() {
    return Promise.resolve()
  }
}

window.AudioContext = MockAudioContext
window.webkitAudioContext = MockAudioContext
