import {
  DollarOutlined,
  RocketOutlined,
  SolutionOutlined,
  ShopOutlined,
  CheckSquareOutlined,
  BarChartOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import type { ReactNode } from 'react'

export interface ModuleFeature {
  key: string
  label: string
  path: string
  icon?: ReactNode
  children?: ModuleFeature[]
}

export interface Module {
  key: string
  name: string
  icon: ReactNode
  summary: string
  description: string[]
  color: string
  path: string
  features: ModuleFeature[]
  requireAdmin?: boolean
}

export const modules: Module[] = [
  {
    key: 'finance',
    name: '财务中心',
    icon: <DollarOutlined />,
    summary: '统一处理收支、报销、往来账与资金流转。',
    description: ['收付款管理', '应收应付', '报销审批', '备用金'],
    color: '#1890ff',
    path: '/modules/finance',
    features: [
      {
        key: 'fin-overview',
        label: '财务概览',
        path: '/modules/finance/overview',
      },
      {
        key: 'fund-management',
        label: '资金管理',
        path: '',
        children: [
          {
            key: 'fin-cash-in',
            label: '收款单列表',
            path: '/fin/cash-in',
          },
          {
            key: 'fin-cash-out',
            label: '付款单列表',
            path: '/fin/cash-out',
          },
          {
            key: 'fin-accounts',
            label: '账户列表',
            path: '/fin/accounts',
          },
        ],
      },
      {
        key: 'receivable-payable',
        label: '应收应付',
        path: '',
        children: [
          {
            key: 'fin-ar',
            label: '应收账款',
            path: '/fin/ar',
          },
          {
            key: 'fin-ar-receipts',
            label: '应收回款',
            path: '/fin/ar-receipts',
          },
          {
            key: 'fin-ap',
            label: '应付账款',
            path: '/fin/ap',
          },
          {
            key: 'fin-ap-payments',
            label: '应付实付',
            path: '/fin/ap-payments',
          },
        ],
      },
      {
        key: 'fin-petty',
        label: '备用金管理',
        path: '',
        children: [
          {
            key: 'fin-petty-grants',
            label: '备用金发放',
            path: '/fin/petty-grants',
          },
          {
            key: 'fin-petty-settles',
            label: '备用金核销',
            path: '/fin/petty-settles',
          },
        ],
      },
      {
        key: 'fin-approval',
        label: '审批管理',
        path: '',
        children: [
          {
            key: 'reimbursements',
            label: '报销管理',
            path: '/reimbursements',
          },
          {
            key: 'purchases',
            label: '采购管理',
            path: '/purchases',
          },
        ],
      },
      {
        key: 'fin-basic',
        label: '基础数据',
        path: '',
        children: [
          {
            key: 'fin-customers',
            label: '客户管理',
            path: '/fin/customers',
          },
          {
            key: 'fin-suppliers',
            label: '供应商管理',
            path: '/fin/suppliers',
          },
          {
            key: 'fin-categories',
            label: '分类设置',
            path: '/fin/categories',
          },
        ],
      },
    ],
  },
  {
    key: 'operations',
    name: '运营中心',
    icon: <RocketOutlined />,
    summary: '集中管理票据、车辆、充电与运距执行业务。',
    description: ['票据管理', '车辆管理', '充电管理', '运距管理'],
    color: '#52c41a',
    path: '/modules/operations',
    features: [
      {
        key: 'ops-overview',
        label: '运营概览',
        path: '/modules/operations/overview',
      },
      {
        key: 'receipts',
        label: '票据管理',
        path: '',
        children: [
          {
            key: 'receipt-list',
            label: '票据列表',
            path: '/receipts/list',
          },
          {
            key: 'receipt-analytics',
            label: '票据分析',
            path: '/receipts/analytics',
          },
          {
            key: 'settlement-statement',
            label: '生成结算单',
            path: '/receipts/settlement-statement',
          },
          {
            key: 'price-config',
            label: '单价配置',
            path: '/receipts/price-config',
          },
          {
            key: 'receipts-recycle-bin',
            label: '回收站',
            path: '/receipts/recycle-bin',
          },
        ],
      },
      {
        key: 'vehicles',
        label: '车辆管理',
        path: '',
        children: [
          {
            key: 'vehicles-list',
            label: '车辆列表',
            path: '/vehicles',
          },
          {
            key: 'vehicle-usage-calendar',
            label: '使用日历',
            path: '/vehicles/usage-calendar',
          },
        ],
      },
      {
        key: 'charging',
        label: '充电管理',
        path: '',
        children: [
          {
            key: 'charging-list',
            label: '充电单列表',
            path: '/charging/list',
          },
          {
            key: 'charging-stats',
            label: '数据分析',
            path: '/charging/stats',
          },
          {
            key: 'charging-stations',
            label: '充电站管理',
            path: '/charging/stations',
          },
        ],
      },
      {
        key: 'distance-management',
        label: '运距管理',
        path: '',
        children: [
          {
            key: 'distance-loading-addresses',
            label: '装料地址管理',
            path: '/operations/distance/loading-addresses',
          },
          {
            key: 'distance-unloading-addresses',
            label: '卸货地址管理',
            path: '/operations/distance/unloading-addresses',
          },
          {
            key: 'distance-table',
            label: '运距表管理',
            path: '/operations/distance/table',
          },
        ],
      },
    ],
  },
  {
    key: 'hr',
    name: '人事中心',
    icon: <SolutionOutlined />,
    summary: '覆盖员工、考勤、薪资与请假等人事事务。',
    description: ['员工管理', '考勤管理', '薪资管理', '请假审批'],
    color: '#722ed1',
    path: '/modules/hr',
    features: [
      {
        key: 'hr-overview',
        label: '人事概览',
        path: '/modules/hr/overview',
      },
      {
        key: 'employee-management',
        label: '员工管理',
        path: '',
        children: [
          {
            key: 'hr',
            label: '人事档案',
            path: '/hr',
          },
          {
            key: 'departments',
            label: '部门管理',
            path: '/departments',
          },
        ],
      },
      {
        key: 'attendance',
        label: '考勤管理',
        path: '',
        children: [
          {
            key: 'attendance-records',
            label: '考勤明细',
            path: '/attendance',
          },
          {
            key: 'attendance-calendar',
            label: '考勤日历',
            path: '/attendance-calendar',
          },
          {
            key: 'attendance-config',
            label: '考勤配置',
            path: '/attendance-config',
          },
          {
            key: 'attendance-anomaly',
            label: '考勤异常监控',
            path: '/attendance-anomaly',
          },
        ],
      },
      {
        key: 'salary',
        label: '薪资管理',
        path: '',
        children: [
          {
            key: 'driver-salary',
            label: '司机工资',
            path: '/salary',
          },
          {
            key: 'staff-salary',
            label: '行政/车队长工资',
            path: '/staff-salary',
          },
        ],
      },
      {
        key: 'leave',
        label: '请假管理',
        path: '/leave',
      },
      {
        key: 'administration',
        label: '行政事务',
        path: '',
        children: [
          {
            key: 'notices',
            label: '公告管理',
            path: '/notices',
          },
          {
            key: 'documents',
            label: '文档管理',
            path: '/documents',
          },
        ],
      },
    ],
  },
  {
    key: 'materials',
    name: '物资中心',
    icon: <ShopOutlined />,
    summary: '管理库存、轮胎、领用与故障上报等物资事项。',
    description: ['库存管理', '轮胎管理', '物品领用', '故障上报'],
    color: '#fa8c16',
    path: '/modules/materials',
    features: [
      {
        key: 'materials-overview',
        label: '物资概览',
        path: '/modules/materials/overview',
      },
      {
        key: 'inventory',
        label: '库存管理',
        path: '',
        children: [
          {
            key: 'inventory-list',
            label: '库存列表',
            path: '/inventory',
          },
          {
            key: 'material-pricing',
            label: '材料定价',
            path: '/material-pricing',
          },
        ],
      },
      {
        key: 'tire-management',
        label: '轮胎管理',
        path: '',
        children: [
          {
            key: 'tire-statistics',
            label: '数据统计',
            path: '/tires/statistics',
          },
          {
            key: 'tire-inventory',
            label: '轮胎库存',
            path: '/tires/inventory',
          },
          {
            key: 'tire-purchase',
            label: '轮胎采购',
            path: '/tires/purchase',
          },
          {
            key: 'tire-sales',
            label: '轮胎销售',
            path: '/tires/sales',
          },
          {
            key: 'tire-maintenance',
            label: '维护管理',
            path: '/tires/maintenance',
          },
          {
            key: 'tire-suppliers',
            label: '供应商管理',
            path: '/tires/suppliers',
          },
        ],
      },
      {
        key: 'material-requests',
        label: '物品领用',
        path: '/material-requests',
      },
      {
        key: 'reports',
        label: '故障上报',
        path: '/reports',
      },
    ],
  },
  {
    key: 'approval',
    name: '审批中心',
    icon: <CheckSquareOutlined />,
    summary: '统一查看申请、审批进度与流程配置。',
    description: ['我的申请', '待我审批', '已审批', '流程配置'],
    color: '#eb2f96',
    path: '/modules/approval',
    features: [
      {
        key: 'approval-overview',
        label: '审批概览',
        path: '/modules/approval/overview',
      },
      {
        key: 'approvals',
        label: '审批列表',
        path: '/approvals',
      },
      {
        key: 'workflow-management',
        label: '流程管理',
        path: '',
        children: [
          {
            key: 'approval-workflows',
            label: '审批流程配置',
            path: '/approval-workflows',
          },
        ],
      },
    ],
  },
  {
    key: 'data',
    name: '数据中心',
    icon: <BarChartOutlined />,
    summary: '聚合报表、导出与分析能力，支撑经营决策。',
    description: ['数据报表', '自定义报表', '数据导出', '数据分析'],
    color: '#13c2c2',
    path: '/modules/data',
    features: [
      {
        key: 'data-overview',
        label: '数据总览',
        path: '/dashboard',
      },
      {
        key: 'custom-reports',
        label: '自定义报表',
        path: '/custom-reports',
      },
      {
        key: 'export-center',
        label: '数据导出',
        path: '/export-center',
      },
    ],
  },
  {
    key: 'system',
    name: '系统管理',
    icon: <SettingOutlined />,
    summary: '维护组织、权限与系统级配置。',
    description: ['用户管理', '角色权限', '公司部门', '系统配置'],
    color: '#8c8c8c',
    path: '/modules/system',
    requireAdmin: true,
    features: [
      {
        key: 'organization',
        label: '组织架构',
        path: '',
        children: [
          {
            key: 'companies',
            label: '公司管理',
            path: '/companies',
          },
          {
            key: 'departments',
            label: '部门管理',
            path: '/departments',
          },
        ],
      },
      {
        key: 'user-permissions',
        label: '用户权限',
        path: '',
        children: [
          {
            key: 'users',
            label: '用户管理',
            path: '/users',
          },
          {
            key: 'roles',
            label: '角色管理',
            path: '/roles',
          },
          {
            key: 'permissions',
            label: '权限管理',
            path: '/permissions',
          },
        ],
      },
      {
        key: 'settings',
        label: '系统配置',
        path: '/settings',
      },
    ],
  },
]
