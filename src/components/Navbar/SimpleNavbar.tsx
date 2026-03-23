import MobileNavbar from './MobileNavbar/MobileNavbar'

/**
 * 导航链接接口
 */
interface NavLink {
  id: string;
  label: string;
  href: string;
}

/**
 * 简单的导航栏组件，使用外部 CSS 样式
 * 包含桌面端导航菜单，移动端导航通过 MobileNavbar 组件实现
 */
const SimpleNavbar = () => {
  // 导航链接数据
  const navLinks: NavLink[] = [
    { id: 'home', label: '爬虫首页', href: '#home' },
    { id: 'crawler', label: '爬虫功能', href: '#crawler' },
    { id: 'analisys', label: '数据分析', href: '#analisys' },
    { id: 'settings', label: '设置', href: '#settings' }
  ]

  return (
    <header className="navbar-header">
      <div className="navbar-container">
        {/* Logo 部分 */}
        <div className="navbar-logo">
          <a 
            href="#" 
            className="navbar-logo-link"
            aria-label="网站首页"
          >
            <i className="fas fa-code navbar-logo-icon"></i>
            <span className="navbar-logo-text">我的网页</span>
          </a>
        </div>

        {/* 桌面端导航 */}
        <nav className="navbar-desktop">
          {navLinks.map((link) => (
            <a 
              key={link.id}
              href={link.href}
              className="navbar-link"
              aria-label={link.label}
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* 移动端导航 */}
        <MobileNavbar navLinks={navLinks} />
      </div>
    </header>
  )
}

export default SimpleNavbar