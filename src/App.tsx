import React, { useMemo, useState } from 'react'
import {
  AimOutlined,
  AppstoreOutlined,
  AreaChartOutlined,
  BarChartOutlined,
  BranchesOutlined,
  BugOutlined,
  CalendarOutlined,
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
  RocketOutlined,
  ScheduleOutlined,
  SettingOutlined,
  ShopOutlined,
  SolutionOutlined,
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
import { useQuery } from '@tanstack/react-query'
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
import ChargingList from './pages/ChargingList'
import ChargingStats from './pages/ChargingStats'
import InventoryPage from './pages/Inventory'
import MaterialRequestsPage from './pages/MaterialRequests'
import MaterialPricingPage from './pages/MaterialPricing'
import VehiclesPage from './pages/Vehicles'
import VehicleUsageCalendarPage from './pages/VehicleUsageCalendar'
import UsersPage from './pages/Users'
import RolesPage from './pages/Roles'
import PermissionsPage from './pages/Permissions'
import CompaniesPage from './pages/Companies'
import DepartmentsPage from './pages/Departments'
import HRPage from './pages/HR'
import LeavePage from './pages/Leave'
import ReportsPage from './pages/Reports'
import PurchasesPage from './pages/Purchases'
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
import AttendanceConfigPage from './pages/AttendanceConfig'
import DriverSalaryPage from './pages/DriverSalary'
import './App.css'
import { fetchSystemConfig } from './api/services/systemConfig'

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
      {
        key: 'reimbursements',
        label: '报销管理',
        path: '/reimbursements',
        element: <ReimbursementsPage />,
      },
      {
        key: 'purchases',
        label: '采购管理',
        path: '/purchases',
        element: <PurchasesPage />,
      },
      {
        key: 'leave',
        label: '请假管理',
        path: '/leave',
        element: <LeavePage />,
      },
      {
        key: 'material-requests',
        label: '物品领用',
        path: '/material-requests',
        element: <MaterialRequestsPage />,
      },
      {
        key: 'reports',
        label: '故障上报',
        path: '/reports',
        element: <ReportsPage />,
      },
    ]
  },
  {
    key: 'operations',
    label: '运营管理',
    icon: <RocketOutlined />,
    children: [
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
        key: 'vehicles',
        label: '车辆管理',
        icon: <CarOutlined />,
        children: [
          {
            key: 'vehicles-list',
            label: '车辆列表',
            path: '/vehicles',
            icon: <CarOutlined />,
            element: <VehiclesPage />,
          },
          {
            key: 'vehicle-usage-calendar',
            label: '使用日历',
            path: '/vehicles/usage-calendar',
            icon: <CalendarOutlined />,
            element: <VehicleUsageCalendarPage />,
          },
        ],
      },
      {
        key: 'charging',
        label: '充电管理',
        icon: <AimOutlined />,
        children: [
          {
            key: 'charging-list',
            label: '充电单列表',
            path: '/charging/list',
            element: <ChargingList />,
          },
          {
            key: 'charging-stats',
            label: '数据分析',
            path: '/charging/stats',
            element: <ChargingStats />,
          },
          {
            key: 'charging-stations',
            label: '充电站管理',
            path: '/charging/stations',
            element: <ChargingStationsPage />,
          },
        ],
      },
    ]
  },
  {
    key: 'materials',
    label: '物资管理',
    icon: <ShopOutlined />,
    children: [
      {
        key: 'inventory',
        label: '库存管理',
        path: '/inventory',
        icon: <DatabaseOutlined />,
        element: <InventoryPage />,
      },
      {
        key: 'material-pricing',
        label: '材料定价',
        path: '/material-pricing',
        icon: <DollarOutlined />,
        element: <MaterialPricingPage />,
      },
    ]
  },
  {
    key: 'administration',
    label: '行政人事',
    icon: <SolutionOutlined />,
    children: [
      {
        key: 'hr',
        label: '人事管理',
        path: '/hr',
        icon: <IdcardOutlined />,
        element: <HRPage />,
      },
      {
        key: 'attendance',
        label: '考勤管理',
        path: '/attendance',
        icon: <ClockCircleOutlined />,
        element: <AttendancePage />,
      },
          {
            key: 'attendance-config',
            label: '考勤配置',
            path: '/attendance-config',
            icon: <SettingOutlined />,
            element: <AttendanceConfigPage />,
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
        key: 'salary',
        label: '工资管理',
        path: '/salary',
        icon: <DollarOutlined />,
        element: <DriverSalaryPage />,
      },
    ]
  },
  {
    key: 'data-center',
    label: '数据中心',
    icon: <BarChartOutlined />,
    children: [
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
    ]
  },
  {
    key: 'system',
    label: '系统管理',
    icon: <SettingOutlined />,
    children: [
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
        key: 'permissions',
        label: '权限管理',
        path: '/permissions',
        icon: <FileProtectOutlined />,
        element: <PermissionsPage />,
      },
      {
        key: 'companies',
        label: '公司管理',
        path: '/companies',
        icon: <TeamOutlined />,
        element: <CompaniesPage />,
      },
      {
        key: 'departments',
        label: '部门管理',
        path: '/departments',
        icon: <TeamOutlined />,
        element: <DepartmentsPage />,
      },
      {
        key: 'settings',
        label: '系统配置',
        path: '/settings',
        icon: <SettingOutlined />,
        element: <SettingsPage />,
      },
    ]
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

