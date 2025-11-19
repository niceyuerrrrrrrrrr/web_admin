import { useMemo } from 'react'
import {
  Alert,
  Card,
  Descriptions,
  Empty,
  Flex,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ReloadOutlined, SafetyOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchRoles, type Role } from '../api/services/roles'

const { Title, Paragraph } = Typography

const RolesPage = () => {
  const queryClient = useQueryClient()

  // 获取角色列表
  const rolesQuery = useQuery({
    queryKey: ['roles', 'list'],
    queryFn: () => fetchRoles(),
  })

  const roles = rolesQuery.data?.items || []

  // 角色列表列定义
  const roleColumns: ColumnsType<Role> = useMemo(
    () => [
      {
        title: '角色ID',
        dataIndex: 'id',
        width: 150,
      },
      {
        title: '角色名称',
        dataIndex: 'title',
        width: 150,
        render: (value) => (
          <Space>
            <SafetyOutlined />
            <span>{value}</span>
          </Space>
        ),
      },
      {
        title: '描述',
        dataIndex: 'description',
        ellipsis: true,
      },
      {
        title: '部门',
        dataIndex: 'department',
        width: 150,
      },
      {
        title: '权限级别',
        dataIndex: 'level',
        width: 100,
        render: (value) => <Tag color="blue">Level {value}</Tag>,
      },
      {
        title: '权限',
        width: 400,
        render: (_, record) => {
          const perms = record.permissions
          const permList = []
          if (perms.can_switch_accounts) permList.push('账号切换')
          if (perms.can_manage_users) permList.push('用户管理')
          if (perms.can_view_finance) permList.push('财务查看')
          if (perms.can_view_statistics) permList.push('统计查看')
          if (perms.can_manage_vehicles) permList.push('车辆管理')
          if (perms.can_manage_receipts) permList.push('票据管理')
          return (
            <Space wrap>
              {permList.length > 0 ? (
                permList.map((perm) => <Tag key={perm}>{perm}</Tag>)
              ) : (
                <Tag>无特殊权限</Tag>
              )}
            </Space>
          )
        },
      },
    ],
    [],
  )

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Flex justify="space-between" align="center" wrap gap={16}>
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>
            角色管理
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            查看系统角色配置和权限分配。
          </Paragraph>
        </div>
        <Space>
          <ReloadOutlined
            onClick={() => queryClient.invalidateQueries({ queryKey: ['roles'] })}
            style={{ cursor: 'pointer', fontSize: 16 }}
          />
        </Space>
      </Flex>

      {rolesQuery.error && (
        <Alert
          type="error"
          showIcon
          message={(rolesQuery.error as Error).message || '数据加载失败'}
        />
      )}

      <Card>
        <Table
          rowKey="id"
          columns={roleColumns}
          dataSource={roles}
          loading={rolesQuery.isLoading}
          pagination={false}
          expandable={{
            expandedRowRender: (record) => (
              <Descriptions column={2} bordered size="small" style={{ margin: 16 }}>
                <Descriptions.Item label="角色ID">{record.id}</Descriptions.Item>
                <Descriptions.Item label="角色名称">{record.title}</Descriptions.Item>
                <Descriptions.Item label="部门">{record.department}</Descriptions.Item>
                <Descriptions.Item label="权限级别">Level {record.level}</Descriptions.Item>
                <Descriptions.Item label="描述" span={2}>
                  {record.description}
                </Descriptions.Item>
                <Descriptions.Item label="账号切换">
                  {record.permissions.can_switch_accounts ? '✓' : '✗'}
                </Descriptions.Item>
                <Descriptions.Item label="用户管理">
                  {record.permissions.can_manage_users ? '✓' : '✗'}
                </Descriptions.Item>
                <Descriptions.Item label="财务查看">
                  {record.permissions.can_view_finance ? '✓' : '✗'}
                </Descriptions.Item>
                <Descriptions.Item label="统计查看">
                  {record.permissions.can_view_statistics ? '✓' : '✗'}
                </Descriptions.Item>
                <Descriptions.Item label="车辆管理">
                  {record.permissions.can_manage_vehicles ? '✓' : '✗'}
                </Descriptions.Item>
                <Descriptions.Item label="票据管理">
                  {record.permissions.can_manage_receipts ? '✓' : '✗'}
                </Descriptions.Item>
              </Descriptions>
            ),
          }}
          locale={{ emptyText: <Empty description="暂无角色数据" /> }}
        />
      </Card>
    </Space>
  )
}

export default RolesPage

