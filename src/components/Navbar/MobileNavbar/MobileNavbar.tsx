// 移动端导航栏组件

import { useState } from 'react'

/**
 * 导航链接接口
 */
interface NavLink {
  id: string;
  label: string;
  href: string;
}

/**
 * 移动端导航栏组件
 * 包含移动端菜单按钮和移动端导航菜单
 */
const MobileNavbar = ({
  navLinks
}: {
  navLinks: NavLink[]
}) => {
  // 移动端菜单展开状态
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // 处理移动端菜单切换
  const handleMobileMenuToggle = () => {
    setMobileMenuOpen(!mobileMenuOpen)
  }

  return (
    <>
      {/* 移动端菜单按钮 */}
      <div>
        <button
          onClick={handleMobileMenuToggle}
          className="navbar-mobile-button"
          aria-label={mobileMenuOpen ? '关闭菜单' : '打开菜单'}
          aria-expanded={mobileMenuOpen}
        >
          <svg 
            width="24" 
            height="24" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            {mobileMenuOpen ? (
              // 关闭图标
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              // 菜单图标
              <>
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* 移动端导航 */}
      {mobileMenuOpen && (
        <div className="navbar-mobile">
          <div className="navbar-mobile-links">
            {navLinks.map((link) => (
              <a 
                key={link.id}
                href={link.href}
                className="navbar-mobile-link"
                aria-label={link.label}
                onClick={handleMobileMenuToggle}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

export default MobileNavbar