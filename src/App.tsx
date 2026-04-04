import { lazy, Suspense } from 'react'
import { Provider } from 'react-redux'
import { store } from './store'
import Navbar from './components/Navbar/Navbar'
import { HomeContent } from './page/home/HomeComponents'
import { useAppLogic } from './js/AppLogic'
import { CrawlerProvider } from './js/useCrawler'

const CrawlerPage = lazy(() => import('./page/crawler/CrawlerPage'))
const AnalisysPage = lazy(() => import('./page/analisys/AnalisysPage'))
const TemplatesPage = lazy(() => import('./page/templates/TemplatesPage'))
const AiAnalysisPage = lazy(() => import('./page/ai/AiAnalysisPage'))
const SettingsPage = lazy(() => import('./page/settings/SettingsPage'))

function App() {
  const { currentPage } = useAppLogic()

  const renderPage = () => {
    switch (currentPage) {
      case 'analisys':  return <AnalisysPage />;
      case 'crawler':   return <CrawlerPage />;
      case 'templates': return <TemplatesPage />;
      case 'ai':        return <AiAnalysisPage />;
      case 'settings':  return <SettingsPage />;
      case 'home':
      default:          return <HomeContent />;
    }
  };

  return (
    <Provider store={store}>
      <CrawlerProvider>
        <Navbar currentPage={currentPage} />
        <main className="app-shell-main flex min-h-0 flex-1 flex-col">
          <Suspense fallback={<div className="page-suspense-fallback">页面加载中…</div>}>
            {renderPage()}
          </Suspense>
        </main>
      </CrawlerProvider>
    </Provider>
  )
}

export default App
