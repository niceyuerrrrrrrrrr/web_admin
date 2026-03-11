import { Avatar, Button, Card, Empty, Layout, Menu, Space, Typography } from 'antd'
import { ArrowLeftOutlined, LogoutOutlined, MenuFoldOutlined, MenuUnfoldOutlined, UserOutlined } from '@ant-design/icons'
import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { modules } from '../config/modules'
import DashboardPage from './Dashboard'
import ApprovalsPage from './Approvals'
import ApprovalWorkflowsPage from './ApprovalWorkflows'
import AttendancePage from './Attendance'
import AttendanceCalendarPage from './AttendanceCalendar'
import AttendanceConfigPage from './AttendanceConfig'
import AttendanceAnomalyPage from './AttendanceAnomaly'
import ReceiptsPage from './Receipts'
import ReceiptsRecycleBin from './ReceiptsRecycleBin'
import ReceiptAnalytics from './ReceiptAnalytics'
import ChargingStationsPage from './ChargingStations'
import ChargingList from './ChargingList'
import ChargingStats from './ChargingStats'
import DistanceLoadingAddressesPage from './DistanceLoadingAddresses'
import DistanceUnloadingAddressesPage from './DistanceUnloadingAddresses'
import DistanceTableManagementPage from './DistanceTableManagement'
import InventoryPage from './Inventory'
import MaterialRequestsPage from './MaterialRequests'
import MaterialPricingPage from './MaterialPricing'
import VehiclesPage from './Vehicles'
import VehicleUsageCalendarPage from './VehicleUsageCalendar'
import UsersPage from './Users'
import RolesPage from './Roles'
import PermissionsPage from './Permissions'
import CompaniesPage from './Companies'
import DepartmentsPage from './Departments'
import HRPage from './HR'
import LeavePage from './Leave'
import ReportsPage from './Reports'
import SettlementStatementPage from './SettlementStatement'
import PriceConfigPage from './PriceConfig'
import DriverSalaryPage from './DriverSalary'
import StaffSalaryPage from './StaffSalary'
import TireInventoryPage from './TireInventory'
import TirePurchasePage from './TirePurchase'
import TireSuppliersPage from './TireSuppliers'
import TireMaintenancePage from './TireMaintenance'
import TireSalesPage from './TireSales'
import TireStatisticsPage from './TireStatistics'
import NoticesPage from './Notices'
import DocumentsPage from './Documents'
import SettingsPage from './Settings'
import ReportBuilderPage from './ReportBuilder'
import ExportCenterPage from './ExportCenter'
import FinOverviewPage from './FinOverview'
import FinCashInPage from './FinCashIn'
import FinCashOutPage from './FinCashOut'
import FinAccountsPage from './FinAccounts'
import FinARPage from './FinAR'
import FinARReceiptsPage from './FinARReceipts'
import FinAPPage from './FinAP'
import FinAPPaymentsPage from './FinAPPayments'
import FinPettyGrantsPage from './FinPettyGrants'
import FinPettySettlesPage from './FinPettySettles'
import ReimbursementsPage from './Reimbursements'
import PurchasesPage from './Purchases'
import FinCustomersPage from './FinCustomers'
import FinSuppliersPage from './FinSuppliers'
import FinCategoriesPage from './FinCategories'
import useAuthStore from '../store/auth'
import useCompanyStore from '../store/company'
import CompanySelector from '../components/CompanySelector'
import AccountSwitcher from '../components/AccountSwitcher'
import './ModuleWorkspace.css'

const { Header, Content, Sider } = Layout
const { Title, Text } = Typography

