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
  DeleteOutlined,
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
  WarningOutlined,
  WalletOutlined,
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
import ModuleHome from './pages/ModuleHome'
import ModuleWorkspace from './pages/ModuleWorkspace'
import DashboardPage from './pages/Dashboard'
import StatisticsPage from './pages/Statistics'
import ApprovalsPage from './pages/Approvals'
import ApprovalWorkflowsPage from './pages/ApprovalWorkflows'
import AttendancePage from './pages/Attendance'
import AttendanceCalendarPage from './pages/AttendanceCalendar'
import ReceiptsPage from './pages/Receipts'
import ReceiptsRecycleBin from './pages/ReceiptsRecycleBin'
import ReceiptAnalytics from './pages/ReceiptAnalytics'
import ReimbursementsPage from './pages/Reimbursements'
import ChargingStationsPage from './pages/ChargingStations'
import ChargingList from './pages/ChargingList'
import ChargingStats from './pages/ChargingStats'
import DistanceLoadingAddressesPage from './pages/DistanceLoadingAddresses'
import DistanceUnloadingAddressesPage from './pages/DistanceUnloadingAddresses'
import DistanceTableManagementPage from './pages/DistanceTableManagement'
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
import FinOverviewPage from './pages/FinOverview'
import FinAccountsPage from './pages/FinAccounts'
import FinCategoriesPage from './pages/FinCategories'
import FinSuppliersPage from './pages/FinSuppliers'
import FinCustomersPage from './pages/FinCustomers'
import FinCashInPage from './pages/FinCashIn'
import FinCashOutPage from './pages/FinCashOut'
import FinARPage from './pages/FinAR'
import FinARReceiptsPage from './pages/FinARReceipts'
import FinAPPage from './pages/FinAP'
import FinAPPaymentsPage from './pages/FinAPPayments'
import FinPettyGrantsPage from './pages/FinPettyGrants'
import FinPettySettlesPage from './pages/FinPettySettles'
import NoticesPage from './pages/Notices'
import DocumentsPage from './pages/Documents'
import SettingsPage from './pages/Settings'
import ReportBuilderPage from './pages/ReportBuilder'
import ExportCenterPage from './pages/ExportCenter'
import useAuthStore from './store/auth'
import useCompanyStore from './store/company'
import CompanySelector from './components/CompanySelector'
import AccountSwitcher from './components/AccountSwitcher'
import LoginPage from './pages/Login'
import WorkWechatCallback from './pages/WorkWechatCallback'
import NotFoundPage from './pages/NotFound'
import AttendanceConfigPage from './pages/AttendanceConfig'
import AttendanceAnomalyPage from './pages/AttendanceAnomaly'
import DriverSalaryPage from './pages/DriverSalary'
import StaffSalaryPage from './pages/StaffSalary'
import SettlementStatementPage from './pages/SettlementStatement'
import PriceConfigPage from './pages/PriceConfig'
import TireInventoryPage from './pages/TireInventory'
import TirePurchasePage from './pages/TirePurchase'
import TireSuppliersPage from './pages/TireSuppliers'
import TireMaintenancePage from './pages/TireMaintenance'
import TireSalesPage from './pages/TireSales'
import TireStatisticsPage from './pages/TireStatistics'
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
    key: 'finance-center',
    label: '财务中心',
    icon: <DollarOutlined />,
    children: [
      {
        key: 'fin-overview',
        label: '财务概览',
        path: '/fin/overview',
        element: <FinOverviewPage />,
      },
      {
        key: 'fund-management',
        label: '资金管理',
        icon: <DollarOutlined />,
        children: [
          {
            key: 'cash-in-management',
            label: '收款管理',
            children: [
              {
                key: 'fin-cash-in',
                label: '收款单列表',
                path: '/fin/cash-in',
                element: <FinCashInPage />,
              },
            ],
          },
          {
            key: 'cash-out-management',
            label: '付款管理',
            children: [
              {
                key: 'fin-cash-out',
                label: '付款单列表',
                path: '/fin/cash-out',
                element: <FinCashOutPage />,
              },
            ],
          },
          {
            key: 'account-management',
            label: '账户管理',
            children: [
              {
                key: 'fin-accounts',
                label: '账户列表',
                path: '/fin/accounts',
                element: <FinAccountsPage />,
              },
            ],
          },
        ],
      },
      {
        key: 'receivable-payable',
        label: '应收应付',
        icon: <FileTextOutlined />,
        children: [
          {
            key: 'receivable-management',
            label: '应收管理',
            children: [
              {
                key: 'fin-ar',
                label: '应收账款',
                path: '/fin/ar',
                element: <FinARPage />,
              },
              {
                key: 'fin-ar-receipts',
                label: '应收回款',
                path: '/fin/ar-receipts',
                element: <FinARReceiptsPage />,
              },
            ],
          },
          {
            key: 'payable-management',
            label: '应付管理',
            children: [
              {
                key: 'fin-ap',
                label: '应付账款',
                path: '/fin/ap',
                element: <FinAPPage />,
              },
              {
                key: 'fin-ap-payments',
                label: '应付实付',
                path: '/fin/ap-payments',
                element: <FinAPPaymentsPage />,
              },
            ],
          },
        ],
      },
      {
        key: 'fin-petty',
        label: '备用金管理',
        icon: <WalletOutlined />,
        children: [
          {
            key: 'fin-petty-grants',
            label: '备用金发放',
            path: '/fin/petty-grants',
            element: <FinPettyGrantsPage />,
          },
          {
            key: 'fin-petty-settles',
            label: '备用金核销',
            path: '/fin/petty-settles',
            element: <FinPettySettlesPage />,
          },
        ],
      },
      {
        key: 'basic-data',
        label: '基础数据',
        icon: <DatabaseOutlined />,
        children: [
          {
            key: 'fin-customers',
            label: '客户管理',
            path: '/fin/customers',
            element: <FinCustomersPage />,
          },
          {
            key: 'fin-suppliers',
            label: '供应商管理',
            path: '/fin/suppliers',
            element: <FinSuppliersPage />,
          },
          {
            key: 'fin-categories',
            label: '分类设置',
            path: '/fin/categories',
            element: <FinCategoriesPage />,
          },
        ],
      },
    ],
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
          {
            key: 'settlement-statement',
            label: '生成结算单',
            path: '/receipts/settlement-statement',
            element: <SettlementStatementPage />,
          },
          {
            key: 'price-config',
            label: '单价配置',
            path: '/receipts/price-config',
            element: <PriceConfigPage />,
          },
          {
            key: 'receipts-recycle-bin',
            label: '回收站',
            path: '/receipts/recycle-bin',
            element: <ReceiptsRecycleBin />,
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
      {
        key: 'distance-management',
        label: '运距管理',
        icon: <BranchesOutlined />,
        children: [
          {
            key: 'distance-loading-addresses',
            label: '装料地址管理',
            path: '/operations/distance/loading-addresses',
            element: <DistanceLoadingAddressesPage />,
          },
          {
            key: 'distance-unloading-addresses',
            label: '卸货地址管理',
            path: '/operations/distance/unloading-addresses',
            element: <DistanceUnloadingAddressesPage />,
          },
          {
            key: 'distance-table',
            label: '运距表管理',
            path: '/operations/distance/table',
            element: <DistanceTableManagementPage />,
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
      {
        key: 'tire-management',
        label: '轮胎管理',
        icon: <CarOutlined />,
        children: [
          {
            key: 'tire-statistics',
            label: '数据统计',
            path: '/tires/statistics',
            element: <TireStatisticsPage />,
          },
          {
            key: 'tire-inventory',
            label: '轮胎库存',
            path: '/tires/inventory',
            element: <TireInventoryPage />,
          },
          {
            key: 'tire-purchase',
            label: '轮胎采购',
            path: '/tires/purchase',
            element: <TirePurchasePage />,
          },
          {
            key: 'tire-sales',
            label: '轮胎销售',
            path: '/tires/sales',
            element: <TireSalesPage />,
          },
          {
            key: 'tire-maintenance',
            label: '维护管理',
            path: '/tires/maintenance',
            element: <TireMaintenancePage />,
          },
          {
            key: 'tire-suppliers',
            label: '供应商管理',
            path: '/tires/suppliers',
            element: <TireSuppliersPage />,
          },
        ],
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
        icon: <ClockCircleOutlined />,
        children: [
          {
            key: 'attendance-records',
            label: '考勤明细',
            path: '/attendance',
            element: <AttendancePage />,
          },
          {
            key: 'attendance-calendar',
            label: '考勤日历',
            path: '/attendance-calendar',
            element: <AttendanceCalendarPage />,
          },
          {
            key: 'attendance-config',
            label: '考勤配置',
            path: '/attendance-config',
            element: <AttendanceConfigPage />,
          },
          {
            key: 'attendance-anomaly',
            label: '考勤异常监控',
            path: '/attendance-anomaly',
            element: <AttendanceAnomalyPage />,
          },
        ],
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
        label: '司机工资',
        path: '/salary',
        icon: <DollarOutlined />,
        element: <DriverSalaryPage />,
      },
      {
        key: 'staff-salary',
        label: '行政/车队长工资',
        path: '/staff-salary',
        icon: <DollarOutlined />,
        element: <StaffSalaryPage />,
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
  const { user } = useAuthStore()
  const { selectedCompanyId, setSelectedCompanyId } = useCompanyStore()

  const isSuperAdmin = user?.role === 'super_admin'

  if (isSuperAdmin) {
    return (
      <CompanySelector
        value={selectedCompanyId}
        onChange={setSelectedCompanyId}
        style={{ minWidth: 180 }}
      />
    )
  }

  return <AccountSwitcher style={{ minWidth: 240 }} />
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
  const { user, logout, token } = useAuthStore()
  const {
    token: { colorBgContainer },
  } = theme.useToken()

  const configQuery = useQuery({
    queryKey: ['system-config-layout'],
    queryFn: fetchSystemConfig,
    staleTime: 5 * 60 * 1000,
    retry: false,
    enabled: !!token,
  })
  const config = configQuery.data?.base

  // 认证守卫：未登录立即跳转到登录页
  if (!token || !user) {
    return <Navigate to="/login" replace />
  }

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

  // 判断是否是司机
  const isDriver = user?.positionType === '司机'

  const menuItems = useMemo(() => {
    const generateMenuItems = (routes: any[]): MenuProps['items'] => {
      const items: any[] = []
      
      for (const item of routes) {
        // 过滤掉公司管理菜单项（非超级管理员）
        if (item.key === 'companies' && !isSuperAdmin) {
          continue
        }
        
        // 过滤掉工资管理菜单项（司机不可见）
        if (item.key === 'salary' && isDriver) {
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
    
    return generateMenuItems(routeDefinitions)
  }, [isSuperAdmin, isDriver])

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
      {/* 模块主页 - 独立布局，不显示侧边栏 */}
      <Route path="/" element={<ModuleHome />} />
      <Route path="/modules/:key" element={<ModuleWorkspace />} />
      
      {/* 其他页面 - 使用带侧边栏的标准布局 */}
      <Route element={<AppLayout />}>
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
      <Route path="/work-wechat-callback" element={<WorkWechatCallback />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
