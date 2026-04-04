import { render, screen, fireEvent } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import CrawlTemplateSelector from './CrawlTemplateSelector'
import crawlerReducer from '../../store/slices/crawlerSlice'

// Mock store
const mockStore = configureStore({
  reducer: {
    crawler: crawlerReducer
  }
})

describe('CrawlTemplateSelector', () => {
  const mockOnTemplateSelect = vi.fn()
  const mockOnConfigChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('alert', vi.fn())
  })

  it('should render all templates', () => {
    render(
      <Provider store={mockStore}>
        <CrawlTemplateSelector />
      </Provider>
    )

    expect(screen.getByText('新闻网站')).toBeInTheDocument()
    expect(screen.getByText('电商平台')).toBeInTheDocument()
    expect(screen.getByText('社交媒体')).toBeInTheDocument()
    expect(screen.getByText('企业官网')).toBeInTheDocument()
    expect(screen.getByText('论坛社区')).toBeInTheDocument()
    expect(screen.getByText('自定义配置')).toBeInTheDocument()
  })

  it('should handle template selection', () => {
    render(
      <Provider store={mockStore}>
        <CrawlTemplateSelector
          onTemplateSelect={mockOnTemplateSelect}
          onConfigChange={mockOnConfigChange}
        />
      </Provider>
    )

    const newsTemplate = screen.getByText('新闻网站').closest('.template-card')
    fireEvent.click(newsTemplate!)

    expect(mockOnTemplateSelect).toHaveBeenCalledOnce()
    const selectedTemplate = mockOnTemplateSelect.mock.calls[0][0]
    expect(selectedTemplate.name).toBe('新闻网站')
    expect(selectedTemplate.id).toBe('news')

    expect(mockOnConfigChange).toHaveBeenCalledOnce()
    const config = mockOnConfigChange.mock.calls[0][0]
    expect(config.delay).toBe(1000)
    expect(config.timeout).toBe(30000)
    expect(config.retry).toBe(3)
  })

  it('should show custom config panel when custom template is selected', () => {
    render(
      <Provider store={mockStore}>
        <CrawlTemplateSelector />
      </Provider>
    )

    const customTemplate = screen.getByText('自定义配置').closest('.template-card')
    fireEvent.click(customTemplate!)

    expect(screen.getByText('自定义配置')).toBeInTheDocument()
    expect(screen.getByLabelText('请求延迟 (ms):')).toBeInTheDocument()
    expect(screen.getByLabelText('超时时间 (ms):')).toBeInTheDocument()
    expect(screen.getByLabelText('重试次数:')).toBeInTheDocument()
    expect(screen.getByLabelText('User Agent:')).toBeInTheDocument()
  })

  it('should handle custom config changes', () => {
    render(
      <Provider store={mockStore}>
        <CrawlTemplateSelector onConfigChange={mockOnConfigChange} />
      </Provider>
    )

    // Select custom template
    const customTemplate = screen.getByText('自定义配置').closest('.template-card')
    fireEvent.click(customTemplate!)

    // Change delay
    const delayInput = screen.getByLabelText('请求延迟 (ms):')
    fireEvent.change(delayInput, { target: { value: '2000' } })

    expect(mockOnConfigChange).toHaveBeenCalledWith(expect.objectContaining({
      delay: 2000
    }))

    // Change timeout
    const timeoutInput = screen.getByLabelText('超时时间 (ms):')
    fireEvent.change(timeoutInput, { target: { value: '45000' } })

    expect(mockOnConfigChange).toHaveBeenCalledWith(expect.objectContaining({
      timeout: 45000
    }))
  })

  it('should save custom template', () => {
    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      clear: vi.fn()
    }
    global.localStorage = localStorageMock as any

    render(
      <Provider store={mockStore}>
        <CrawlTemplateSelector />
      </Provider>
    )

    // Select custom template
    const customTemplate = screen.getByText('自定义配置').closest('.template-card')
    fireEvent.click(customTemplate!)

    // Save custom template
    const saveButton = screen.getByText('💾 保存为模板')
    fireEvent.click(saveButton)

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'customTemplates',
      expect.any(String)
    )
  })

  it('should show config summary for non-custom templates', () => {
    render(
      <Provider store={mockStore}>
        <CrawlTemplateSelector />
      </Provider>
    )

    // Select news template
    const newsTemplate = screen.getByText('新闻网站').closest('.template-card')
    fireEvent.click(newsTemplate!)

    expect(screen.getByText('当前配置摘要')).toBeInTheDocument()
    expect(screen.getByText('模板类型:')).toBeInTheDocument()
    expect(screen.getByText('新闻网站')).toBeInTheDocument()
    expect(screen.getByText('请求延迟:')).toBeInTheDocument()
    expect(screen.getByText('1000ms')).toBeInTheDocument()
  })

  it('should display template icons correctly', () => {
    render(
      <Provider store={mockStore}>
        <CrawlTemplateSelector />
      </Provider>
    )

    expect(screen.getByText('📰')).toBeInTheDocument() // News
    expect(screen.getByText('🛒')).toBeInTheDocument() // E-commerce
    expect(screen.getByText('💬')).toBeInTheDocument() // Social
    expect(screen.getByText('🏢')).toBeInTheDocument() // Enterprise
    expect(screen.getByText('👥')).toBeInTheDocument() // Forum
    expect(screen.getByText('⚙️')).toBeInTheDocument() // Custom
  })

  it('should handle follow redirects checkbox change', () => {
    render(
      <Provider store={mockStore}>
        <CrawlTemplateSelector onConfigChange={mockOnConfigChange} />
      </Provider>
    )

    // Select custom template
    const customTemplate = screen.getByText('自定义配置').closest('.template-card')
    fireEvent.click(customTemplate!)

    // Toggle follow redirects
    const checkbox = screen.getByLabelText('跟随重定向')
    fireEvent.click(checkbox)

    expect(mockOnConfigChange).toHaveBeenCalledWith(expect.objectContaining({
      followRedirects: false
    }))
  })

  it('should apply custom className', () => {
    render(
      <Provider store={mockStore}>
        <CrawlTemplateSelector className="custom-class" />
      </Provider>
    )

    const container = screen.getByText('新闻网站').closest('.crawl-template-selector')
    expect(container).toHaveClass('custom-class')
  })

  it('should use currentDepth for custom template recommended depth', () => {
    render(
      <Provider store={mockStore}>
        <CrawlTemplateSelector currentDepth={5} />
      </Provider>
    )

    // Select custom template
    const customTemplate = screen.getByText('自定义配置').closest('.template-card')
    fireEvent.click(customTemplate!)

    expect(screen.getByText('推荐深度:')).toBeInTheDocument()
    expect(screen.getByText('5层')).toBeInTheDocument()
  })
})