const ModuleWorkspace = () => {
  const navigate = useNavigate()
  const { key } = useParams()
  const { user, logout } = useAuthStore()
  const { selectedCompanyId, setSelectedCompanyId } = useCompanyStore()

  const moduleItem = modules.find(item => item.key === key)
  const isSuperAdmin = user?.role === 'super_admin'

  if (!moduleItem) {
    return <Navigate to="/" replace />
  }

  if (moduleItem.requireAdmin && !isSuperAdmin) {
    return <Navigate to="/" replace />
  }

  const featureGroups = moduleItem.features
    .map(feature => ({
      title: feature.label,
      key: feature.key,
      items: feature.children?.length ? feature.children : feature.path ? [feature] : [],
    }))
    .filter(group => group.items.length > 0)

  const [activeGroupKey, setActiveGroupKey] = useState(featureGroups[0]?.key || '')
  const activeGroup = featureGroups.find(group => group.key === activeGroupKey) || featureGroups[0]

  const [activeSideKey, setActiveSideKey] = useState(activeGroup?.items[0]?.key || '')
  const [isSiderCollapsed, setIsSiderCollapsed] = useState(false)
  const resolvedActiveSideKey = activeGroup.items.find(item => item.key === activeSideKey)
    ? activeSideKey
    : activeGroup.items[0]?.key || ''

  const topMenuItems = featureGroups.map(group => ({ key: group.key, label: group.title }))
  const sideMenuItems = activeGroup.items.map(item => ({ key: item.key, label: item.label }))

  const embeddedPageMap = useMemo(
    () => ({
      finance: {
        'fin-overview': <FinOverviewPage />,
        'fin-cash-in': <FinCashInPage />,
        'fin-cash-out': <FinCashOutPage />,
        'fin-accounts': <FinAccountsPage />,
        'fin-ar': <FinARPage />,
        'fin-ar-receipts': <FinARReceiptsPage />,
        'fin-ap': <FinAPPage />,
        'fin-ap-payments': <FinAPPaymentsPage />,
        'fin-petty-grants': <FinPettyGrantsPage />,
        'fin-petty-settles': <FinPettySettlesPage />,
        reimbursements: <ReimbursementsPage />,
        purchases: <PurchasesPage />,
        'fin-customers': <FinCustomersPage />,
        'fin-suppliers': <FinSuppliersPage />,
        'fin-categories': <FinCategoriesPage />,
      },
      operations: {
        'receipt-list': <ReceiptsPage />,
        'receipt-analytics': <ReceiptAnalytics />,
        'settlement-statement': <SettlementStatementPage />,
        'price-config': <PriceConfigPage />,
        'receipts-recycle-bin': <ReceiptsRecycleBin />,
        'vehicles-list': <VehiclesPage />,
        'vehicle-usage-calendar': <VehicleUsageCalendarPage />,
        'charging-list': <ChargingList />,
        'charging-stats': <ChargingStats />,
        'charging-stations': <ChargingStationsPage />,
        'distance-loading-addresses': <DistanceLoadingAddressesPage />,
        'distance-unloading-addresses': <DistanceUnloadingAddressesPage />,
        'distance-table': <DistanceTableManagementPage />,
      },
      hr: {
        hr: <HRPage />,
        departments: <DepartmentsPage />,
        'attendance-records': <AttendancePage />,
        'attendance-calendar': <AttendanceCalendarPage />,
        'attendance-config': <AttendanceConfigPage />,
        'attendance-anomaly': <AttendanceAnomalyPage />,
        'driver-salary': <DriverSalaryPage />,
        'staff-salary': <StaffSalaryPage />,
        leave: <LeavePage />,
        notices: <NoticesPage />,
        documents: <DocumentsPage />,
      },
      materials: {
        'inventory-list': <InventoryPage />,
        'material-pricing': <MaterialPricingPage />,
        'tire-statistics': <TireStatisticsPage />,
        'tire-inventory': <TireInventoryPage />,
        'tire-purchase': <TirePurchasePage />,
        'tire-sales': <TireSalesPage />,
        'tire-maintenance': <TireMaintenancePage />,
        'tire-suppliers': <TireSuppliersPage />,
        'material-requests': <MaterialRequestsPage />,
        reports: <ReportsPage />,
      },
      approval: {
        approvals: <ApprovalsPage />,
        'approval-workflows': <ApprovalWorkflowsPage />,
      },
      data: {
        'data-overview': <DashboardPage />,
        'custom-reports': <ReportBuilderPage />,
        'export-center': <ExportCenterPage />,
      },
      system: {
        companies: <CompaniesPage />,
        departments: <DepartmentsPage />,
        users: <UsersPage />,
        roles: <RolesPage />,
        permissions: <PermissionsPage />,
        settings: <SettingsPage />,
      },
    }),
    [],
  )
  const activeLeafItem = activeGroup.items.find(item => item.key === resolvedActiveSideKey)
  const sectionTitle = activeLeafItem?.label || activeGroup.title
  const sectionDesc = activeLeafItem?.path
    ? '当前页面沿用原系统的真实页面内容、内部设置与业务逻辑。'
    : `请选择左侧菜单进入 ${moduleItem.name} 的具体业务页面。`
  const modulePageMap = embeddedPageMap[moduleItem.key as keyof typeof embeddedPageMap]
  const embeddedPage = modulePageMap?.[resolvedActiveSideKey as keyof typeof modulePageMap]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header className="module-workspace-header">
        <div className="module-workspace-header-left">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            className="module-workspace-back"
            onClick={() => navigate('/')}
          >
            返回首页
          </Button>
          <div className="module-workspace-brand-wrap">
            <div className="module-home-logo">L</div>
            <div>
              <div className="module-home-brand">物流数字化运营中心</div>
              <div className="module-home-subtitle">{moduleItem.name}</div>
            </div>
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

      <Content className="module-workspace-page">
        <div className="module-workspace-shell">
          <Card className="module-workspace-panel">
            <div className="module-workspace-topnav">
              {topMenuItems.map(item => (
                <button
                  key={item.key}
                  type="button"
                  className={`module-top-tab ${item.key === activeGroup.key ? 'is-active' : ''}`}
                  onClick={() => {
                    setActiveGroupKey(item.key)
                    const matchedGroup = featureGroups.find(group => group.key === item.key)
                    if (matchedGroup?.items[0]?.key) {
                      setActiveSideKey(matchedGroup.items[0].key)
                    }
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <Layout className="module-workspace-content-layout">
              <Sider
                width={240}
                collapsedWidth={0}
                collapsible
                trigger={null}
                collapsed={isSiderCollapsed}
                className="module-workspace-sider"
              >
                <div className="module-workspace-sider-head">
                  <Title level={5} className="module-workspace-sider-title">{activeGroup.title}</Title>
                  <Text className="module-workspace-sider-desc">选择左侧功能进入实际页面</Text>
                </div>
                <Menu
                  mode="inline"
                  selectedKeys={resolvedActiveSideKey ? [resolvedActiveSideKey] : []}
                  items={sideMenuItems}
                  className="module-workspace-menu"
                  onClick={({ key }) => {
                    setActiveSideKey(key)
                  }}
                />
              </Sider>

              <Content className="module-workspace-main">
                <div className="module-workspace-main-head">
                  <Button
                    type="text"
                    className="module-workspace-sider-toggle"
                    icon={isSiderCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                    onClick={() => setIsSiderCollapsed(prev => !prev)}
                  >
                    {isSiderCollapsed ? '展开菜单' : '收起菜单'}
                  </Button>
                  <div>
                    <Title level={3} className="module-workspace-section-title">{sectionTitle}</Title>
                    <Text className="module-workspace-section-desc">{sectionDesc}</Text>
                  </div>
                </div>

                {embeddedPage ? (
                  <div className="finance-embedded-page">{embeddedPage}</div>
                ) : (
                  <Card className="module-workspace-card">
                    <Empty
                      description={
                        <span>
                          当前菜单尚未映射到具体页面，请在左侧继续选择，或联系开发补齐页面映射。
                        </span>
                      }
                    />
                  </Card>
                )}
              </Content>
            </Layout>
          </Card>
        </div>
      </Content>
    </Layout>
  )
}

export default ModuleWorkspace
