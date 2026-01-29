import React, { useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  DatePicker,
  Empty,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ReloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import client from '../api/client'
import { fetchAttendanceHistory, type AttendanceRecord } from '../api/services/attendance'
import { fetchUsers } from '../api/services/users'
import { fetchDepartments } from '../api/services/departments'
import useAuthStore from '../store/auth'
import useCompanyStore from '../store/company'

const { Title, Text } = Typography

type AttendancePoint = {
  time: string
  location: string
}

type DayCell = {
  shift_id?: string
  check_in?: AttendancePoint
  check_outs: AttendancePoint[]
  alert_count: number
  alert_types: string[]
}

type SpanMeta = {
  colSpan: number
}

type UserRow = {
  user_id: number
  user_name: string
  days: Record<string, DayCell>
  spans: Record<string, SpanMeta>
}

const formatClockLabel = (time: string, workDate: string) => {
  const t = dayjs(time)
  const d = dayjs(workDate)
  const diffDays = t.startOf('day').diff(d.startOf('day'), 'day')
  const hhmm = t.format('HH:mm')
  if (diffDays <= 0) return hhmm
  return `+${diffDays}天 ${hhmm}`
}

const AttendanceCalendarPage: React.FC = () => {
  const { user } = useAuthStore()
  const { selectedCompanyId } = useCompanyStore()

  const isSuperAdmin = user?.role === 'super_admin' || user?.positionType === '超级管理员'
  const effectiveCompanyId = isSuperAdmin ? selectedCompanyId : user?.companyId

  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs())
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | undefined>()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  const monthStart = useMemo(
    () => selectedMonth.startOf('month').format('YYYY-MM-DD'),
    [selectedMonth],
  )
  const monthEnd = useMemo(
    () => selectedMonth.endOf('month').format('YYYY-MM-DD'),
    [selectedMonth],
  )

  const departmentsQuery = useQuery({
    queryKey: ['attendance-calendar', 'departments', effectiveCompanyId],
    queryFn: () => fetchDepartments({ company_id: effectiveCompanyId }),
    enabled: !!effectiveCompanyId,
  })

  const usersQuery = useQuery({
    queryKey: ['attendance-calendar', 'users', effectiveCompanyId, selectedDepartmentId],
    queryFn: () =>
      fetchUsers({
        size: 1000,
        company_id: effectiveCompanyId,
        department_id: selectedDepartmentId,
      }),
    enabled: !!effectiveCompanyId,
  })

  const deptUsers = usersQuery.data?.items || []

  const allHistoryQuery = useQuery({
    queryKey: ['attendance-calendar', 'all-history', effectiveCompanyId, monthStart, monthEnd],
    queryFn: () =>
      fetchAttendanceHistory({
        scope: 'all',
        companyId: effectiveCompanyId,
        startDate: monthStart,
        endDate: monthEnd,
        page: 1,
        pageSize: 5000,
      }),
    enabled: !!effectiveCompanyId,
  })

  const alertsQuery = useQuery({
    queryKey: ['attendance-calendar', 'alerts', effectiveCompanyId, monthStart, monthEnd],
    queryFn: async () => {
      const alertsCompanyId = isSuperAdmin ? effectiveCompanyId : undefined
      const res = await client.get('/attendance/alerts', {
        params: {
          company_id: alertsCompanyId,
          start_date: monthStart,
          end_date: monthEnd,
          is_resolved: false,
          page: 1,
          page_size: 200,
        },
      })
      return res.data
    },
    enabled: !!effectiveCompanyId,
  })

  const allRecords: AttendanceRecord[] = (allHistoryQuery.data?.records || []) as any
  const rawAlerts: any[] = (alertsQuery.data?.data?.alerts || alertsQuery.data?.alerts || []) as any

  const deptUserIdSet = useMemo(() => {
    return new Set<number>(deptUsers.map((u: any) => Number(u.id)))
  }, [deptUsers])

  const groupedByUserDate = useMemo(() => {
    const map = new Map<string, DayCell>()

    for (const record of allRecords as any[]) {
      const userId = Number(record.user_id)
      if (!deptUserIdSet.has(userId)) continue
      if (!record.work_date) continue

      const date = String(record.work_date)
      const key = `${userId}_${date}`

      if (!map.has(key)) {
        map.set(key, {
          shift_id: record.shift_id,
          check_in: undefined,
          check_outs: [],
          alert_count: 0,
          alert_types: [],
        })
      }

      const cell = map.get(key)!
      if (!cell.shift_id && record.shift_id) cell.shift_id = record.shift_id

      if (record.clock_type === 'check_in') {
        if (!cell.check_in || record.clock_time < cell.check_in.time) {
          cell.check_in = {
            time: record.clock_time,
            location: record.location_text || '',
          }
        }
      } else if (record.clock_type === 'check_out') {
        cell.check_outs.push({
          time: record.clock_time,
          location: record.location_text || '',
        })
      }
    }

    for (const cell of map.values()) {
      cell.check_outs.sort((a, b) => a.time.localeCompare(b.time))
    }

    return map
  }, [allRecords, deptUserIdSet])

  const alertsByUserDate = useMemo(() => {
    const map = new Map<string, { count: number; types: string[] }>()
    for (const a of rawAlerts) {
      const userId = Number(a.user_id)
      if (!deptUserIdSet.has(userId)) continue

      const date = a.created_at ? dayjs(a.created_at).format('YYYY-MM-DD') : undefined
      if (!date) continue

      const key = `${userId}_${date}`
      const prev = map.get(key) || { count: 0, types: [] }
      prev.count += 1
      if (a.alert_type) prev.types.push(String(a.alert_type))
      map.set(key, prev)
    }
    return map
  }, [rawAlerts, deptUserIdSet])

  const monthDates = useMemo(() => {
    const dates: string[] = []
    const start = selectedMonth.startOf('month')
    const end = selectedMonth.endOf('month')

    let cur = start
    while (cur.isBefore(end) || cur.isSame(end, 'day')) {
      dates.push(cur.format('YYYY-MM-DD'))
      cur = cur.add(1, 'day')
    }
    return dates
  }, [selectedMonth])

  const processingDates = useMemo(() => {
    const extra = selectedMonth.endOf('month').add(1, 'day').format('YYYY-MM-DD')
    if (monthDates.includes(extra)) return monthDates
    return [...monthDates, extra]
  }, [monthDates, selectedMonth])

  const rows = useMemo<UserRow[]>(() => {
    const list: UserRow[] = []

    for (const u of deptUsers as any[]) {
      const userId = Number(u.id)
      const userName = u.nickname || u.name || `用户${userId}`

      const dayMap: Record<string, DayCell> = {}
      for (const d of processingDates) {
        const key = `${userId}_${d}`
        const base = groupedByUserDate.get(key)
        const alertMeta = alertsByUserDate.get(key) || { count: 0, types: [] }

        dayMap[d] = {
          shift_id: base?.shift_id,
          check_in: base?.check_in,
          check_outs: base?.check_outs ? [...base.check_outs] : [],
          alert_count: alertMeta.count,
          alert_types: alertMeta.types,
        }
      }

      // 跨天归并：若某天有上班无下班，而次日只有下班无上班，则将次日下班归并到前一天
      for (let i = 0; i < processingDates.length - 1; i += 1) {
        const d = processingDates[i]
        const next = processingDates[i + 1]
        const cur = dayMap[d]
        const nextCell = dayMap[next]
        if (!cur || !nextCell) continue

        const curHasIn = !!cur.check_in?.time
        const curHasOut = (cur.check_outs?.length || 0) > 0
        const nextHasIn = !!nextCell.check_in?.time
        const nextHasOut = (nextCell.check_outs?.length || 0) > 0

        if (curHasIn && !curHasOut && !nextHasIn && nextHasOut) {
          cur.check_outs = [...cur.check_outs, ...nextCell.check_outs]
          cur.check_outs.sort((a, b) => a.time.localeCompare(b.time))
          nextCell.check_outs = []
        }
      }

      const spans: Record<string, SpanMeta> = {}
      for (const d of monthDates) {
        spans[d] = { colSpan: 1 }
      }

      for (let i = 0; i < monthDates.length; i += 1) {
        const startDate = monthDates[i]
        const cell = dayMap[startDate]
        if (!cell) continue

        const lastOut = cell.check_outs.length ? cell.check_outs[cell.check_outs.length - 1] : undefined
        if (!lastOut?.time) continue

        const diffDays = dayjs(lastOut.time)
          .startOf('day')
          .diff(dayjs(startDate).startOf('day'), 'day')
        if (diffDays <= 0) continue

        const endIndex = Math.min(i + diffDays, monthDates.length - 1)
        const span = endIndex - i + 1
        if (span <= 1) continue

        let conflict = false
        for (let j = i + 1; j <= endIndex; j += 1) {
          const coverDate = monthDates[j]
          const coverCell = dayMap[coverDate]
          const hasCoverData =
            !!coverCell?.check_in?.time ||
            (coverCell?.check_outs?.length || 0) > 0 ||
            (coverCell?.alert_count || 0) > 0
          if (hasCoverData) {
            conflict = true
            break
          }
        }
        if (conflict) continue

        spans[startDate] = { colSpan: span }
        for (let j = i + 1; j <= endIndex; j += 1) {
          spans[monthDates[j]] = { colSpan: 0 }
        }

        i = endIndex
      }

      list.push({
        user_id: userId,
        user_name: userName,
        days: dayMap,
        spans,
      })
    }

    list.sort((a, b) => a.user_name.localeCompare(b.user_name))
    return list
  }, [alertsByUserDate, deptUsers, groupedByUserDate, monthDates, processingDates])

  const renderLocation = (value: string) => {
    if (!value) return null
    return (
      <Tooltip title={value}>
        <div style={{ fontSize: 12, color: '#666', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value}
        </div>
      </Tooltip>
    )
  }

  const renderCell = (cell: DayCell, workDate: string) => {
    const hasIn = !!cell.check_in?.time
    const lastOut = cell.check_outs.length ? cell.check_outs[cell.check_outs.length - 1] : undefined
    const hasOut = !!lastOut?.time

    const crossDay = hasOut
      ? dayjs(lastOut!.time).startOf('day').isAfter(dayjs(workDate).startOf('day'))
      : false

    const showEmpty = !hasIn && !hasOut && !cell.alert_count
    if (showEmpty) return null

    return (
      <div style={{ lineHeight: 1.2 }}>
        {cell.alert_count > 0 && (
          <div style={{ marginBottom: 2 }}>
            <Badge count={cell.alert_count} size="small" />
          </div>
        )}

        <div style={{ fontSize: 12 }}>
          <Text type={hasIn ? undefined : 'secondary'}>
            上 {hasIn ? dayjs(cell.check_in!.time).format('HH:mm') : '-'}
          </Text>
          {hasIn && renderLocation(cell.check_in!.location)}
        </div>

        <div style={{ fontSize: 12, marginTop: 2 }}>
          <Space size={4} wrap>
            <Text type={hasOut ? undefined : 'secondary'}>
              下 {hasOut ? formatClockLabel(lastOut!.time, workDate) : '-'}
            </Text>
            {crossDay && <Tag color="orange" style={{ marginInlineEnd: 0 }}>跨天</Tag>}
          </Space>
          {hasOut && renderLocation(lastOut!.location)}
        </div>

        {cell.shift_id && (
          <div style={{ marginTop: 4 }}>
            <Tag style={{ marginInlineEnd: 0 }}>{String(cell.shift_id)}</Tag>
          </div>
        )}
      </div>
    )
  }

  const renderSpanCell = (cell: DayCell, workDate: string, colSpan: number) => {
    const base = renderCell(cell, workDate)
    if (!base) return null
    return (
      <div
        style={{
          background: '#e6f4ff',
          border: '1px solid #91caff',
          borderRadius: 6,
          padding: '6px 8px',
          minHeight: 72,
        }}
      >
        <div style={{ marginBottom: 4 }}>
          <Tag color="blue" style={{ marginInlineEnd: 0 }}>
            跨天班次（{colSpan}天）
          </Tag>
        </div>
        {base}
      </div>
    )
  }

  const columns = useMemo<ColumnsType<UserRow>>(() => {
    const cols: ColumnsType<UserRow> = [
      {
        title: '姓名',
        dataIndex: 'user_name',
        key: 'user_name',
        width: 120,
        fixed: 'left',
      },
    ]

    for (const d of monthDates) {
      const dd = dayjs(d)
      cols.push({
        title: (
          <div style={{ textAlign: 'center' }}>
            <div>{dd.format('D')}</div>
            <div style={{ fontSize: 12, color: '#999' }}>{dd.format('dd')}</div>
          </div>
        ) as any,
        key: d,
        width: 180,
        render: (_: any, row: UserRow) => {
          const meta = row.spans[d] || { colSpan: 1 }
          if (meta.colSpan === 0) {
            return { children: null, props: { colSpan: 0 } }
          }

          const cell = row.days[d]
          if (meta.colSpan > 1) {
            return {
              children: renderSpanCell(cell, d, meta.colSpan),
              props: { colSpan: meta.colSpan },
            }
          }

          return {
            children: renderCell(cell, d),
            props: { colSpan: 1 },
          }
        },
      })
    }

    return cols
  }, [monthDates])

  const isLoading =
    departmentsQuery.isLoading ||
    usersQuery.isLoading ||
    allHistoryQuery.isLoading ||
    alertsQuery.isLoading

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={
          <Space direction="vertical" size={0}>
            <Title level={4} style={{ margin: 0 }}>
              考勤日历
            </Title>
            <Text type="secondary">纵轴员工，横轴日期；单元格展示上/下班时间与打卡地址</Text>
          </Space>
        }
        extra={
          <Space>
            <Select
              placeholder="选择部门"
              allowClear
              style={{ width: 180 }}
              value={selectedDepartmentId}
              onChange={(v: number | undefined) => setSelectedDepartmentId(v)}
              options={(departmentsQuery.data?.records || []).map((d: any) => ({
                label: d.title,
                value: d.id,
              }))}
            />
            <DatePicker
              picker="month"
              value={selectedMonth}
              allowClear={false}
              onChange={(v) => v && setSelectedMonth(v)}
            />
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                allHistoryQuery.refetch()
                alertsQuery.refetch()
                usersQuery.refetch()
                departmentsQuery.refetch()
              }}
            >
              刷新
            </Button>
          </Space>
        }
      >
        {!effectiveCompanyId ? (
          <Empty description="请先选择公司" />
        ) : isLoading ? (
          <div style={{ padding: 24 }}>
            <Text>加载中...</Text>
          </div>
        ) : !deptUsers.length ? (
          <Empty description="当前筛选下暂无员工" />
        ) : (
          <>
            <div style={{ marginBottom: 12 }}>
              <Space wrap>
                <Tag color="blue">上班</Tag>
                <Tag color="green">下班</Tag>
                <Tag color="orange">跨天</Tag>
                <Tag color="red">异常（Badge数量）</Tag>
              </Space>
            </div>
            <Table
              columns={columns}
              dataSource={rows}
              rowKey={(r) => String(r.user_id)}
              pagination={{
                current: page,
                pageSize,
                total: rows.length,
                showSizeChanger: true,
                pageSizeOptions: [20, 50, 100, 200],
                showTotal: (t) => `共 ${t} 人`,
                onChange: (p, ps) => {
                  setPage(p)
                  setPageSize(ps)
                },
              }}
              size="small"
              scroll={{ x: 120 + monthDates.length * 180, y: 680 }}
            />
          </>
        )}
      </Card>
    </div>
  )
}

export default AttendanceCalendarPage
