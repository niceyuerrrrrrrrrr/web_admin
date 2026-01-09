import { useCallback, useMemo, useState } from 'react'
import {
  App as AntdApp,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Drawer,
  Flex,
  Form,
  Image,
  Input,
  InputNumber,
  Space,
  Table,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { DownloadOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons'
import * as XLSX from 'xlsx'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchReceipts, updateChargingReceipt } from '../api/services/receipts'
import type { Receipt } from '../api/types'
import useAuthStore from '../store/auth'
import useCompanyStore from '../store/company'
import ColumnSettings from '../components/ColumnSettings'
import type { ColumnConfig } from '../components/ColumnSettings'

const { RangePicker } = DatePicker

const ChargingList = () => {
  const queryClient = useQueryClient()
  const { message } = AntdApp.useApp()
  const { user } = useAuthStore()
  const { selectedCompanyId } = useCompanyStore()

  const isSuperAdmin = user?.role === 'super_admin' || user?.positionType === '超级管理员'
  const effectiveCompanyId = isSuperAdmin ? selectedCompanyId : undefined

  const [filters, setFilters] = useState<{
    startDate?: string
    endDate?: string
    vehicleNo?: string
  }>({})
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null)
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)
  const [editDrawerOpen, setEditDrawerOpen] = useState(false)
  const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null)
  const [editForm] = Form.useForm()

  const receiptsQuery = useQuery<{
    receipts: Receipt[]
    statistics: {
      total_count: number
      deleted_count: number
      normal_count: number
      submitted_count: number
      not_submitted_count: number
    }
  }>({
    queryKey: ['receipts', 'charging', filters, effectiveCompanyId],
    queryFn: () =>
      fetchReceipts({
        receiptType: 'charging',
        startDate: filters.startDate,
        endDate: filters.endDate,
        companyId: effectiveCompanyId,
        vehicleNo: filters.vehicleNo,
      }),
    enabled: !isSuperAdmin || !!effectiveCompanyId,
  })

  const receipts = receiptsQuery.data?.receipts || []

  const handleExport = useCallback(() => {
    if (!receipts.length) {
      message.warning('没有数据可导出')
      return
    }

    const exportData = receipts.map((r: any) => ({
      '单据编号': r.receipt_number || '',
      '车牌号': r.vehicle_no || '',
      '充电站': r.charging_station || '',
      '充电桩': r.charging_pile || '',
      '电量(kWh)': r.energy_kwh || 0,
      '金额(元)': r.amount || 0,
      '开始充电时间': r.start_time ? dayjs(r.start_time).format('YYYY-MM-DD HH:mm') : '',
      '结束充电时间': r.end_time ? dayjs(r.end_time).format('YYYY-MM-DD HH:mm') : '',
      '充电时长(分钟)': r.duration_min || '',
      '创建时间': r.created_at ? dayjs(r.created_at).format('YYYY-MM-DD HH:mm') : '',
    }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '充电单数据')

    const fileName = `充电单数据_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`
    XLSX.writeFile(wb, fileName)
    message.success('导出成功')
  }, [receipts, message])

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateChargingReceipt(id, data),
    onSuccess: () => {
      message.success('更新成功')
      setEditDrawerOpen(false)
      setEditingReceipt(null)
      editForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
    },
    onError: (error) => {
      message.error((error as Error).message || '更新失败')
    },
  })

  const handleSearch = (values: any) => {
    setFilters({
      startDate: values.dateRange?.[0]?.format('YYYY-MM-DD'),
      endDate: values.dateRange?.[1]?.format('YYYY-MM-DD'),
      vehicleNo: values.vehicleNo,
    })
  }

  const handleReset = () => {
    setFilters({})
  }

  const openDetail = (record: Receipt) => {
    setSelectedReceipt(record)
    setDetailDrawerOpen(true)
  }

  const openEdit = (record: Receipt) => {
    setEditingReceipt(record)
    setEditDrawerOpen(true)
    const r = record as any
    editForm.setFieldsValue({
      receipt_number: r.receipt_number,
      vehicle_no: r.vehicle_no,
      charging_station: r.charging_station,
      charging_pile: r.charging_pile,
      energy_kwh: r.energy_kwh,
      amount: r.amount,
      start_time: r.start_time ? dayjs(r.start_time) : undefined,
      end_time: r.end_time ? dayjs(r.end_time) : undefined,
      duration_min: r.duration_min,
    })
  }

  // 列配置状态
  const [columnConfig, setColumnConfig] = useState<ColumnConfig[]>([])

  const originalColumns: ColumnsType<Receipt> = useMemo(() => [
      { title: '单据编号', dataIndex: 'receipt_number', key: 'receipt_number', width: 150 },
      { title: '车牌号', dataIndex: 'vehicle_no', key: 'vehicle_no', width: 120 },
      { title: '充电站', dataIndex: 'charging_station', key: 'charging_station', width: 150 },
      { title: '充电桩', dataIndex: 'charging_pile', key: 'charging_pile', width: 120 },
      { title: '电量(kWh)', dataIndex: 'energy_kwh', key: 'energy_kwh', width: 120, render: (v) => v?.toFixed(2) || '-' },
      { title: '金额(元)', dataIndex: 'amount', key: 'amount', width: 120, render: (v) => v?.toFixed(2) || '-' },
      { title: '开始充电时间', dataIndex: 'start_time', key: 'start_time', width: 180, render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-' },
      { title: '结束充电时间', dataIndex: 'end_time', key: 'end_time', width: 180, render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-' },
      { title: '充电时长(分钟)', dataIndex: 'duration_min', key: 'duration_min', width: 120, render: (v) => v || '-' },
      {
        title: '充电单图片',
        dataIndex: 'thumb_url',
        key: 'thumb_url',
        width: 100,
        render: (value: string) => {
          if (!value || value.startsWith('wxfile://') || value.startsWith('file://')) {
            return '-'
          }
          return (
            <Image
              src={value}
              width={60}
              height={60}
              style={{ objectFit: 'cover', borderRadius: 4 }}
              fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
              preview={{
                mask: '查看',
              }}
            />
          )
        },
      },
      {
        title: '操作',
        key: 'action',
        width: 150,
        fixed: 'right',
        render: (_, record) => (
          <Space size="small">
            <Button type="link" icon={<EyeOutlined />} onClick={() => openDetail(record)}>查看</Button>
            <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(record)}>编辑</Button>
          </Space>
        ),
      },
  ], [])

  // 生成列配置
  const columnSettingsConfig = useMemo(() => {
    return originalColumns.map((col) => ({
      key: String((col as any).dataIndex || (col as any).key || col.title || ''),
      title: String(col.title || ''),
      visible: true,
      fixed: col.fixed,
    }))
  }, [originalColumns])

  // 列配置变更处理
  const handleColumnConfigChange = useCallback((config: ColumnConfig[]) => {
    setColumnConfig(config)
  }, [])

  // 应用列配置后的列
  const columns = useMemo(() => {
    if (!columnConfig.length) return originalColumns

    const orderedColumns: ColumnsType<Receipt> = []
    
    for (const cfg of columnConfig) {
      if (!cfg.visible) continue
      const col = originalColumns.find((c) => {
        const key = String((c as any).dataIndex || (c as any).key || c.title || '')
        return key === cfg.key
      })
      if (col) {
        orderedColumns.push(col)
      }
    }

    for (const col of originalColumns) {
      const key = String((col as any).dataIndex || (col as any).key || col.title || '')
      if (!columnConfig.find((c) => c.key === key)) {
        orderedColumns.push(col)
      }
    }

    return orderedColumns
  }, [originalColumns, columnConfig])

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <Form layout="inline" onFinish={handleSearch} onReset={handleReset}>
          <Form.Item name="vehicleNo" label="车牌号">
            <Input placeholder="请输入车牌号" allowClear />
          </Form.Item>
          <Form.Item name="dateRange" label="日期范围">
            <RangePicker />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">查询</Button>
              <Button htmlType="reset">重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
      <Card>
        <Flex justify="flex-end" gap={8} style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport}>
            导出
          </Button>
          <ColumnSettings
            storageKey="charging-list-columns"
            defaultColumns={columnSettingsConfig}
            onColumnsChange={handleColumnConfigChange}
          />
        </Flex>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={receipts}
          loading={receiptsQuery.isLoading}
          scroll={{ x: 1600 }}
          pagination={{ pageSize: 20 }}
        />
      </Card>
      
      <Drawer title="充电单详情" open={detailDrawerOpen} onClose={() => setDetailDrawerOpen(false)} width={500}>
         {selectedReceipt && (
             <Descriptions column={1} bordered>
                 <Descriptions.Item label="单据编号">{(selectedReceipt as any).receipt_number}</Descriptions.Item>
                 <Descriptions.Item label="车牌号">{selectedReceipt.vehicle_no}</Descriptions.Item>
                 <Descriptions.Item label="充电站">{(selectedReceipt as any).charging_station}</Descriptions.Item>
                 <Descriptions.Item label="充电桩">{(selectedReceipt as any).charging_pile}</Descriptions.Item>
                 <Descriptions.Item label="电量">{(selectedReceipt as any).energy_kwh} kWh</Descriptions.Item>
                 <Descriptions.Item label="金额">{(selectedReceipt as any).amount} 元</Descriptions.Item>
                 <Descriptions.Item label="开始时间">{(selectedReceipt as any).start_time ? dayjs((selectedReceipt as any).start_time).format('YYYY-MM-DD HH:mm:ss') : '-'}</Descriptions.Item>
                 <Descriptions.Item label="结束时间">{(selectedReceipt as any).end_time ? dayjs((selectedReceipt as any).end_time).format('YYYY-MM-DD HH:mm:ss') : '-'}</Descriptions.Item>
                 <Descriptions.Item label="创建时间">{selectedReceipt.created_at ? dayjs(selectedReceipt.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}</Descriptions.Item>
             </Descriptions>
         )}
      </Drawer>
      
      <Drawer title="编辑充电单" open={editDrawerOpen} onClose={() => setEditDrawerOpen(false)} width={500}>
        <Form form={editForm} layout="vertical" onFinish={(values) => {
            updateMutation.mutate({
                id: editingReceipt!.id,
                data: {
                    ...values,
                    start_time: values.start_time?.format('YYYY-MM-DD HH:mm:ss'),
                    end_time: values.end_time?.format('YYYY-MM-DD HH:mm:ss'),
                }
            })
        }}>
            <Form.Item name="receipt_number" label="单据编号"><Input /></Form.Item>
            <Form.Item name="vehicle_no" label="车牌号"><Input /></Form.Item>
            <Form.Item name="charging_station" label="充电站"><Input /></Form.Item>
            <Form.Item name="charging_pile" label="充电桩"><Input /></Form.Item>
            <Form.Item name="energy_kwh" label="电量"><InputNumber style={{width: '100%'}} /></Form.Item>
            <Form.Item name="amount" label="金额"><InputNumber style={{width: '100%'}} /></Form.Item>
            <Form.Item name="start_time" label="开始时间"><DatePicker showTime style={{width: '100%'}} /></Form.Item>
            <Form.Item name="end_time" label="结束时间"><DatePicker showTime style={{width: '100%'}} /></Form.Item>
            <Button type="primary" htmlType="submit" loading={updateMutation.isPending} block>保存</Button>
        </Form>
      </Drawer>
    </Space>
  )
}

export default ChargingList
