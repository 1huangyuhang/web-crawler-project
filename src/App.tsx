import SimpleNavbar from './components/Navbar/SimpleNavbar'
import { HomeContent } from './page/home/HomeComponents'
import Footer from './components/Footer/Footer'
import AnalisysPage from './page/analisys/AnalisysPage'
import CrawlerPage from './page/crawler/CrawlerPage'
import SettingsPage from './page/settings/SettingsPage'
import { useAppLogic, getPageConfig } from './js/AppLogic'
function App() {
  // 使用应用逻辑钩子
  const { currentPage } = useAppLogic()
  
  // 获取当前页面配置
  const pageConfig = getPageConfig(currentPage)

  // 渲染当前页面
  const renderPage = () => {
    switch (currentPage) {
      case 'analisys':
        return <AnalisysPage />;
      case 'crawler':
        return <CrawlerPage />;
      case 'settings':
        return <SettingsPage />;
      case 'home':
      default:
        return <HomeContent />;
    }
  };

  return (
    <div>
      {pageConfig.showNavbar && <SimpleNavbar />}
      {renderPage()}
      {pageConfig.showFooter && <Footer />}
    </div>
  )
}

export default App