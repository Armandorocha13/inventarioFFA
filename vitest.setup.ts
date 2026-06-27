import '@testing-library/jest-dom'
import { vi } from 'vitest'
import React from 'react'

// Mock do next/image sem JSX (mantém a extensão .ts).
type ImgProps = React.ImgHTMLAttributes<HTMLImageElement>;

vi.mock('next/image', () => ({
  default: (props: ImgProps) => React.createElement('img', props),
}))
