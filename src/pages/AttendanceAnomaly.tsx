import React, { useState, useEffect } from 'react';
import { Table, Card, Select, DatePicker, Button, Tag, Space, message, Modal, Descriptions, Alert } from 'antd';
import { WarningOutlined, ExclamationCircleOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import client from '../api/client';
import useAuthStore from '../store/auth';
import useCompanyStore from '../store/company';

const { RangePicker } = DatePicker;
const { Option } = Select;

// 异常状态配置
const ANOMALY_STATUS_CONFIG = {
  suspicious: {
    label: '可疑',
    color: 'orange',
    icon: <ExclamationCircleOutlined />
  },
  cross_day_checkout: {
    label: '跨天补打卡',
    color: 'red',
    icon: <WarningOutlined />
  },
  long_no_checkout: {
    label: '长时间未打卡',
    color: 'red',
    icon: <WarningOutlined />
  },
  rapid_consecutive: {
    label: '连续快速打卡',
    color: 'red',
    icon: <WarningOutlined />
  }
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
    anomaly_status: undefined as string | undefined,
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
      
      if (filters.anomaly_status) {
        params.anomaly_status = filters.anomaly_status;
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

      const res = await client.get('/attendance/anomaly-shifts', { params });
      
      if (res.data.success || res.data.code === 200) {
        setData(res.data.data.records || []);
        setTotal(res.data.data.total || 0);
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
      anomaly_status: undefined,
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
      title: '工作日期',
      dataIndex: 'work_date',
      width: 120,
      render: (date: string) => date || '-',
    },
    {
      title: '上班时间',
      dataIndex: 'check_in_time',
      width: 160,
      render: (time: string) => time ? dayjs(time).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '下班时间',
      dataIndex: 'check_out_time',
      width: 160,
      render: (time: string) => time ? dayjs(time).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '工作时长',
      dataIndex: 'work_duration_minutes',
      width: 100,
      render: (minutes: number) => {
        if (!minutes) return '-';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}小时${mins}分钟`;
      },
    },
    {
      title: '异常状态',
      dataIndex: 'anomaly_status',
      width: 140,
      render: (status: string) => {
        const config = ANOMALY_STATUS_CONFIG[status as keyof typeof ANOMALY_STATUS_CONFIG];
        if (!config) return '-';
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.label}
          </Tag>
        );
      },
    },
    {
      title: '异常描述',
      dataIndex: 'anomaly_description',
      ellipsis: true,
      render: (desc: string) => desc || '-',
    },
    {
      title: '检测时间',
      dataIndex: 'anomaly_detected_at',
      width: 160,
      render: (time: string) => time ? dayjs(time).format('YYYY-MM-DD HH:mm') : '-',
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
          <Tag color="orange">可疑: 跨2天打卡</Tag>
          <Tag color="red">异常: 跨3天+/长时间/快速打卡</Tag>
        </Space>
      }>
        {/* 筛选条件 */}
        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            placeholder="异常状态"
            style={{ width: 160 }}
            value={filters.anomaly_status}
            onChange={(value) => setFilters({ ...filters, anomaly_status: value })}
            allowClear
          >
            <Option value="suspicious">可疑</Option>
            <Option value="cross_day_checkout">跨天补打卡</Option>
            <Option value="long_no_checkout">长时间未打卡</Option>
            <Option value="rapid_consecutive">连续快速打卡</Option>
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
            <Descriptions.Item label="工作日期">{selectedRecord.work_date}</Descriptions.Item>
            <Descriptions.Item label="班次ID">{selectedRecord.shift_id}</Descriptions.Item>
            <Descriptions.Item label="上班时间">
              {selectedRecord.check_in_time ? dayjs(selectedRecord.check_in_time).format('YYYY-MM-DD HH:mm:ss') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="下班时间">
              {selectedRecord.check_out_time ? dayjs(selectedRecord.check_out_time).format('YYYY-MM-DD HH:mm:ss') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="工作时长">
              {selectedRecord.work_duration_minutes ? `${Math.floor(selectedRecord.work_duration_minutes / 60)}小时${selectedRecord.work_duration_minutes % 60}分钟` : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="异常状态">
              {ANOMALY_STATUS_CONFIG[selectedRecord.anomaly_status as keyof typeof ANOMALY_STATUS_CONFIG]?.label || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="异常描述" span={2}>
              <div style={{ color: '#ff4d4f' }}>{selectedRecord.anomaly_description || '-'}</div>
            </Descriptions.Item>
            <Descriptions.Item label="检测时间" span={2}>
              {selectedRecord.anomaly_detected_at ? dayjs(selectedRecord.anomaly_detected_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default AttendanceAnomaly;

