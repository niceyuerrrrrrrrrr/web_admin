import { Avatar, Button, Card, Layout, Menu, Space, Typography } from 'antd'
import { ArrowLeftOutlined, ArrowRightOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons'
import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { modules } from '../config/modules'
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

  const featureGroups = moduleItem.features.map(feature => ({
    title: feature.label,
    key: feature.key,
    path: feature.path,
    items: feature.children?.length ? feature.children : feature.path ? [feature] : [],
  })).filter(group => group.items.length > 0)

  const [activeGroupKey, setActiveGroupKey] = useState(featureGroups[0]?.key || '')
  const activeGroup = featureGroups.find(group => group.key === activeGroupKey) || featureGroups[0]

  const [activeSideKey, setActiveSideKey] = useState(activeGroup?.items[0]?.key || '')

  const resolvedActiveSideKey = activeGroup.items.find(item => item.key === activeSideKey)
    ? activeSideKey
    : activeGroup.items[0]?.key || ''

  const topMenuItems = featureGroups.map(group => ({
    key: group.key,
    label: group.title,
  }))

  const sideMenuItems = activeGroup.items.map(item => ({
    key: item.key,
    label: item.label,
  }))

  const financeStats = [
    { label: '本月收款', value: '¥286,000', hint: '较上月 +12.4%' },
    { label: '本月付款', value: '¥198,400', hint: '待审核 8 笔' },
    { label: '应收余额', value: '¥523,600', hint: '本周需跟进 12 笔' },
    { label: '备用金余额', value: '¥36,000', hint: '待核销 5 单' },
  ]

  const financeQuickActions = [
    { title: '收款单列表', desc: '查看本月到账与待确认收款', path: '/fin/cash-in' },
    { title: '付款单列表', desc: '集中处理付款申请与打款进度', path: '/fin/cash-out' },
    { title: '报销管理', desc: '审批报销并跟进支付状态', path: '/reimbursements' },
    { title: '备用金核销', desc: '处理备用金归还与核销记录', path: '/fin/petty-settles' },
  ]

  const financeTodoList = [
    '3 笔大额付款待复核',
    '2 笔报销待出纳支付',
    '5 单备用金待核销',
    '12 笔应收账款本周需跟进',
  ]

  const financeSections = [
    { title: '资金总览', desc: '快速查看收支、余额与账户动态。' },
    { title: '待办事项', desc: '优先处理影响结算与现金流的关键事项。' },
    { title: '快捷入口', desc: '从常用功能直接进入业务页面。' },
  ]

  const financeBaseFilters = ['全部状态', '本月', '本公司', '按最近更新排序']
  const financeToolbarActions = ['新建', '导出', '批量处理']

  const financeContentMap = useMemo(() => ({
    'fin-overview': {
      title: '财务概览',
      desc: '查看财务核心指标、待办事项与高频操作。',
      mode: 'overview',
      stats: financeStats,
      quickActions: financeQuickActions,
      todoList: financeTodoList,
      highlightTitle: '财务工作台',
      highlightDesc: '围绕收支、往来与报销处理建立一个更接近日常使用的财务工作区。',
      highlights: financeSections,
      filters: financeBaseFilters,
      columns: ['模块', '待处理', '责任人', '更新时间'],
      rows: [
        ['收款管理', '14 笔待确认', '财务一组', '今天 15:20'],
        ['付款管理', '8 笔待付款', '出纳', '今天 14:05'],
        ['报销管理', '11 单待审核', '财务经理', '今天 11:48'],
      ],
    },
    'fin-cash-in': {
      title: '收款单列表',
      desc: '关注到账确认、回款进度与异常收款。',
      mode: 'list',
      stats: [
        { label: '待确认到账', value: '14 笔', hint: '今日新增 3 笔' },
        { label: '本周回款', value: '¥126,800', hint: '重点客户 4 家' },
        { label: '逾期回款', value: '¥68,000', hint: '需重点催收' },
        { label: '自动对账率', value: '92%', hint: '较上周 +4%' },
      ],
      quickActions: [
        { title: '进入收款单列表', desc: '查看全部收款记录与状态', path: '/fin/cash-in' },
        { title: '查看应收回款', desc: '处理客户回款与销账', path: '/fin/ar-receipts' },
      ],
      todoList: ['2 笔到账待确认', '4 笔客户回款需销账', '1 笔异常回款待核对'],
      highlightTitle: '收款管理',
      highlightDesc: '聚焦客户回款、到账确认与应收销账链路。',
      highlights: [
        { title: '到账确认', desc: '快速定位今日到账与待匹配流水。' },
        { title: '客户回款', desc: '跟踪客户回款节点和异常状态。' },
        { title: '应收销账', desc: '将回款与应收账款及时关联处理。' },
      ],
      filters: ['全部收款', '待确认', '已到账', '异常流水'],
      columns: ['收款单号', '客户', '金额', '状态', '到账时间'],
      rows: [
        ['SK20260309001', '宏远物流', '¥18,600', '待确认', '今天 10:24'],
        ['SK20260309002', '川渝建材', '¥32,800', '已到账', '今天 09:12'],
        ['SK20260308017', '西南运输', '¥9,400', '异常', '昨天 17:43'],
      ],
    },
    'fin-cash-out': {
      title: '付款单列表',
      desc: '统一管理付款申请、审批进度与打款安排。',
      mode: 'list',
      stats: [
        { label: '待付款申请', value: '8 笔', hint: '其中大额 3 笔' },
        { label: '本周已付款', value: '¥84,300', hint: '供应商 9 家' },
        { label: '待复核金额', value: '¥112,000', hint: '需经理确认' },
        { label: '付款准时率', value: '96%', hint: '本月表现稳定' },
      ],
      quickActions: [
        { title: '进入付款单列表', desc: '查看付款申请与打款状态', path: '/fin/cash-out' },
        { title: '查看应付实付', desc: '跟进应付与实付记录', path: '/fin/ap-payments' },
      ],
      todoList: ['3 笔大额付款待复核', '2 笔供应商付款待安排', '1 笔付款信息待补全'],
      highlightTitle: '付款管理',
      highlightDesc: '围绕付款申请、审批、执行形成完整支付链路。',
      highlights: [
        { title: '付款审批', desc: '优先处理影响供应商结算的付款申请。' },
        { title: '支付安排', desc: '根据资金节奏安排打款优先级。' },
        { title: '应付联动', desc: '同步应付账款和实付记录。' },
      ],
      filters: ['全部付款', '待审批', '待打款', '已完成'],
      columns: ['付款单号', '收款方', '金额', '状态', '申请时间'],
      rows: [
        ['FK20260309008', '华信供应链', '¥26,000', '待打款', '今天 13:10'],
        ['FK20260309005', '渝北维修厂', '¥8,400', '待审批', '今天 09:48'],
        ['FK20260308022', '诚达贸易', '¥15,200', '已完成', '昨天 16:15'],
      ],
    },
    'fin-ar': {
      title: '应收账款',
      desc: '查看客户应收、账龄分布与催收优先级。',
      mode: 'list',
      stats: [
        { label: '应收余额', value: '¥523,600', hint: '本周新增 9 笔' },
        { label: '30天内到期', value: '¥186,000', hint: '需重点跟进 6 家客户' },
        { label: '逾期账款', value: '¥92,300', hint: '高风险 3 笔' },
        { label: '回款达成率', value: '88%', hint: '较目标差 4%' },
      ],
      quickActions: [
        { title: '进入应收账款', desc: '查看客户账款、账龄与明细', path: '/fin/ar' },
        { title: '查看应收回款', desc: '处理回款与销账联动', path: '/fin/ar-receipts' },
        { title: '客户管理', desc: '维护重点客户和结算信息', path: '/fin/customers' },
      ],
      todoList: ['3 家客户账龄超过 60 天', '2 笔应收需补充结算依据', '本周重点催收 6 笔'],
      highlightTitle: '应收管理',
      highlightDesc: '把应收余额、账龄预警和回款进度放到同一工作区统一跟进。',
      highlights: [
        { title: '账龄预警', desc: '快速定位逾期和即将到期账款。' },
        { title: '客户分层', desc: '区分重点客户与高风险客户回款状态。' },
        { title: '回款闭环', desc: '从应收到回款和销账保持同一视角处理。' },
      ],
      filters: ['全部应收', '本月到期', '逾期', '重点客户'],
      columns: ['客户', '应收金额', '账龄', '状态', '负责人'],
      rows: [
        ['宏远物流', '¥86,000', '28 天', '待回款', '李娜'],
        ['川渝建材', '¥42,300', '67 天', '已逾期', '王静'],
        ['西南运输', '¥19,800', '14 天', '正常', '赵敏'],
      ],
    },
    'fin-ar-receipts': {
      title: '应收回款',
      desc: '跟踪客户回款登记、到账确认与销账处理。',
      mode: 'list',
      stats: [
        { label: '本周回款笔数', value: '26 笔', hint: '重点客户 5 家' },
        { label: '本周回款金额', value: '¥126,800', hint: '完成率 84%' },
        { label: '待销账金额', value: '¥38,600', hint: '需财务确认' },
        { label: '异常回款', value: '3 笔', hint: '需核对来源' },
      ],
      quickActions: [
        { title: '进入应收回款', desc: '处理回款登记与到账确认', path: '/fin/ar-receipts' },
        { title: '进入应收账款', desc: '回看账款原单与账龄', path: '/fin/ar' },
      ],
      todoList: ['2 笔回款待到账确认', '1 笔客户回款来源异常', '4 笔回款待销账'],
      highlightTitle: '回款处理',
      highlightDesc: '把回款登记、确认和销账串成更顺滑的财务操作链。',
      highlights: [
        { title: '回款登记', desc: '快速录入客户回款和款项来源。' },
        { title: '到账确认', desc: '对照银行流水确认到账真实性。' },
        { title: '销账处理', desc: '把客户回款及时归集到对应应收单据。' },
      ],
      filters: ['全部回款', '待销账', '已完成', '异常'],
      columns: ['回款编号', '客户', '回款金额', '销账状态', '到账时间'],
      rows: [
        ['HK20260309011', '宏远物流', '¥12,000', '待销账', '今天 11:16'],
        ['HK20260309009', '成渝骨料', '¥18,600', '已完成', '今天 09:02'],
        ['HK20260308014', '川渝建材', '¥7,800', '异常', '昨天 18:10'],
      ],
    },
    'fin-ap': {
      title: '应付账款',
      desc: '集中查看供应商应付余额、到期计划与付款优先级。',
      mode: 'list',
      stats: [
        { label: '应付余额', value: '¥412,700', hint: '本周新增 11 笔' },
        { label: '本周到期', value: '¥138,400', hint: '供应商 7 家' },
        { label: '待审核付款', value: '¥112,000', hint: '大额 3 笔' },
        { label: '逾期未付', value: '¥46,800', hint: '需沟通 2 家供应商' },
      ],
      quickActions: [
        { title: '进入应付账款', desc: '查看供应商应付明细与账龄', path: '/fin/ap' },
        { title: '查看应付实付', desc: '核对应付与支付执行情况', path: '/fin/ap-payments' },
        { title: '供应商管理', desc: '维护供应商基础信息与结算条件', path: '/fin/suppliers' },
      ],
      todoList: ['3 笔付款已到期待安排', '2 家供应商需确认发票', '1 笔结算金额待复核'],
      highlightTitle: '应付管理',
      highlightDesc: '按到期时间、供应商优先级和现金流节奏安排付款。',
      highlights: [
        { title: '到期排序', desc: '优先查看本周和本月即将到期款项。' },
        { title: '供应商关系', desc: '兼顾账期管理和关键供应商稳定性。' },
        { title: '付款联动', desc: '从应付到付款执行保持统一状态。' },
      ],
      filters: ['全部应付', '本周到期', '已逾期', '关键供应商'],
      columns: ['供应商', '应付金额', '到期日', '状态', '经办人'],
      rows: [
        ['华信供应链', '¥56,000', '03-12', '待付款', '周婷'],
        ['诚达贸易', '¥22,400', '03-08', '已逾期', '李娜'],
        ['渝北维修厂', '¥8,900', '03-18', '正常', '王静'],
      ],
    },
    'fin-ap-payments': {
      title: '应付实付',
      desc: '核对付款执行情况，确保应付、实付与审批状态一致。',
      mode: 'list',
      stats: [
        { label: '本周实付金额', value: '¥84,300', hint: '已完成 9 笔' },
        { label: '待执行付款', value: '¥57,000', hint: '审批已通过' },
        { label: '付款偏差', value: '2 笔', hint: '金额需核对' },
        { label: '付款完成率', value: '91%', hint: '较上周 +3%' },
      ],
      quickActions: [
        { title: '进入应付实付', desc: '查看支付执行和到账状态', path: '/fin/ap-payments' },
        { title: '进入付款单列表', desc: '处理付款申请与进度', path: '/fin/cash-out' },
      ],
      todoList: ['1 笔付款金额异常', '2 笔支付状态待同步', '3 笔审批通过待出纳处理'],
      highlightTitle: '付款执行',
      highlightDesc: '让审批通过后的付款执行过程更透明、更容易追踪。',
      highlights: [
        { title: '支付执行', desc: '统一查看付款安排、执行和完成状态。' },
        { title: '状态同步', desc: '保持应付、付款单和实付记录一致。' },
        { title: '差异处理', desc: '快速发现并处理付款金额或状态异常。' },
      ],
      filters: ['全部执行', '待支付', '已完成', '金额异常'],
      columns: ['付款编号', '供应商', '实付金额', '执行状态', '完成时间'],
      rows: [
        ['ZF20260309006', '华信供应链', '¥26,000', '待支付', ''],
        ['ZF20260308013', '诚达贸易', '¥15,200', '已完成', '昨天 15:52'],
        ['ZF20260308008', '通汇服务站', '¥4,300', '异常', '昨天 10:06'],
      ],
    },
    'fin-petty-grants': {
      title: '备用金发放',
      desc: '管理备用金申请、审批和发放记录。',
      mode: 'list',
      stats: [
        { label: '本月发放金额', value: '¥58,000', hint: '共 16 笔' },
        { label: '待发放申请', value: '5 单', hint: '2 单已审批' },
        { label: '在途备用金', value: '¥36,000', hint: '需后续核销' },
        { label: '平均发放周期', value: '1.8 天', hint: '流程较稳定' },
      ],
      quickActions: [
        { title: '进入备用金发放', desc: '查看发放申请和审批状态', path: '/fin/petty-grants' },
        { title: '进入备用金核销', desc: '追踪已发放备用金后续核销', path: '/fin/petty-settles' },
      ],
      todoList: ['2 单已审批待发放', '1 单申请资料待补充', '3 单高频使用人员需复核额度'],
      highlightTitle: '备用金发放',
      highlightDesc: '围绕申请、审批、发放构建清晰的备用金发放流程。',
      highlights: [
        { title: '申请控制', desc: '核对发放对象、用途和预算范围。' },
        { title: '审批流转', desc: '让申请、审批与发放状态清晰可见。' },
        { title: '额度管理', desc: '避免重复发放和超额申请。' },
      ],
      filters: ['全部申请', '待审批', '待发放', '已发放'],
      columns: ['申请人', '申请金额', '用途', '状态', '申请时间'],
      rows: [
        ['张凯', '¥3,000', '轮胎维修', '待发放', '今天 10:20'],
        ['刘梅', '¥1,500', '行政采购', '待审批', '今天 09:05'],
        ['王涛', '¥2,200', '出差备用', '已发放', '昨天 16:41'],
      ],
    },
    'fin-petty-settles': {
      title: '备用金核销',
      desc: '核对票据、用途和余额，完成备用金闭环处理。',
      mode: 'list',
      stats: [
        { label: '待核销单数', value: '5 单', hint: '本周新增 2 单' },
        { label: '待核销金额', value: '¥21,600', hint: '需票据补齐' },
        { label: '超期未核销', value: '2 单', hint: '超过 14 天' },
        { label: '核销完成率', value: '89%', hint: '较上月 +6%' },
      ],
      quickActions: [
        { title: '进入备用金核销', desc: '查看核销进度与单据明细', path: '/fin/petty-settles' },
        { title: '进入报销管理', desc: '协同处理关联报销单据', path: '/reimbursements' },
      ],
      todoList: ['2 单超期未核销', '1 单票据缺失', '2 单金额差异待说明'],
      highlightTitle: '备用金闭环',
      highlightDesc: '从发放到核销形成闭环，重点控制票据完整性和时间节点。',
      highlights: [
        { title: '票据校验', desc: '核对票据数量、金额和业务用途是否一致。' },
        { title: '超期预警', desc: '优先处理超期未核销的备用金记录。' },
        { title: '差异说明', desc: '对金额偏差、缺票等情况形成可追踪说明。' },
      ],
      filters: ['全部核销', '待提交', '待审核', '超期'],
      columns: ['申请人', '发放金额', '核销金额', '状态', '截止时间'],
      rows: [
        ['张凯', '¥3,000', '¥2,860', '待审核', '03-10'],
        ['王涛', '¥2,200', '¥2,200', '已完成', '03-08'],
        ['刘海', '¥4,000', '¥3,100', '超期', '03-05'],
      ],
    },
    'reimbursements': {
      title: '报销管理',
      desc: '处理报销申请、审核进度、支付安排与异常说明。',
      mode: 'list',
      stats: [
        { label: '待审核报销', value: '11 单', hint: '今日新增 4 单' },
        { label: '待支付金额', value: '¥32,800', hint: '出纳待处理' },
        { label: '异常单据', value: '3 单', hint: '票据待补齐' },
        { label: '平均审核时长', value: '1.5 天', hint: '较上月缩短 0.4 天' },
      ],
      quickActions: [
        { title: '进入报销管理', desc: '查看报销单、审核与支付状态', path: '/reimbursements' },
        { title: '查看付款单列表', desc: '处理已审核报销的打款安排', path: '/fin/cash-out' },
      ],
      todoList: ['3 单报销票据待补齐', '2 单审核通过待支付', '1 单金额异常待复核'],
      highlightTitle: '报销审批',
      highlightDesc: '让报销从提交、审核到支付的过程更清晰，减少积压。',
      highlights: [
        { title: '单据审核', desc: '核对报销金额、票据与业务归属。' },
        { title: '支付安排', desc: '把已审核通过的报销尽快进入付款环节。' },
        { title: '异常处理', desc: '快速识别缺票、超标和重复报销风险。' },
      ],
      filters: ['全部报销', '待审核', '待支付', '异常单据'],
      columns: ['报销单号', '申请人', '金额', '状态', '提交时间'],
      rows: [
        ['BX20260309012', '周婷', '¥1,860', '待审核', '今天 14:22'],
        ['BX20260309008', '李娜', '¥3,240', '待支付', '今天 11:05'],
        ['BX20260308019', '张凯', '¥980', '异常', '昨天 17:36'],
      ],
    },
    'purchases': {
      title: '采购管理',
      desc: '配合采购申请、审批与付款安排，保证采购链路透明。',
      mode: 'list',
      stats: [
        { label: '待审核采购', value: '7 单', hint: '预算相关 3 单' },
        { label: '本月采购金额', value: '¥146,500', hint: '较上月 +8%' },
        { label: '待付款采购', value: '¥63,800', hint: '供应商 5 家' },
        { label: '预算偏差单', value: '2 单', hint: '需进一步说明' },
      ],
      quickActions: [
        { title: '进入采购管理', desc: '查看采购申请、审批和支付状态', path: '/purchases' },
        { title: '进入供应商管理', desc: '维护采购合作供应商资料', path: '/fin/suppliers' },
      ],
      todoList: ['2 单采购超预算待说明', '1 单供应商报价待确认', '3 单采购审批通过待付款'],
      highlightTitle: '采购协同',
      highlightDesc: '把采购申请、预算控制和付款安排放在同一视角下管理。',
      highlights: [
        { title: '预算对比', desc: '采购金额与预算偏差一目了然。' },
        { title: '审批追踪', desc: '清楚看到采购单当前审批节点。' },
        { title: '付款衔接', desc: '让已审批采购更顺畅地衔接付款流程。' },
      ],
      filters: ['全部采购', '待审批', '待付款', '超预算'],
      columns: ['采购单号', '申请部门', '金额', '状态', '提交时间'],
      rows: [
        ['CG20260309004', '车队', '¥12,600', '待审批', '今天 13:40'],
        ['CG20260308011', '行政部', '¥4,800', '待付款', '昨天 15:10'],
        ['CG20260307009', '仓储部', '¥28,000', '超预算', '03-07 10:35'],
      ],
    },
    'fin-customers': {
      title: '客户管理',
      desc: '维护客户档案、结算规则和回款协同信息。',
      mode: 'list',
      stats: [
        { label: '活跃客户', value: '86 家', hint: '本月新增 4 家' },
        { label: '重点客户', value: '12 家', hint: '应收占比 61%' },
        { label: '结算异常客户', value: '5 家', hint: '需跟进合同规则' },
        { label: '回款风险客户', value: '3 家', hint: '账龄偏长' },
      ],
      quickActions: [
        { title: '进入客户管理', desc: '查看客户档案和结算信息', path: '/fin/customers' },
        { title: '进入应收账款', desc: '查看客户对应应收余额', path: '/fin/ar' },
      ],
      todoList: ['2 家客户结算信息待补全', '1 家重点客户账期待调整', '3 家客户回款需重点跟进'],
      highlightTitle: '客户主数据',
      highlightDesc: '把客户资料、结算规则与回款表现统一维护在一个入口。',
      highlights: [
        { title: '客户档案', desc: '沉淀客户主体、联系人和合同结算方式。' },
        { title: '结算规则', desc: '统一管理账期、税率和对账要求。' },
        { title: '风险识别', desc: '提前发现账龄偏长或异常客户。' },
      ],
      filters: ['全部客户', '重点客户', '结算异常', '高风险'],
      columns: ['客户名称', '账期', '本月回款', '风险等级', '负责人'],
      rows: [
        ['宏远物流', '30 天', '¥68,000', '中', '李娜'],
        ['川渝建材', '45 天', '¥32,800', '高', '王静'],
        ['西南运输', '15 天', '¥18,400', '低', '赵敏'],
      ],
    },
    'fin-suppliers': {
      title: '供应商管理',
      desc: '维护供应商资料、账期、付款方式与合作风险。',
      mode: 'list',
      stats: [
        { label: '活跃供应商', value: '64 家', hint: '本月新增 2 家' },
        { label: '关键供应商', value: '9 家', hint: '付款占比 58%' },
        { label: '付款异常供应商', value: '4 家', hint: '历史争议需关注' },
        { label: '账期待确认', value: '6 家', hint: '需重新签署' },
      ],
      quickActions: [
        { title: '进入供应商管理', desc: '查看供应商资料和结算信息', path: '/fin/suppliers' },
        { title: '进入应付账款', desc: '查看供应商应付款项', path: '/fin/ap' },
      ],
      todoList: ['2 家供应商资料待更新', '1 家关键供应商付款争议待处理', '3 家账期待确认'],
      highlightTitle: '供应商主数据',
      highlightDesc: '让供应商资料、付款条件与风险状况保持一致和透明。',
      highlights: [
        { title: '基础档案', desc: '维护供应商身份、结算方式和合作范围。' },
        { title: '账期规则', desc: '统一账期、付款方式与票据要求。' },
        { title: '合作风险', desc: '识别争议供应商和关键供应商稳定性。' },
      ],
      filters: ['全部供应商', '关键供应商', '付款异常', '账期待确认'],
      columns: ['供应商名称', '账期', '本月付款', '风险状态', '负责人'],
      rows: [
        ['华信供应链', '30 天', '¥56,000', '正常', '周婷'],
        ['诚达贸易', '45 天', '¥22,400', '争议中', '李娜'],
        ['渝北维修厂', '15 天', '¥8,900', '正常', '王静'],
      ],
    },
    'fin-categories': {
      title: '分类设置',
      desc: '统一财务分类、费用科目和业务归集口径。',
      mode: 'list',
      stats: [
        { label: '分类项总数', value: '128 项', hint: '本月新增 6 项' },
        { label: '费用科目', value: '48 项', hint: '常用 16 项' },
        { label: '待整理分类', value: '7 项', hint: '命名需规范化' },
        { label: '使用冲突', value: '2 项', hint: '归类口径待统一' },
      ],
      quickActions: [
        { title: '进入分类设置', desc: '维护科目和业务分类规则', path: '/fin/categories' },
        { title: '进入报销管理', desc: '核对报销费用归类是否一致', path: '/reimbursements' },
      ],
      todoList: ['2 项费用分类重复', '3 项分类命名待统一', '1 项业务归属口径待确认'],
      highlightTitle: '分类规则',
      highlightDesc: '通过统一分类设置，减少报表口径不一致和归集混乱。',
      highlights: [
        { title: '科目维护', desc: '统一费用、收入和往来类目定义。' },
        { title: '口径统一', desc: '确保不同业务场景使用相同归类规则。' },
        { title: '报表支撑', desc: '为财务分析和经营报表提供稳定基础。' },
      ],
      filters: ['全部分类', '费用科目', '收入科目', '待整理'],
      columns: ['分类名称', '分类类型', '使用模块', '状态', '更新时间'],
      rows: [
        ['差旅报销', '费用科目', '报销管理', '启用', '今天 09:36'],
        ['车辆维修', '费用科目', '采购管理', '启用', '昨天 16:42'],
        ['客户回款', '收入科目', '应收回款', '待整理', '昨天 11:18'],
      ],
    },
  }), [])

  const financeContent = financeContentMap[resolvedActiveSideKey as keyof typeof financeContentMap] || financeContentMap['fin-overview']

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
              <Sider width={240} className="module-workspace-sider">
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
                    const matchedItem = activeGroup.items.find(item => item.key === key)
                    if (matchedItem?.path) {
                      if (moduleItem.key !== 'finance') {
                        navigate(matchedItem.path)
                      }
                    }
                  }}
                />
              </Sider>

              <Content className="module-workspace-main">
                <div className="module-workspace-main-head">
                  <div>
                    <Title level={3} className="module-workspace-section-title">{moduleItem.key === 'finance' ? financeContent.title : activeGroup.title}</Title>
                    <Text className="module-workspace-section-desc">{moduleItem.key === 'finance' ? financeContent.desc : `当前展示的是 ${moduleItem.name} 的工作区样板页。`}</Text>
                  </div>
                </div>

                {moduleItem.key === 'finance' ? (
                  <div className="finance-workspace">
                    <div className="finance-page-head">
                      <div>
                        <Title level={4} className="finance-page-title">{financeContent.title}</Title>
                        <Text className="finance-page-subtitle">{financeContent.desc}</Text>
                      </div>
                      <div className="finance-page-actions">
                        {financeToolbarActions.map(action => (
                          <Button key={action} className="module-home-ghost-button">{action}</Button>
                        ))}
                        <Button className="module-home-primary-button">查看完整列表</Button>
                      </div>
                    </div>

                    <div className="finance-stats-grid">
                      {financeContent.stats.map(item => (
                        <Card key={item.label} className="finance-stat-card">
                          <div className="finance-stat-label">{item.label}</div>
                          <div className="finance-stat-value">{item.value}</div>
                          <div className="finance-stat-hint">{item.hint}</div>
                        </Card>
                      ))}
                    </div>

                    <div className="finance-main-grid">
                      <Card className="finance-panel-card finance-panel-card-large">
                        <div className="finance-panel-head">
                          <div>
                            <Title level={4} className="finance-panel-title">{financeContent.highlightTitle}</Title>
                            <Text className="finance-panel-desc">{financeContent.highlightDesc}</Text>
                          </div>
                        </div>
                        <div className="finance-highlight-list">
                          {financeContent.highlights.map(section => (
                            <div key={section.title} className="finance-highlight-item">
                              <div className="finance-highlight-title">{section.title}</div>
                              <div className="finance-highlight-desc">{section.desc}</div>
                            </div>
                          ))}
                        </div>
                      </Card>

                      <Card className="finance-panel-card">
                        <div className="finance-panel-head">
                          <Title level={4} className="finance-panel-title">待办事项</Title>
                        </div>
                        <div className="finance-todo-list">
                          {financeContent.todoList.map(item => (
                            <div key={item} className="finance-todo-item">{item}</div>
                          ))}
                        </div>
                      </Card>
                    </div>

                    <Card className="finance-panel-card finance-filter-card">
                      <div className="finance-panel-head">
                        <div>
                          <Title level={5} className="finance-panel-title">筛选条件</Title>
                          <Text className="finance-panel-desc">按你现有系统的列表页结构组织筛选条件与查询入口。</Text>
                        </div>
                      </div>

                      <div className="finance-form-toolbar">
                        <div className="finance-form-field finance-form-field-wide">关键字：搜索单号 / 客户 / 供应商 / 申请人</div>
                        <div className="finance-form-field">状态：{financeContent.filters[0]}</div>
                        <div className="finance-form-field">日期：最近 30 天</div>
                        <div className="finance-form-field">范围：当前公司</div>
                        <div className="finance-form-actions">
                          <Button type="primary">查询</Button>
                          <Button>重置</Button>
                        </div>
                      </div>
                    </Card>

                    <Card className="finance-panel-card">
                      <div className="finance-panel-head finance-list-head">
                        <div>
                          <Title level={4} className="finance-panel-title">列表数据</Title>
                          <Text className="finance-panel-desc">参考现有页面的表格、筛选、批量处理与分页结构。</Text>
                        </div>
                      </div>

                      <div className="finance-filter-bar">
                        {financeContent.filters.map(item => (
                          <span key={item} className="finance-filter-chip">{item}</span>
                        ))}
                      </div>

                      <div className="finance-list-toolbar">
                        <div className="finance-toolbar-meta">
                          <span className="finance-meta-pill">共 {financeContent.rows.length} 条预览数据</span>
                          <span className="finance-meta-pill">最近更新</span>
                        </div>
                      </div>

                      <div className="finance-selection-alert">
                        已选择 2 条记录
                        <Button size="small">清空选择</Button>
                      </div>

                      <div className="finance-table-preview">
                        <div className="finance-table-row finance-table-header">
                          {financeContent.columns.map(column => (
                            <div key={column} className="finance-table-cell">{column}</div>
                          ))}
                        </div>
                        {financeContent.rows.map((row, index) => (
                          <div key={`${row[0]}-${index}`} className="finance-table-row">
                            {row.map((cell, cellIndex) => (
                              <div key={`${cell}-${cellIndex}`} className="finance-table-cell">
                                {cellIndex === 3 ? <span className="finance-status-badge">{cell || '--'}</span> : cell || '--'}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>

                      <div className="finance-table-footer">
                        <span>显示 1 - {financeContent.rows.length} 条，共 {financeContent.rows.length} 条</span>
                        <div className="finance-pagination">
                          <span className="finance-page-chip is-active">1</span>
                          <span className="finance-page-chip">2</span>
                          <span className="finance-page-chip">3</span>
                        </div>
                      </div>
                    </Card>

                    <Card className="finance-panel-card">
                      <div className="finance-panel-head">
                        <div>
                          <Title level={4} className="finance-panel-title">快捷入口</Title>
                          <Text className="finance-panel-desc">优先展示财务团队最常进入的页面。</Text>
                        </div>
                      </div>

                      <div className="module-workspace-link-grid">
                        {financeContent.quickActions.map(item => (
                          <button
                            key={item.title}
                            type="button"
                            className="module-workspace-link-card"
                            onClick={() => navigate(item.path)}
                          >
                            <div>
                              <div className="module-workspace-link-title">{item.title}</div>
                              <div className="module-workspace-link-desc">{item.desc}</div>
                            </div>
                            <ArrowRightOutlined />
                          </button>
                        ))}
                      </div>
                    </Card>
                  </div>
                ) : (
                  <div className="module-workspace-link-grid">
                    {activeGroup.items.map(item => (
                      <button
                        key={item.key}
                        type="button"
                        className="module-workspace-link-card"
                        onClick={() => item.path && navigate(item.path)}
                      >
                        <div>
                          <div className="module-workspace-link-title">{item.label}</div>
                          <div className="module-workspace-link-desc">进入 {item.label} 页面继续处理业务。</div>
                        </div>
                        <ArrowRightOutlined />
                      </button>
                    ))}
                  </div>
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
