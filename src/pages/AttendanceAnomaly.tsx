import React, { useState, useEffect } from 'react';
import { Table, Card, Select, DatePicker, Button, Tag, Space, message, Modal, Descriptions, Alert } from 'antd';
import { WarningOutlined, ExclamationCircleOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import client from '../api/client';
import useAuthStore from '../store/auth';
import useCompanyStore from '../store/company';

const { RangePicker } = DatePicker;
const { Option } = Select;

// 违规事件类型配置
const ALERT_TYPE_CONFIG: Record<string, { label: string; color: string; icon?: React.ReactNode }> = {
  late: { label: '迟到', color: 'orange', icon: <ExclamationCircleOutlined /> },
  early_leave: { label: '早退', color: 'orange', icon: <ExclamationCircleOutlined /> },
  absent: { label: '缺勤', color: 'red', icon: <WarningOutlined /> },
  location_abnormal: { label: '位置异常', color: 'orange', icon: <ExclamationCircleOutlined /> },
  time_abnormal: { label: '时长异常', color: 'orange', icon: <ExclamationCircleOutlined /> },
  cross_day_checkout_suspicious: { label: '跨天打卡(可疑)', color: 'orange', icon: <ExclamationCircleOutlined /> },
  cross_day_checkout: { label: '跨天补打卡(严重)', color: 'red', icon: <WarningOutlined /> },
  long_no_checkout: { label: '长时间未打下班卡', color: 'red', icon: <WarningOutlined /> },
  rapid_consecutive: { label: '连续快速打卡', color: 'red', icon: <WarningOutlined /> },
};

const SEVERITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: '低', color: 'blue' },
  medium: { label: '中', color: 'orange' },
  high: { label: '高', color: 'red' },
};

