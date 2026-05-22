import '@testing-library/jest-dom'
import { vi } from 'vitest'
import React from 'react'

// Mock do Next.js Image sem usar JSX para manter a extensao .ts
vi.mock('next/image', () => ({
  default: (props: any) => {
    return React.createElement('img', props);
  },
}))
