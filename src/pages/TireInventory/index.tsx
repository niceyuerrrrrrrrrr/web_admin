import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Tag, Modal, Form, Input, Select, DatePicker, InputNumber, message, Descriptions, Tabs, Row, Col, Statistic } from 'antd';
import { PlusOutlined, EyeOutlined, CarOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import client from '../../api/client';
import dayjs from 'dayjs';

const { Search } = Input;
const { Option } = Select;
const { TabPane } = Tabs;

interface TireInventory {
  id: number;
  tire_code: string;
  brand: string;
  model: string;
  specification: string;
  status: string;
  purpose: string;
  vehicle_plate?: string;
  install_position?: string;
  install_date?: string;
  wear_level: number;
  purchase_price: number;
}

interface TireDetail extends TireInventory {
  pattern?: string;
  install_mileage?: number;
  current_mileage?: number;
  maintenance_count: number;
  maintenance_records: any[];
  usage_history: any[];
}

interface Stats {
  total: number;
  in_stock: number;
  in_use: number;
  sold: number;
  scrapped: number;
}

const TireInventory: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TireInventory[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [stats, setStats] = useState<Stats>({ total: 0, in_stock: 0, in_use: 0, sold: 0, scrapped: 0 });
  
  // 筛选条件
  const [filters, setFilters] = useState({
    status: undefined as string | undefined,
    purpose: undefined as string | undefined,
    brand: undefined as string | undefined,
    specification: undefined as string | undefined,
    vehicle_plate: undefined as string | undefined,
  });

  // 详情弹窗
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailData, setDetailData] = useState<TireDetail | null>(null);

  // 安装弹窗
  const [installVisible, setInstallVisible] = useState(false);
  const [installForm] = Form.useForm();
  const [currentTireId, setCurrentTireId] = useState<number | null>(null);

  // 拆卸弹窗
  const [removeVisible, setRemoveVisible] = useState(false);
  const [removeForm] = Form.useForm();

  // 获取统计数据
  const fetchStats = async () => {
    try {
      const res = await client.get('/tires/inventory/stats');
      if (res.data.success) {
        setStats(res.data.data);
      }
    } catch (error) {
      console.error('获取统计失败:', error);
    }
  };

  // 获取列表数据
  const fetchData = async () => {
    setLoading(true);
    try {
      const params: any = { page, page_size: pageSize };
      if (filters.status) params.status = filters.status;
      if (filters.purpose) params.purpose = filters.purpose;
      if (filters.brand) params.brand = filters.brand;
      if (filters.specification) params.specification = filters.specification;
      if (filters.vehicle_plate) params.vehicle_plate = filters.vehicle_plate;

      const res = await client.get('/tires/inventory', { params });

      if (res.data.success) {
        setData(res.data.data.tires);
        setTotal(res.data.data.total);
      }
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取轮胎详情
  const fetchDetail = async (id: number) => {
    try {
      const res = await client.get(`/tires/inventory/${id}`);
      if (res.data.success) {
        setDetailData(res.data.data);
        setDetailVisible(true);
      }
    } catch (error) {
      message.error('获取详情失败');
    }
  };

  // 安装轮胎
  const handleInstall = async (values: any) => {
    try {
      await client.post(`/tires/inventory/${currentTireId}/install`, {
        ...values,
        install_date: values.install_date.format('YYYY-MM-DD')
      });
      message.success('安装成功');
      setInstallVisible(false);
      installForm.resetFields();
      fetchData();
      fetchStats();
    } catch (error) {
      message.error('安装失败');
    }
  };

  // 拆卸轮胎
  const handleRemove = async (values: any) => {
    try {
      await client.post(`/tires/inventory/${currentTireId}/remove`, {
        ...values,
        remove_date: values.remove_date.format('YYYY-MM-DD')
      });
      message.success('拆卸成功');
      setRemoveVisible(false);
      removeForm.resetFields();
      fetchData();
      fetchStats();
    } catch (error) {
      message.error('拆卸失败');
    }
  };

  useEffect(() => {
    fetchData();
    fetchStats();
  }, [page, pageSize, filters]);

  const statusMap: Record<string, { text: string; color: string }> = {
    in_stock: { text: '在库', color: 'blue' },
    in_use: { text: '使用中', color: 'green' },
    sold: { text: '已售出', color: 'orange' },
    scrapped: { text: '已报废', color: 'red' },
  };

  const positionMap: Record<string, string> = {
    front_left: '左前',
    front_right: '右前',
    rear_left: '左后',
    rear_right: '右后',
    spare: '备胎',
  };

  const columns: ColumnsType<TireInventory> = [
    {
      title: '轮胎编号',
      dataIndex: 'tire_code',
      key: 'tire_code',
      width: 200,
      fixed: 'left',
    },
    {
      title: '品牌',
      dataIndex: 'brand',
      key: 'brand',
      width: 100,
    },
    {
      title: '型号',
      dataIndex: 'model',
      key: 'model',
      width: 120,
    },
    {
      title: '规格',
      dataIndex: 'specification',
      key: 'specification',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={statusMap[status]?.color}>{statusMap[status]?.text}</Tag>
      ),
    },
    {
      title: '用途',
      dataIndex: 'purpose',
      key: 'purpose',
      width: 80,
      render: (purpose: string) => (
        <Tag color={purpose === 'self_use' ? 'green' : 'blue'}>
          {purpose === 'self_use' ? '自用' : '待售'}
        </Tag>
      ),
    },
    {
      title: '车牌号',
      dataIndex: 'vehicle_plate',
      key: 'vehicle_plate',
      width: 120,
    },
    {
      title: '安装位置',
      dataIndex: 'install_position',
      key: 'install_position',
      width: 100,
      render: (pos: string) => pos ? positionMap[pos] : '-',
    },
    {
      title: '磨损程度',
      dataIndex: 'wear_level',
      key: 'wear_level',
      width: 100,
      render: (level: number) => `${level}%`,
    },
    {
      title: '采购价',
      dataIndex: 'purchase_price',
      key: 'purchase_price',
      width: 100,
      render: (price: number) => `¥${price.toFixed(2)}`,
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => fetchDetail(record.id)}>
            详情
          </Button>
          {record.status === 'in_stock' && (
            <Button
              type="link"
              size="small"
              icon={<CarOutlined />}
              onClick={() => {
                setCurrentTireId(record.id);
                setInstallVisible(true);
              }}
            >
              安装
            </Button>
          )}
          {record.status === 'in_use' && (
            <Button
              type="link"
              size="small"
              onClick={() => {
                setCurrentTireId(record.id);
                setRemoveVisible(true);
              }}
            >
              拆卸
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={4}>
          <Card>
            <Statistic title="总库存" value={stats.total} />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic title="在库" value={stats.in_stock} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic title="使用中" value={stats.in_use} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic title="已售出" value={stats.sold} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic title="已报废" value={stats.scrapped} valueStyle={{ color: '#f5222d' }} />
          </Card>
        </Col>
      </Row>

      {/* 筛选和操作 */}
      <Card style={{ marginBottom: 16 }}>
        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            placeholder="状态"
            style={{ width: 120 }}
            allowClear
            value={filters.status}
            onChange={(value) => setFilters({ ...filters, status: value })}
          >
            <Option value="in_stock">在库</Option>
            <Option value="in_use">使用中</Option>
            <Option value="sold">已售出</Option>
            <Option value="scrapped">已报废</Option>
          </Select>
          <Select
            placeholder="用途"
            style={{ width: 100 }}
            allowClear
            value={filters.purpose}
            onChange={(value) => setFilters({ ...filters, purpose: value })}
          >
            <Option value="self_use">自用</Option>
            <Option value="for_sale">待售</Option>
          </Select>
          <Input
            placeholder="品牌"
            style={{ width: 120 }}
            allowClear
            value={filters.brand}
            onChange={(e) => setFilters({ ...filters, brand: e.target.value })}
          />
          <Input
            placeholder="规格"
            style={{ width: 150 }}
            allowClear
            value={filters.specification}
            onChange={(e) => setFilters({ ...filters, specification: e.target.value })}
          />
          <Input
            placeholder="车牌号"
            style={{ width: 120 }}
            allowClear
            value={filters.vehicle_plate}
            onChange={(e) => setFilters({ ...filters, vehicle_plate: e.target.value })}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={() => setPage(1)}>
            查询
          </Button>
        </Space>

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
        title="轮胎详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={800}
      >
        {detailData && (
          <Tabs defaultActiveKey="1">
            <TabPane tab="基本信息" key="1">
              <Descriptions column={2} bordered>
                <Descriptions.Item label="轮胎编号">{detailData.tire_code}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={statusMap[detailData.status]?.color}>{statusMap[detailData.status]?.text}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="品牌">{detailData.brand}</Descriptions.Item>
                <Descriptions.Item label="型号">{detailData.model}</Descriptions.Item>
                <Descriptions.Item label="规格">{detailData.specification}</Descriptions.Item>
                <Descriptions.Item label="花纹">{detailData.pattern || '-'}</Descriptions.Item>
                <Descriptions.Item label="采购价">¥{detailData.purchase_price.toFixed(2)}</Descriptions.Item>
                <Descriptions.Item label="磨损程度">{detailData.wear_level}%</Descriptions.Item>
                {detailData.status === 'in_use' && (
                  <>
                    <Descriptions.Item label="车牌号">{detailData.vehicle_plate}</Descriptions.Item>
                    <Descriptions.Item label="安装位置">{positionMap[detailData.install_position!]}</Descriptions.Item>
                    <Descriptions.Item label="安装日期">{detailData.install_date}</Descriptions.Item>
                    <Descriptions.Item label="安装里程">{detailData.install_mileage} km</Descriptions.Item>
                    <Descriptions.Item label="当前里程">{detailData.current_mileage} km</Descriptions.Item>
                    <Descriptions.Item label="已使用">
                      {((detailData.current_mileage || 0) - (detailData.install_mileage || 0))} km
                    </Descriptions.Item>
                  </>
                )}
              </Descriptions>
            </TabPane>
            <TabPane tab={`维护记录 (${detailData.maintenance_count})`} key="2">
              <Table
                dataSource={detailData.maintenance_records}
                rowKey="id"
                pagination={false}
                columns={[
                  { title: '日期', dataIndex: 'maintenance_date', key: 'date' },
                  { title: '类型', dataIndex: 'maintenance_type', key: 'type' },
                  { title: '费用', dataIndex: 'cost', key: 'cost', render: (v: number) => v ? `¥${v.toFixed(2)}` : '-' },
                  { title: '备注', dataIndex: 'notes', key: 'notes' },
                ]}
              />
            </TabPane>
            <TabPane tab="使用历史" key="3">
              <Table
                dataSource={detailData.usage_history}
                pagination={false}
                columns={[
                  { title: '车牌号', dataIndex: 'vehicle_plate', key: 'plate' },
                  { title: '安装日期', dataIndex: 'install_date', key: 'install' },
                  { title: '拆卸日期', dataIndex: 'remove_date', key: 'remove', render: (v: string) => v || '使用中' },
                  { title: '使用里程', dataIndex: 'usage_mileage', key: 'mileage', render: (v: number) => v ? `${v} km` : '-' },
                ]}
              />
            </TabPane>
          </Tabs>
        )}
      </Modal>

      {/* 安装弹窗 */}
      <Modal
        title="安装轮胎"
        open={installVisible}
        onCancel={() => {
          setInstallVisible(false);
          installForm.resetFields();
        }}
        onOk={() => installForm.submit()}
      >
        <Form form={installForm} onFinish={handleInstall} layout="vertical">
          <Form.Item name="vehicle_plate" label="车牌号" rules={[{ required: true, message: '请输入车牌号' }]}>
            <Input placeholder="请输入车牌号" />
          </Form.Item>
          <Form.Item name="install_position" label="安装位置" rules={[{ required: true, message: '请选择安装位置' }]}>
            <Select placeholder="请选择安装位置">
              <Option value="front_left">左前</Option>
              <Option value="front_right">右前</Option>
              <Option value="rear_left">左后</Option>
              <Option value="rear_right">右后</Option>
              <Option value="spare">备胎</Option>
            </Select>
          </Form.Item>
          <Form.Item name="install_date" label="安装日期" rules={[{ required: true, message: '请选择安装日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="install_mileage" label="安装时里程(km)" rules={[{ required: true, message: '请输入安装时里程' }]}>
            <InputNumber style={{ width: '100%' }} min={0} placeholder="请输入安装时里程" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 拆卸弹窗 */}
      <Modal
        title="拆卸轮胎"
        open={removeVisible}
        onCancel={() => {
          setRemoveVisible(false);
          removeForm.resetFields();
        }}
        onOk={() => removeForm.submit()}
      >
        <Form form={removeForm} onFinish={handleRemove} layout="vertical">
          <Form.Item name="remove_date" label="拆卸日期" rules={[{ required: true, message: '请选择拆卸日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="remove_mileage" label="拆卸时里程(km)" rules={[{ required: true, message: '请输入拆卸时里程' }]}>
            <InputNumber style={{ width: '100%' }} min={0} placeholder="请输入拆卸时里程" />
          </Form.Item>
          <Form.Item name="remove_reason" label="拆卸原因" rules={[{ required: true, message: '请选择拆卸原因' }]}>
            <Select placeholder="请选择拆卸原因">
              <Option value="rotation">换位</Option>
              <Option value="replacement">更换</Option>
              <Option value="sale">销售</Option>
              <Option value="scrap">报废</Option>
              <Option value="other">其他</Option>
            </Select>
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TireInventory;
