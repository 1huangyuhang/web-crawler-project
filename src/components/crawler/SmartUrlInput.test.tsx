import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import SmartUrlInput from './SmartUrlInput'
import crawlerReducer from '../../store/slices/crawlerSlice'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}

global.localStorage = localStorageMock as any

// Mock store
const mockStore = configureStore({
  reducer: {
    crawler: crawlerReducer
  }
})

describe('SmartUrlInput', () => {
  const mockOnChange = vi.fn()
  const mockOnEnter = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
  })

  it('should render with default placeholder', () => {
    render(
      <Provider store={mockStore}>
        <SmartUrlInput value="" onChange={mockOnChange} />
      </Provider>
    )

    expect(screen.getByPlaceholderText('https://example.com')).toBeInTheDocument()
  })

  it('should render with custom placeholder', () => {
    render(
      <Provider store={mockStore}>
        <SmartUrlInput value="" onChange={mockOnChange} placeholder="输入目标网站" />
      </Provider>
    )

    expect(screen.getByPlaceholderText('输入目标网站')).toBeInTheDocument()
  })

  it('should handle input changes', async () => {
    render(
      <Provider store={mockStore}>
        <SmartUrlInput value="" onChange={mockOnChange} />
      </Provider>
    )

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'https://example.com' } })

    expect(mockOnChange).toHaveBeenCalledWith('https://example.com')

    await waitFor(() => {
      expect(screen.getByText('打开 "https://example.com"')).toBeInTheDocument()
    })
  })

  it('should show suggestions when typing', async () => {
    render(
      <Provider store={mockStore}>
        <SmartUrlInput value="" onChange={mockOnChange} />
      </Provider>
    )

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '新浪' } })

    await waitFor(() => {
      expect(screen.getByText('新浪新闻')).toBeInTheDocument()
    })
  })

  it('should handle Enter key for custom URL', async () => {
    render(
      <Provider store={mockStore}>
        <SmartUrlInput value="https://test.com" onChange={mockOnChange} onEnter={mockOnEnter} />
      </Provider>
    )

    const input = screen.getByRole('textbox')
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    expect(mockOnEnter).toHaveBeenCalledWith('https://test.com')
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'urlHistory',
      expect.any(String)
    )
  })

  it('should handle Enter key for suggestion selection', async () => {
    // Mock history data
    const mockHistory = [
      { url: 'https://news.sina.com.cn', label: 'https://news.sina.com.cn', type: 'history', timestamp: Date.now() }
    ]
    localStorageMock.getItem.mockReturnValue(JSON.stringify(mockHistory))

    render(
      <Provider store={mockStore}>
        <SmartUrlInput value="" onChange={mockOnChange} onEnter={mockOnEnter} />
      </Provider>
    )

    const input = screen.getByRole('textbox')
    fireEvent.focus(input)

    await waitFor(() => {
      expect(screen.getByText('新浪新闻')).toBeInTheDocument()
    })

    fireEvent.keyDown(input, { key: 'ArrowDown', code: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    expect(mockOnEnter).toHaveBeenCalled()
    expect(localStorage.setItem).toHaveBeenCalled()
  })

  it('should clear history', async () => {
    render(
      <Provider store={mockStore}>
        <SmartUrlInput value="" onChange={mockOnChange} />
      </Provider>
    )

    const input = screen.getByRole('textbox')
    fireEvent.focus(input)

    await waitFor(() => {
      expect(screen.getByText('清除历史')).toBeInTheDocument()
    })

    const clearButton = screen.getByText('清除历史')
    fireEvent.click(clearButton)

    expect(localStorage.removeItem).toHaveBeenCalledWith('urlHistory')
  })

  it('should show validation indicators', async () => {
    render(
      <Provider store={mockStore}>
        <SmartUrlInput value="" onChange={mockOnChange} />
      </Provider>
    )

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'https://valid.com' } })

    // Should show checking indicator
    await waitFor(() => {
      expect(screen.getByText('✓')).toBeInTheDocument()
    })
  })

  it('should handle disabled state', () => {
    render(
      <Provider store={mockStore}>
        <SmartUrlInput value="" onChange={mockOnChange} disabled={true} />
      </Provider>
    )

    const input = screen.getByRole('textbox')
    expect(input).toBeDisabled()
  })

  it('should apply custom className', () => {
    render(
      <Provider store={mockStore}>
        <SmartUrlInput value="" onChange={mockOnChange} className="custom-input" />
      </Provider>
    )

    const container = screen.getByRole('textbox').closest('.smart-url-input')
    expect(container).toHaveClass('custom-input')
  })

  it('should filter suggestions based on input', async () => {
    render(
      <Provider store={mockStore}>
        <SmartUrlInput value="" onChange={mockOnChange} />
      </Provider>
    )

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '淘宝' } })

    await waitFor(() => {
      expect(screen.getByText('淘宝')).toBeInTheDocument()
      expect(screen.queryByText('新浪新闻')).not.toBeInTheDocument()
    })
  })

  it('should show history when input is empty and focused', async () => {
    // Mock history data
    const mockHistory = [
      { url: 'https://example.com', label: 'https://example.com', type: 'history', timestamp: Date.now() }
    ]
    localStorageMock.getItem.mockReturnValue(JSON.stringify(mockHistory))

    render(
      <Provider store={mockStore}>
        <SmartUrlInput value="" onChange={mockOnChange} />
      </Provider>
    )

    const input = screen.getByRole('textbox')
    fireEvent.focus(input)

    await waitFor(() => {
      expect(screen.getByText('https://example.com')).toBeInTheDocument()
    })
  })

  it('should hide suggestions on Escape key', async () => {
    render(
      <Provider store={mockStore}>
        <SmartUrlInput value="https://test.com" onChange={mockOnChange} />
      </Provider>
    )

    const input = screen.getByRole('textbox')
    fireEvent.focus(input)

    await waitFor(() => {
      expect(screen.getByText('打开 "https://test.com"')).toBeInTheDocument()
    })

    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByText('打开 "https://test.com"')).not.toBeInTheDocument()
    })
  })

  it('should handle click outside to close suggestions', async () => {
    render(
      <Provider store={mockStore}>
        <SmartUrlInput value="https://test.com" onChange={mockOnChange} />
        <div data-testid="outside-element">Outside</div>
      </Provider>
    )

    const input = screen.getByRole('textbox')
    fireEvent.focus(input)

    await waitFor(() => {
      expect(screen.getByText('打开 "https://test.com"')).toBeInTheDocument()
    })

    const outsideElement = screen.getByTestId('outside-element')
    fireEvent.mouseDown(outsideElement)

    await waitFor(() => {
      expect(screen.queryByText('打开 "https://test.com"')).not.toBeInTheDocument()
    })
  })

  it('should save URL to history on Enter', async () => {
    render(
      <Provider store={mockStore}>
        <SmartUrlInput value="https://new-url.com" onChange={mockOnChange} onEnter={mockOnEnter} />
      </Provider>
    )

    const input = screen.getByRole('textbox')
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    await waitFor(() => {
      expect(localStorage.setItem).toHaveBeenCalled()
      const savedData = JSON.parse(localStorage.setItem.mock.calls[0][1])
      expect(savedData[0].url).toBe('https://new-url.com')
    })
  })
})