const AttendanceAnomaly: React.FC = () => {
  const { user } = useAuthStore();
  const { selectedCompanyId } = useCompanyStore();
  const isSuperAdmin = user?.role === 'super_admin' || user?.positionType === '超级管理员';
  const effectiveCompanyId = isSuperAdmin ? selectedCompanyId : undefined;
  const showCompanyWarning = isSuperAdmin && !effectiveCompanyId;

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  
  // 筛选条件
  const [filters, setFilters] = useState({
    alert_type: undefined as string | undefined,
    is_resolved: undefined as boolean | undefined,
    start_date: undefined as string | undefined,
    end_date: undefined as string | undefined,
  });

  // 详情弹窗
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);

  // 加载数据
  const loadData = async () => {
    if (isSuperAdmin && !effectiveCompanyId) {
      setData([]);
      setTotal(0);
      return;
    }

    setLoading(true);
    try {
      const params: any = {
        page,
        page_size: pageSize,
      };
      
      if (filters.alert_type) {
        params.alert_type = filters.alert_type;
      }
      if (filters.is_resolved !== undefined) {
        params.is_resolved = filters.is_resolved;
      }
      if (filters.start_date) {
        params.start_date = filters.start_date;
      }
      if (filters.end_date) {
        params.end_date = filters.end_date;
      }
      if (effectiveCompanyId) {
        params.company_id = effectiveCompanyId;
      }

      const res = await client.get('/attendance/alerts', { params });
      
      if (res.data.success || res.data.code === 200) {
        setData(res.data.data.alerts || []);
        setTotal(res.data.data.total || (res.data.data.alerts ? res.data.data.alerts.length : 0));
      } else {
        message.error(res.data.message || '加载失败');
      }
    } catch (error: any) {
      console.error('加载异常打卡记录失败:', error);
      message.error(error.response?.data?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, pageSize, effectiveCompanyId]);

  // 查询
  const handleSearch = () => {
    setPage(1);
    loadData();
  };

  // 重置
  const handleReset = () => {
    setFilters({
      alert_type: undefined,
      is_resolved: undefined,
      start_date: undefined,
      end_date: undefined,
    });
    setPage(1);
    setTimeout(() => loadData(), 0);
  };

  // 查看详情
  const handleViewDetail = (record: any) => {
    setSelectedRecord(record);
    setDetailVisible(true);
  };

  // 表格列定义
  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
    },
    {
      title: '用户信息',
      key: 'user',
      width: 150,
      render: (_: any, record: any) => (
        <div>
          <div>{record.user_name}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{record.user_phone}</div>
        </div>
      ),
    },
    {
      title: '违规类型',
      dataIndex: 'alert_type',
      width: 140,
      render: (status: string) => {
        const config = ALERT_TYPE_CONFIG[status];
        if (!config) return <Tag>{status || '-'}</Tag>;
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.label}
          </Tag>
        );
      },
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      width: 100,
      render: (sev: string) => {
        const cfg = SEVERITY_CONFIG[sev] || { label: sev || '-', color: 'default' };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '违规描述',
      dataIndex: 'message',
      ellipsis: true,
      render: (desc: string) => desc || '-',
    },
    {
      title: '发生时间',
      dataIndex: 'created_at',
      width: 160,
      render: (time: string) => time ? dayjs(time).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '处理状态',
      dataIndex: 'is_resolved',
      width: 100,
      render: (v: boolean) => (v ? <Tag color="green">已处理</Tag> : <Tag color="red">未处理</Tag>),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Button type="link" size="small" onClick={() => handleViewDetail(record)}>
          查看详情
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {showCompanyWarning && (
        <Alert 
          type="warning" 
          message="请选择要查看的公司后再查看考勤异常数据" 
          showIcon 
          style={{ marginBottom: 16 }}
        />
      )}
      <Card title="考勤异常监控" extra={
        <Space>
          <Tag color="orange">展示每一条违规事件明细</Tag>
        </Space>
      }>
        {/* 筛选条件 */}
        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            placeholder="违规类型"
            style={{ width: 160 }}
            value={filters.alert_type}
            onChange={(value) => setFilters({ ...filters, alert_type: value })}
            allowClear
          >
            {Object.keys(ALERT_TYPE_CONFIG).map((k) => (
              <Option key={k} value={k}>
                {ALERT_TYPE_CONFIG[k].label}
              </Option>
            ))}
          </Select>

          <Select
            placeholder="处理状态"
            style={{ width: 140 }}
            value={filters.is_resolved as any}
            onChange={(value) => setFilters({ ...filters, is_resolved: value })}
            allowClear
          >
            <Option value={false}>未处理</Option>
            <Option value={true}>已处理</Option>
          </Select>

          <RangePicker
            placeholder={['开始日期', '结束日期']}
            onChange={(dates) => {
              if (dates) {
                setFilters({
                  ...filters,
                  start_date: dates[0]?.format('YYYY-MM-DD'),
                  end_date: dates[1]?.format('YYYY-MM-DD'),
                });
              } else {
                setFilters({
                  ...filters,
                  start_date: undefined,
                  end_date: undefined,
                });
              }
            }}
          />

          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            查询
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
        </Space>

        {/* 数据表格 */}
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1400 }}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) => {
              setPage(page);
              setPageSize(pageSize);
            },
          }}
        />
      </Card>

      {/* 详情弹窗 */}
      <Modal
        title="异常打卡详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        {selectedRecord && (
          <Descriptions bordered column={2}>
            <Descriptions.Item label="用户姓名">{selectedRecord.user_name}</Descriptions.Item>
            <Descriptions.Item label="手机号">{selectedRecord.user_phone}</Descriptions.Item>
            <Descriptions.Item label="违规类型">
              {ALERT_TYPE_CONFIG[selectedRecord.alert_type]?.label || selectedRecord.alert_type || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="严重程度">
              {SEVERITY_CONFIG[selectedRecord.severity]?.label || selectedRecord.severity || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="违规描述" span={2}>
              <div style={{ color: '#ff4d4f' }}>{selectedRecord.message || '-'}</div>
            </Descriptions.Item>
            <Descriptions.Item label="发生时间" span={2}>
              {selectedRecord.created_at ? dayjs(selectedRecord.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default AttendanceAnomaly;

