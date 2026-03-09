import { Card, Col, Row, Typography, Space, Tag, Button, Layout, Avatar } from 'antd'
import { ArrowRightOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { modules } from '../config/modules'
import useAuthStore from '../store/auth'
import useCompanyStore from '../store/company'
import CompanySelector from '../components/CompanySelector'
import AccountSwitcher from '../components/AccountSwitcher'
import './ModuleHome.css'

const { Title, Text } = Typography
const { Header, Content } = Layout

const ModuleHome = () => {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { selectedCompanyId, setSelectedCompanyId } = useCompanyStore()
  
  // 过滤模块：如果不是超级管理员，隐藏系统管理模块
  const isSuperAdmin = user?.role === 'super_admin'
  const visibleModules = modules.filter(module => {
    if (module.requireAdmin && !isSuperAdmin) {
      return false
    }
    return true
  })
  
  const currentDate = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  })

  const quickStats = [
    { label: '功能模块', value: `${visibleModules.length} 个` },
    { label: '当前身份', value: user?.role || '管理员' },
    { label: '当前日期', value: currentDate },
  ]
  
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ 
        background: '#fff', 
        padding: '0 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(15, 23, 42, 0.06)',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        height: 72
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="module-home-logo">L</div>
          <div>
            <div className="module-home-brand">物流数字化运营中心</div>
            <div className="module-home-subtitle">Modular Workspace</div>
          </div>
        </div>
        
        <Space size="large">
          {isSuperAdmin ? (
            <CompanySelector
              value={selectedCompanyId}
              onChange={setSelectedCompanyId}
              style={{ minWidth: 180 }}
            />
          ) : (
            <AccountSwitcher style={{ minWidth: 240 }} />
          )}
          
          <Space>
            <Avatar icon={<UserOutlined />} className="module-home-avatar" />
            <div className="module-user-meta">
              <div className="module-user-name">{user?.name || '用户'}</div>
              <div className="module-user-role">{user?.role || '管理员'}</div>
            </div>
            <Button
              icon={<LogoutOutlined />}
              className="module-home-ghost-button"
              onClick={() => {
                logout()
                navigate('/login', { replace: true })
              }}
            >
              退出
            </Button>
          </Space>
        </Space>
      </Header>
      
      <Content>
        <div className="module-home">
          <div className="module-home-shell">
            <div className="welcome-banner">
              <div className="welcome-copy">
                <div className="welcome-eyebrow">首页</div>
                <Title level={1} className="welcome-title">
                  进入你要处理的业务模块
                </Title>
                <Text className="welcome-description">
                  首页只保留模块入口，让财务、运营、人事、物资、审批、数据等功能分区更清晰。
                </Text>
                <div className="welcome-actions">
                  <Button
                    type="primary"
                    size="large"
                    className="module-home-primary-button"
                    onClick={() => visibleModules[0] && navigate(visibleModules[0].path)}
                  >
                    进入工作区
                  </Button>
                </div>
              </div>
              <div className="welcome-stats">
                {quickStats.map(item => (
                  <div key={item.label} className="welcome-stat-card">
                    <div className="welcome-stat-label">{item.label}</div>
                    <div className="welcome-stat-value">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="modules-section-head">
              <div>
                <Title level={3} className="modules-section-title">
                  业务模块
                </Title>
                <Text className="modules-section-desc">
                  选择模块后进入对应工作区。
                </Text>
              </div>
            </div>
          
            <div className="modules-grid">
              <Row gutter={[24, 24]}>
                {visibleModules.map(module => (
                  <Col xs={24} md={12} xl={8} key={module.key}>
                    <Card 
                      className="module-card"
                      hoverable
                      onClick={() => navigate(module.path)}
                    >
                      <div className="module-card-top">
                        <div 
                          className="module-icon" 
                          style={{ 
                            color: module.color,
                            backgroundColor: `${module.color}12`
                          }}
                        >
                          {module.icon}
                        </div>
                        <div className="module-card-meta">
                          <Title level={3} className="module-card-title">
                            {module.name}
                          </Title>
                        </div>
                      </div>

                      <div className="module-card-description">
                        <Text>
                          {module.summary}
                        </Text>
                      </div>

                      <div className="module-card-tags">
                        {module.description.slice(0, 3).map((desc, index) => (
                          <span key={index} className="module-feature-item">
                            {desc}
                          </span>
                        ))}
                      </div>
                      
                      <div className="module-footer">
                        <Button 
                          type="text"
                          className="module-link-button"
                          icon={<ArrowRightOutlined />}
                        >
                          打开模块
                        </Button>
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>
            </div>
          </div>
        </div>
      </Content>
    </Layout>
  )
}

export default ModuleHome