// 查找某个 key 的所有父级菜单 key（用于自动展开菜单）
const findMenuOpenKeys = (routes: any[], targetKey: string, currentPath: string[] = []): string[] | null => {
  for (const route of routes) {
    if (route.key === targetKey) {
      return currentPath
    }
    if (route.children) {
      const path = findMenuOpenKeys(route.children, targetKey, [...currentPath, route.key])
      if (path) return path
    }
  }
  return null
}

const AppLayout = () => {
  const [collapsed, setCollapsed] = useState(false)
  const [openKeys, setOpenKeys] = useState<string[]>([])
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const {
    token: { colorBgContainer },
  } = theme.useToken()

  // 认证守卫：未登录立即跳转到登录页
  if (!user) {
    return <Navigate to="/login" replace />
  }

  const configQuery = useQuery({
    queryKey: ['system-config-layout'],
    queryFn: fetchSystemConfig,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
  const config = configQuery.data?.base

  const selectedKeys = useMemo(() => {
    const flat = flattenRoutes(routeDefinitions).filter((r: any) => r.path)
    // 优先匹配最长路径，避免 /attendance-config 被 /attendance 抢占
    const activeRoute = flat
      .sort((a: any, b: any) => (b.path?.length || 0) - (a.path?.length || 0))
      .find((route: any) => location.pathname.startsWith(route.path))
    return [activeRoute?.key ?? 'dashboard']
  }, [location.pathname])

  // 当路由变化时，自动展开对应的菜单
  React.useEffect(() => {
    const activeKey = selectedKeys[0]
    const keys = findMenuOpenKeys(routeDefinitions, activeKey)
    if (keys) {
      setOpenKeys((prev) => {
        const newKeys = [...prev, ...keys]
        return Array.from(new Set(newKeys))
      })
    }
  }, [selectedKeys])

  // 处理菜单展开/折叠
  const onOpenChange: MenuProps['onOpenChange'] = (keys) => {
    setOpenKeys(keys as string[])
  }

  const isSuperAdmin = user?.role === 'super_admin' || user?.positionType === '超级管理员'

  const generateMenuItems = (routes: any[]): MenuProps['items'] => {
    const items: any[] = []
    
    for (const item of routes) {
      // 过滤掉公司管理菜单项（非超级管理员）
      if (item.key === 'companies' && !isSuperAdmin) {
        continue
      }
      
      if (item.children) {
        // 递归处理子菜单，并过滤掉公司管理
        const filteredChildren = generateMenuItems(item.children)
        // 如果过滤后子菜单为空，则不显示父菜单
        if (filteredChildren && filteredChildren.length > 0) {
          items.push({
            key: item.key,
            label: item.label,
            icon: item.icon,
            children: filteredChildren,
          })
        }
      } else {
        items.push({
          key: item.key,
          label: item.label,
          icon: item.icon,
        })
      }
    }
    
    return items
  }

  const menuItems = useMemo(() => generateMenuItems(routeDefinitions), [isSuperAdmin])

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
        <div className="logo-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {config?.logo_url ? (
            <img 
              src={config.logo_url} 
              alt="Logo" 
              style={{ 
                height: 48, 
                width: 'auto', 
                maxWidth: collapsed ? 48 : 160,
                objectFit: 'contain' 
              }} 
            />
          ) : (
            <span className="logo-mark">LOGI</span>
          )}
          {!collapsed && !config?.logo_url && <span className="logo-text">{config?.system_name || '管理后台'}</span>}
          {!collapsed && config?.logo_url && <span className="logo-text" style={{ fontSize: 18 }}>{config?.system_name}</span>}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={selectedKeys}
          openKeys={openKeys}
          onOpenChange={onOpenChange}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout className="app-main-layout">
        <Header className="app-header" style={{ background: colorBgContainer }}>
          <Title level={4} className="app-title">
            {config?.system_name || '物流数字化运营中心'}
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

// 权限保护的路由组件
const ProtectedRoute = ({ children, requireSuperAdmin }: { children: React.ReactNode; requireSuperAdmin?: boolean }) => {
  const { user } = useAuthStore()
  const isSuperAdmin = user?.role === 'super_admin' || user?.positionType === '超级管理员'
  
  if (requireSuperAdmin && !isSuperAdmin) {
    return <Navigate to="/dashboard" replace />
  }
  
  return <>{children}</>
}

function App() {
  const { user } = useAuthStore()
  const isSuperAdmin = user?.role === 'super_admin' || user?.positionType === '超级管理员'
  
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        {flattenRoutes(routeDefinitions).map((route: any) => {
          // 公司管理路由需要超级管理员权限
          if (route.key === 'companies') {
            return (
              <Route
                key={route.key}
                path={route.path}
                element={
                  <ProtectedRoute requireSuperAdmin>
                    {route.element}
                  </ProtectedRoute>
                }
              />
            )
          }
          return <Route key={route.key} path={route.path} element={route.element} />
        })}
        <Route path="/statistics" element={<StatisticsPage />} />
      </Route>
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
