import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Tag, Modal, Form, Input, Select, DatePicker, InputNumber, message, Descriptions, Transfer } from 'antd';
import { PlusOutlined, EyeOutlined, DollarOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import client from '../../api/client';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

interface SaleRecord {
  id: number;
  sale_no: string;
  sale_date: string;
  customer_name?: string;
  customer_phone?: string;
  total_quantity: number;
  total_amount: number;
  payment_method?: string;
  payment_status: string;
  salesperson_name?: string;
}

interface TireOption {
  id: number;
  tire_code: string;
  brand: string;
  model: string;
  specification: string;
  purchase_price: number;
  status: string;
}

const TireSales: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SaleRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  
  const [createVisible, setCreateVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailData, setDetailData] = useState<SaleRecord | null>(null);
  const [createForm] = Form.useForm();
  
  const [editVisible, setEditVisible] = useState(false);
  const [editForm] = Form.useForm();
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // 可售轮胎列表
  const [availableTires, setAvailableTires] = useState<TireOption[]>([]);
  const [selectedTireIds, setSelectedTireIds] = useState<number[]>([]);

  const fetchAvailableTires = async () => {
    try {
      const res = await client.get('/tires/inventory', {
        params: { status: 'in_stock', page_size: 1000 }
      });
      if (res.data.success) {
        setAvailableTires(res.data.data.tires);
      }
    } catch (error) {
      console.error('获取轮胎列表失败:', error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await client.get('/tires/sales', {
        params: { page, page_size: pageSize }
      });

      if (res.data.success) {
        setData(res.data.data.sales);
        setTotal(res.data.data.total);
      }
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (values: any) => {
    if (selectedTireIds.length === 0) {
      message.error('请至少选择一条轮胎');
      return;
    }

    try {
      await client.post('/tires/sales', {
        ...values,
        sale_date: values.sale_date.format('YYYY-MM-DD'),
        tire_ids: selectedTireIds,
        total_quantity: selectedTireIds.length,
      });

      message.success('销售记录创建成功');
      setCreateVisible(false);
      createForm.resetFields();
      setSelectedTireIds([]);
      fetchData();
    } catch (error: any) {
      message.error(error.response?.data?.message || '创建失败');
    }
  };

  const handleViewDetail = (record: SaleRecord) => {
    setDetailData(record);
    setDetailVisible(true);
  };

  const handleEdit = (record: SaleRecord) => {
    setEditingId(record.id);
    editForm.setFieldsValue({
      ...record,
      sale_date: dayjs(record.sale_date),
    });
    setEditVisible(true);
  };

  const handleUpdate = async (values: any) => {
    try {
      await client.put(`/tires/sales/${editingId}`, {
        sale_date: values.sale_date.format('YYYY-MM-DD'),
        total_amount: values.total_amount,
        customer_name: values.customer_name,
        customer_phone: values.customer_phone,
        payment_method: values.payment_method,
        notes: values.notes,
      });
      message.success('销售记录更新成功');
      setEditVisible(false);
      editForm.resetFields();
      setEditingId(null);
      fetchData();
    } catch (error: any) {
      message.error(error.response?.data?.message || '更新失败');
    }
  };

  const handleDelete = (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这条销售记录吗？关联的轮胎将恢复为库存状态。',
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await client.delete(`/tires/sales/${id}`);
          message.success('删除成功');
          fetchData();
        } catch (error: any) {
          message.error(error.response?.data?.message || '删除失败');
        }
      },
    });
  };

  useEffect(() => {
    fetchData();
  }, [page, pageSize]);

  useEffect(() => {
    if (createVisible) {
      fetchAvailableTires();
    }
  }, [createVisible]);

  const paymentStatusMap: Record<string, { text: string; color: string }> = {
    unpaid: { text: '未付款', color: 'red' },
    partial: { text: '部分付款', color: 'orange' },
    paid: { text: '已付款', color: 'green' },
  };

  const paymentMethodMap: Record<string, string> = {
    cash: '现金',
    wechat: '微信',
    alipay: '支付宝',
    bank: '银行转账',
    credit: '赊账',
  };

  const columns: ColumnsType<SaleRecord> = [
    {
      title: '销售单号',
      dataIndex: 'sale_no',
      key: 'sale_no',
      width: 180,
    },
    {
      title: '销售日期',
      dataIndex: 'sale_date',
      key: 'sale_date',
      width: 120,
    },
    {
      title: '客户姓名',
      dataIndex: 'customer_name',
      key: 'customer_name',
      width: 120,
    },
    {
      title: '联系电话',
      dataIndex: 'customer_phone',
      key: 'customer_phone',
      width: 130,
    },
    {
      title: '数量',
      dataIndex: 'total_quantity',
      key: 'total_quantity',
      width: 80,
      render: (qty: number) => `${qty}条`,
    },
    {
      title: '金额',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 120,
      render: (amount: number) => `¥${amount.toFixed(2)}`,
    },
    {
      title: '付款方式',
      dataIndex: 'payment_method',
      key: 'payment_method',
      width: 100,
      render: (method: string) => paymentMethodMap[method] || '-',
    },
    {
      title: '付款状态',
      dataIndex: 'payment_status',
      key: 'payment_status',
      width: 100,
      render: (status: string) => (
        <Tag color={paymentStatusMap[status]?.color}>{paymentStatusMap[status]?.text}</Tag>
      ),
    },
    {
      title: '销售员',
      dataIndex: 'salesperson_name',
      key: 'salesperson_name',
      width: 100,
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            详情
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="销售管理"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateVisible(true)}>
            新建销售单
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
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

      {/* 创建销售单弹窗 */}
      <Modal
        title="新建销售单"
        open={createVisible}
        onCancel={() => {
          setCreateVisible(false);
          createForm.resetFields();
          setSelectedTireIds([]);
        }}
        onOk={() => createForm.submit()}
        width={800}
      >
        <Form form={createForm} onFinish={handleCreate} layout="vertical">
          <Form.Item name="sale_date" label="销售日期" rules={[{ required: true, message: '请选择销售日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item label="选择轮胎" required>
            <Transfer
              dataSource={availableTires.map(tire => ({
                key: tire.id.toString(),
                title: `${tire.tire_code} - ${tire.brand} ${tire.model} (${tire.specification})`,
                description: `成本: ¥${tire.purchase_price.toFixed(2)}`,
              }))}
              targetKeys={selectedTireIds.map(id => id.toString())}
              onChange={(targetKeys) => {
                setSelectedTireIds(targetKeys.map(key => parseInt(String(key))));
              }}
              render={item => item.title}
              listStyle={{
                width: 350,
                height: 300,
              }}
            />
            <div style={{ marginTop: 8, color: '#666' }}>
              已选择 {selectedTireIds.length} 条轮胎
            </div>
          </Form.Item>

          <Form.Item label="客户信息" style={{ marginBottom: 0 }}>
            <Form.Item
              name="customer_name"
              style={{ display: 'inline-block', width: 'calc(50% - 8px)' }}
            >
              <Input placeholder="客户姓名" />
            </Form.Item>
            <Form.Item
              name="customer_phone"
              style={{ display: 'inline-block', width: 'calc(50% - 8px)', marginLeft: 16 }}
            >
              <Input placeholder="联系电话" />
            </Form.Item>
          </Form.Item>

          <Form.Item name="customer_address" label="客户地址">
            <Input placeholder="请输入客户地址" />
          </Form.Item>

          <Form.Item label="销售信息" style={{ marginBottom: 0 }}>
            <Form.Item
              name="total_amount"
              rules={[{ required: true, message: '请输入销售金额' }]}
              style={{ display: 'inline-block', width: 'calc(50% - 8px)' }}
            >
              <InputNumber style={{ width: '100%' }} min={0} step={0.01} placeholder="销售金额" addonBefore="¥" />
            </Form.Item>
            <Form.Item
              name="payment_method"
              rules={[{ required: true, message: '请选择付款方式' }]}
              style={{ display: 'inline-block', width: 'calc(50% - 8px)', marginLeft: 16 }}
            >
              <Select placeholder="付款方式">
                <Option value="cash">现金</Option>
                <Option value="wechat">微信</Option>
                <Option value="alipay">支付宝</Option>
                <Option value="bank">银行转账</Option>
                <Option value="credit">赊账</Option>
              </Select>
            </Form.Item>
          </Form.Item>

          <Form.Item name="salesperson_name" label="销售员">
            <Input placeholder="请输入销售员姓名" />
          </Form.Item>

          <Form.Item name="notes" label="备注">
            <TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情弹窗 */}
      <Modal
        title="销售单详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={700}
      >
        {detailData && (
          <Descriptions column={2} bordered>
            <Descriptions.Item label="销售单号" span={2}>{detailData.sale_no}</Descriptions.Item>
            <Descriptions.Item label="销售日期">{detailData.sale_date}</Descriptions.Item>
            <Descriptions.Item label="销售数量">{detailData.total_quantity}条</Descriptions.Item>
            <Descriptions.Item label="客户姓名">{detailData.customer_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="联系电话">{detailData.customer_phone || '-'}</Descriptions.Item>
            <Descriptions.Item label="销售金额" span={2}>
              <span style={{ fontSize: 18, fontWeight: 'bold', color: '#1890ff' }}>
                ¥{detailData.total_amount.toFixed(2)}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="付款方式">
              {paymentMethodMap[detailData.payment_method || ''] || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="付款状态">
              <Tag color={paymentStatusMap[detailData.payment_status]?.color}>
                {paymentStatusMap[detailData.payment_status]?.text}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="销售员" span={2}>{detailData.salesperson_name || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* 编辑销售记录弹窗 */}
      <Modal
        title="编辑销售记录"
        open={editVisible}
        onCancel={() => {
          setEditVisible(false);
          editForm.resetFields();
          setEditingId(null);
        }}
        onOk={() => editForm.submit()}
        width={600}
      >
        <Form form={editForm} onFinish={handleUpdate} layout="vertical">
          <Form.Item name="sale_date" label="销售日期" rules={[{ required: true, message: '请选择销售日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item label="客户信息" style={{ marginBottom: 0 }}>
            <Form.Item
              name="customer_name"
              style={{ display: 'inline-block', width: 'calc(50% - 8px)' }}
            >
              <Input placeholder="客户姓名" />
            </Form.Item>
            <Form.Item
              name="customer_phone"
              style={{ display: 'inline-block', width: 'calc(50% - 8px)', marginLeft: 16 }}
            >
              <Input placeholder="联系电话" />
            </Form.Item>
          </Form.Item>

          <Form.Item name="total_amount" label="总金额" rules={[{ required: true, message: '请输入总金额' }]}>
            <InputNumber placeholder="总金额" min={0} step={0.01} style={{ width: '100%' }} addonBefore="¥" />
          </Form.Item>

          <Form.Item name="payment_method" label="支付方式">
            <Select placeholder="请选择支付方式">
              <Option value="cash">现金</Option>
              <Option value="wechat">微信</Option>
              <Option value="alipay">支付宝</Option>
              <Option value="bank">银行转账</Option>
              <Option value="credit">赊账</Option>
            </Select>
          </Form.Item>

          <Form.Item name="notes" label="备注">
            <TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TireSales;
