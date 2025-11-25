import { useMemo, useState } from 'react'
import {
  AimOutlined,
  AppstoreOutlined,
  AreaChartOutlined,
  BranchesOutlined,
  BugOutlined,
  CarOutlined,
  CheckSquareOutlined,
  ClockCircleOutlined,
  CloudDownloadOutlined,
  DatabaseOutlined,
  DollarOutlined,
  FileProtectOutlined,
  FileTextOutlined,
  IdcardOutlined,
  LineChartOutlined,
  NotificationOutlined,
  LogoutOutlined,
  ScheduleOutlined,
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import {
  Layout,
  Menu,
  Typography,
  Avatar,
  Button,
  Space,
  theme,
} from 'antd'
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import DashboardPage from './pages/Dashboard'
import StatisticsPage from './pages/Statistics'
import ApprovalsPage from './pages/Approvals'
import ApprovalWorkflowsPage from './pages/ApprovalWorkflows'
import AttendancePage from './pages/Attendance'
import ReceiptsPage from './pages/Receipts'
import ReceiptAnalytics from './pages/ReceiptAnalytics'
import ReimbursementsPage from './pages/Reimbursements'
import ChargingStationsPage from './pages/ChargingStations'
import InventoryPage from './pages/Inventory'
import MaterialRequestsPage from './pages/MaterialRequests'
import MaterialPricingPage from './pages/MaterialPricing'
import VehiclesPage from './pages/Vehicles'
import UsersPage from './pages/Users'
import RolesPage from './pages/Roles'
import CompaniesPage from './pages/Companies'
import HRPage from './pages/HR'
import LeavePage from './pages/Leave'
import ReportsPage from './pages/Reports'
import NoticesPage from './pages/Notices'
import DocumentsPage from './pages/Documents'
import SettingsPage from './pages/Settings'
import ReportBuilderPage from './pages/ReportBuilder'
import ExportCenterPage from './pages/ExportCenter'
import useAuthStore from './store/auth'
import useCompanyStore from './store/company'
import CompanySelector from './components/CompanySelector'
import LoginPage from './pages/Login'
import NotFoundPage from './pages/NotFound'
import './App.css'

const { Header, Sider, Content } = Layout
const { Title, Text } = Typography

const routeDefinitions = [
  {
    key: 'dashboard',
    label: '数据总览',
    path: '/dashboard',
    icon: <AreaChartOutlined />,
    element: <DashboardPage />,
  },
  {
    key: 'approval-center',
    label: '审批管理',
    icon: <CheckSquareOutlined />,
    children: [
      {
        key: 'approvals',
        label: '审批列表',
        path: '/approvals',
        element: <ApprovalsPage />,
      },
      {
        key: 'approval-workflows',
        label: '流程配置',
        path: '/approval-workflows',
        element: <ApprovalWorkflowsPage />,
      },
    ]
  },
  {
    key: 'receipts',
    label: '票据管理',
    icon: <FileTextOutlined />,
    children: [
      {
        key: 'receipt-list',
        label: '票据列表',
        path: '/receipts/list',
        element: <ReceiptsPage />,
      },
      {
        key: 'receipt-analytics',
        label: '票据分析',
        path: '/receipts/analytics',
        element: <ReceiptAnalytics />,
      },
    ],
  },
  {
    key: 'reimbursements',
    label: '报销管理',
    path: '/reimbursements',
    icon: <DollarOutlined />,
    element: <ReimbursementsPage />,
  },
  {
    key: 'charging',
    label: '充电管理',
    path: '/charging',
    icon: <AimOutlined />,
    element: <ChargingStationsPage />,
  },
  {
    key: 'inventory',
    label: '库存管理',
    path: '/inventory',
    icon: <DatabaseOutlined />,
    element: <InventoryPage />,
  },
  {
    key: 'material-requests',
    label: '物品领用',
    path: '/material-requests',
    icon: <AppstoreOutlined />,
    element: <MaterialRequestsPage />,
  },
  {
    key: 'material-pricing',
    label: '材料定价',
    path: '/material-pricing',
    icon: <DollarOutlined />,
    element: <MaterialPricingPage />,
  },
  {
    key: 'attendance',
    label: '考勤管理',
    path: '/attendance',
    icon: <ClockCircleOutlined />,
    element: <AttendancePage />,
  },
  {
    key: 'leave',
    label: '请假管理',
    path: '/leave',
    icon: <ScheduleOutlined />,
    element: <LeavePage />,
  },
  {
    key: 'reports',
    label: '故障上报',
    path: '/reports',
    icon: <BugOutlined />,
    element: <ReportsPage />,
  },
  {
    key: 'notices',
    label: '公告管理',
    path: '/notices',
    icon: <NotificationOutlined />,
    element: <NoticesPage />,
  },
  {
    key: 'documents',
    label: '文档管理',
    path: '/documents',
    icon: <FileProtectOutlined />,
    element: <DocumentsPage />,
  },
  {
    key: 'custom-reports',
    label: '自定义报表',
    path: '/custom-reports',
    icon: <LineChartOutlined />,
    element: <ReportBuilderPage />,
  },
  {
    key: 'export-center',
    label: '数据导出',
    path: '/export-center',
    icon: <CloudDownloadOutlined />,
    element: <ExportCenterPage />,
  },
  {
    key: 'hr',
    label: '人事管理',
    path: '/hr',
    icon: <IdcardOutlined />,
    element: <HRPage />,
  },
  {
    key: 'vehicles',
    label: '车辆管理',
    path: '/vehicles',
    icon: <CarOutlined />,
    element: <VehiclesPage />,
  },
  {
    key: 'users',
    label: '用户管理',
    path: '/users',
    icon: <TeamOutlined />,
    element: <UsersPage />,
  },
  {
    key: 'roles',
    label: '角色管理',
    path: '/roles',
    icon: <TeamOutlined />,
    element: <RolesPage />,
  },
  {
    key: 'companies',
    label: '公司管理',
    path: '/companies',
    icon: <TeamOutlined />,
    element: <CompaniesPage />,
  },
  {
    key: 'settings',
    label: '系统配置',
    path: '/settings',
    icon: <SettingOutlined />,
    element: <SettingsPage />,
  },
]

/**
 * 全局公司选择器组件
 * 使用全局状态，所有页面共享
 */
const GlobalCompanySelector = () => {
  const { selectedCompanyId, setSelectedCompanyId } = useCompanyStore()
  
  return (
    <CompanySelector
      value={selectedCompanyId}
      onChange={setSelectedCompanyId}
      style={{ minWidth: 180 }}
    />
  )
}

const flattenRoutes = (routes: any[]): any[] => {
  let flat: any[] = []
  routes.forEach(route => {
    if (route.children) {
      flat = flat.concat(flattenRoutes(route.children))
    } else {
      flat.push(route)
    }
  })
  return flat
}

const AppLayout = () => {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const {
    token: { colorBgContainer },
  } = theme.useToken()

  const selectedKeys = useMemo(() => {
    const activeRoute = flattenRoutes(routeDefinitions).find((route: any) =>
      route.path && location.pathname.startsWith(route.path),
    )
    return [activeRoute?.key ?? 'dashboard']
  }, [location.pathname])

  const menuItems: MenuProps['items'] = routeDefinitions.map((item: any) => {
    if (item.children) {
      return {
        key: item.key,
        label: item.label,
        icon: item.icon,
        children: item.children.map((child: any) => ({ key: child.key, label: child.label, icon: child.icon }))
      }
    }
    return { key: item.key, label: item.label, icon: item.icon }
  })

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    const route = flattenRoutes(routeDefinitions).find((item: any) => item.key === key)
    if (route && route.path) {
      navigate(route.path)
    }
  }

  return (
    <Layout className="app-layout">
      <Sider
        className="app-sider"
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={224}
      >
        <div className="logo-wrapper">
          <span className="logo-mark">LOGI</span>
          {!collapsed && <span className="logo-text">管理后台</span>}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={selectedKeys}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout className="app-main-layout">
        <Header className="app-header" style={{ background: colorBgContainer }}>
          <Title level={4} className="app-title">
            物流数字化运营中心
          </Title>
          <Space size="middle" align="center">
            <GlobalCompanySelector />
            <Avatar size={36}>
              {user?.name?.slice(0, 1)?.toUpperCase() || 'U'}
            </Avatar>
            <div style={{ lineHeight: '20px' }}>
              <div>
                <Text strong>{user?.name || '用户'}</Text>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {user?.role || '管理员'}
                </Text>
              </div>
            </div>
            <Button
              icon={<LogoutOutlined />}
              onClick={() => {
                logout()
                navigate('/login', { replace: true })
              }}
            >
              退出
            </Button>
          </Space>
        </Header>
        <Content className="app-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        {flattenRoutes(routeDefinitions).map((route: any) => (
          <Route key={route.key} path={route.path} element={route.element} />
        ))}
        <Route path="/statistics" element={<StatisticsPage />} />
      </Route>
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
