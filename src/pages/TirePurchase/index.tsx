import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Tag, Modal, Form, Input, Select, DatePicker, InputNumber, message, Descriptions, Row, Col } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import client from '../../api/client';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

interface PurchaseBatch {
  id: number;
  batch_no: string;
  supplier_id?: number;
  supplier_name: string;
  purchase_date: string;
  total_quantity: number;
  total_amount: number;
  unit_price: number;
  invoice_no?: string;
  payment_status: string;
  paid_amount: number;
  notes?: string;
  brand?: string;
  model?: string;
  specification?: string;
  pattern?: string;
  production_date?: string;
}

interface Supplier {
  id: number;
  supplier_code: string;
  supplier_name: string;
  contact_person?: string;
  contact_phone?: string;
}

const TirePurchase: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PurchaseBatch[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [suppliers, setSuppliers] = useState<any[]>([]);

  // 创建弹窗
  const [createVisible, setCreateVisible] = useState(false);
  const [createForm] = Form.useForm();

  // 编辑弹窗
  const [editVisible, setEditVisible] = useState(false);
  const [editForm] = Form.useForm();
  const [editingId, setEditingId] = useState<number | null>(null);

  // 详情弹窗
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailData, setDetailData] = useState<PurchaseBatch | null>(null);

  // 获取供应商列表
  const fetchSuppliers = async () => {
    try {
      const res = await client.get('/tires/suppliers', {
        params: { status: 'active' }
      });
      if (res.data.success) {
        setSuppliers(res.data.data.suppliers);
      }
    } catch (error) {
      console.error('获取供应商失败:', error);
    }
  };

  // 获取采购列表
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await client.get('/tires/purchases', {
        params: { page, page_size: pageSize }
      });

      if (res.data.success) {
        setData(res.data.data.batches);
        setTotal(res.data.data.total);
      }
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 创建采购批次
  const handleCreate = async (values: any) => {
    try {
      console.log('表单提交的值:', values);
      
      // 查找选中的供应商
      const selectedSupplier = suppliers.find(s => s.id === values.supplier_id);
      
      const payload = {
        ...values,
        purchase_date: values.purchase_date.format('YYYY-MM-DD'),
        production_date: values.production_date ? values.production_date.format('YYYY-MM-DD') : null,
        supplier_id: selectedSupplier?.id,
        supplier_name: selectedSupplier?.supplier_name
      };
      
      console.log('发送到后端的数据:', payload);
      
      await client.post('/tires/purchases', payload);

      message.success('采购批次创建成功');
      setCreateVisible(false);
      createForm.resetFields();
      fetchData();
    } catch (error: any) {
      console.error('创建失败:', error);
      message.error(error.response?.data?.message || '创建失败');
    }
  };

  // 编辑采购批次
  const handleEdit = (record: PurchaseBatch) => {
    setEditingId(record.id);
    editForm.setFieldsValue({
      ...record,
      purchase_date: dayjs(record.purchase_date),
      production_date: record.production_date ? dayjs(record.production_date) : null,
    });
    setEditVisible(true);
  };

  const handleUpdate = async (values: any) => {
    try {
      const selectedSupplier = suppliers.find(s => s.id === values.supplier_id);
      
      await client.put(`/tires/purchases/${editingId}`, {
        ...values,
        purchase_date: values.purchase_date.format('YYYY-MM-DD'),
        production_date: values.production_date ? values.production_date.format('YYYY-MM-DD') : null,
        supplier_id: selectedSupplier?.id,
        supplier_name: selectedSupplier?.supplier_name
      });

      message.success('采购批次更新成功');
      setEditVisible(false);
      editForm.resetFields();
      setEditingId(null);
      fetchData();
    } catch (error: any) {
      message.error(error.response?.data?.message || '更新失败');
    }
  };

  // 删除采购批次
  const handleDelete = (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个采购批次吗？此操作不可恢复。',
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await client.delete(`/tires/purchases/${id}`);
          message.success('删除成功');
          fetchData();
        } catch (error: any) {
          message.error(error.response?.data?.message || '删除失败');
        }
      },
    });
  };

  // 查看详情
  const handleViewDetail = (record: PurchaseBatch) => {
    setDetailData(record);
    setDetailVisible(true);
  };

  useEffect(() => {
    fetchData();
    fetchSuppliers();
  }, [page, pageSize]);

  const paymentStatusMap: Record<string, { text: string; color: string }> = {
    unpaid: { text: '未付款', color: 'red' },
    partial: { text: '部分付款', color: 'orange' },
    paid: { text: '已付款', color: 'green' },
  };

  const columns: ColumnsType<PurchaseBatch> = [
    {
      title: '批次号',
      dataIndex: 'batch_no',
      key: 'batch_no',
      width: 180,
      fixed: 'left',
    },
    {
      title: '供应商',
      dataIndex: 'supplier_name',
      key: 'supplier_name',
      width: 150,
    },
    {
      title: '采购日期',
      dataIndex: 'purchase_date',
      key: 'purchase_date',
      width: 120,
    },
    {
      title: '数量',
      dataIndex: 'total_quantity',
      key: 'total_quantity',
      width: 80,
      render: (qty: number) => `${qty}条`,
    },
    {
      title: '单价',
      dataIndex: 'unit_price',
      key: 'unit_price',
      width: 100,
      render: (price: number) => `¥${price.toFixed(2)}`,
    },
    {
      title: '总金额',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 120,
      render: (amount: number) => `¥${amount.toFixed(2)}`,
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
      title: '已付金额',
      dataIndex: 'paid_amount',
      key: 'paid_amount',
      width: 120,
      render: (amount: number) => `¥${amount.toFixed(2)}`,
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
        title="采购批次管理"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateVisible(true)}>
            新建采购
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

      {/* 创建采购弹窗 */}
      <Modal
        title="新建采购批次"
        open={createVisible}
        onCancel={() => {
          setCreateVisible(false);
          createForm.resetFields();
        }}
        onOk={() => createForm.submit()}
        width={600}
      >
        <Form 
          form={createForm} 
          onFinish={handleCreate} 
          onFinishFailed={(errorInfo) => {
            console.log('表单验证失败:', errorInfo);
            message.error('请填写所有必填项');
          }}
          layout="vertical"
        >
          <Form.Item name="supplier_id" label="供应商" rules={[{ required: true, message: '请选择供应商' }]}>
            <Select placeholder="请选择供应商" showSearch optionFilterProp="children">
              {suppliers.map(s => (
                <Option key={s.id} value={s.id}>
                  {s.supplier_name} {s.contact_person && `(${s.contact_person})`}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="purchase_date" label="采购日期" rules={[{ required: true, message: '请选择采购日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item label="轮胎信息" style={{ marginBottom: 0 }}>
            <Form.Item
              name="brand"
              rules={[{ required: true, message: '请输入品牌' }]}
              style={{ display: 'inline-block', width: 'calc(50% - 8px)' }}
            >
              <Input placeholder="品牌" />
            </Form.Item>
            <Form.Item
              name="model"
              rules={[{ required: true, message: '请输入型号' }]}
              style={{ display: 'inline-block', width: 'calc(50% - 8px)', marginLeft: 16 }}
            >
              <Input placeholder="型号" />
            </Form.Item>
          </Form.Item>

          <Form.Item label=" " colon={false} style={{ marginBottom: 0 }}>
            <Form.Item
              name="specification"
              rules={[{ required: true, message: '请输入规格' }]}
              style={{ display: 'inline-block', width: 'calc(50% - 8px)' }}
            >
              <Input placeholder="规格（如：225/65R17）" />
            </Form.Item>
            <Form.Item
              name="pattern"
              style={{ display: 'inline-block', width: 'calc(50% - 8px)', marginLeft: 16 }}
            >
              <Input placeholder="花纹（可选）" />
            </Form.Item>
          </Form.Item>

          <Form.Item name="production_date" label="生产日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item label="采购信息" style={{ marginBottom: 0 }}>
            <Form.Item
              name="total_quantity"
              rules={[{ required: true, message: '请输入数量' }]}
              style={{ display: 'inline-block', width: 'calc(33% - 8px)' }}
            >
              <InputNumber placeholder="数量" min={1} style={{ width: '100%' }} addonAfter="条" />
            </Form.Item>
            <Form.Item
              name="unit_price"
              rules={[{ required: true, message: '请输入单价' }]}
              style={{ display: 'inline-block', width: 'calc(33% - 8px)', marginLeft: 12 }}
            >
              <InputNumber placeholder="单价" min={0} step={0.01} style={{ width: '100%' }} addonBefore="¥" />
            </Form.Item>
            <Form.Item
              name="total_amount"
              rules={[{ required: true, message: '请输入总金额' }]}
              style={{ display: 'inline-block', width: 'calc(33% - 8px)', marginLeft: 12 }}
            >
              <InputNumber placeholder="总金额" min={0} step={0.01} style={{ width: '100%' }} addonBefore="¥" />
            </Form.Item>
          </Form.Item>

          <Form.Item name="invoice_no" label="发票号">
            <Input placeholder="请输入发票号" />
          </Form.Item>

          <Form.Item name="notes" label="备注">
            <TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑采购批次弹窗 */}
      <Modal
        title="编辑采购批次"
        open={editVisible}
        onCancel={() => {
          setEditVisible(false);
          editForm.resetFields();
          setEditingId(null);
        }}
        onOk={() => editForm.submit()}
        width={600}
      >
        <Form 
          form={editForm} 
          onFinish={handleUpdate}
          onFinishFailed={(errorInfo) => {
            console.log('表单验证失败:', errorInfo);
            message.error('请填写所有必填项');
          }}
          layout="vertical"
        >
          <Form.Item name="supplier_id" label="供应商" rules={[{ required: true, message: '请选择供应商' }]}>
            <Select placeholder="请选择供应商" showSearch optionFilterProp="children">
              {suppliers.map(s => (
                <Option key={s.id} value={s.id}>
                  {s.supplier_name} {s.contact_person && `(${s.contact_person})`}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="purchase_date" label="采购日期" rules={[{ required: true, message: '请选择采购日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item label="轮胎信息" style={{ marginBottom: 0 }}>
            <Form.Item
              name="brand"
              rules={[{ required: true, message: '请输入品牌' }]}
              style={{ display: 'inline-block', width: 'calc(50% - 8px)' }}
            >
              <Input placeholder="品牌" />
            </Form.Item>
            <Form.Item
              name="model"
              rules={[{ required: true, message: '请输入型号' }]}
              style={{ display: 'inline-block', width: 'calc(50% - 8px)', marginLeft: 16 }}
            >
              <Input placeholder="型号" />
            </Form.Item>
          </Form.Item>

          <Form.Item label=" " colon={false} style={{ marginBottom: 0 }}>
            <Form.Item
              name="specification"
              rules={[{ required: true, message: '请输入规格' }]}
              style={{ display: 'inline-block', width: 'calc(50% - 8px)' }}
            >
              <Input placeholder="规格（如：225/65R17）" />
            </Form.Item>
            <Form.Item
              name="pattern"
              style={{ display: 'inline-block', width: 'calc(50% - 8px)', marginLeft: 16 }}
            >
              <Input placeholder="花纹（可选）" />
            </Form.Item>
          </Form.Item>

          <Form.Item name="production_date" label="生产日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item label="采购信息" style={{ marginBottom: 0 }}>
            <Form.Item
              name="total_quantity"
              rules={[{ required: true, message: '请输入数量' }]}
              style={{ display: 'inline-block', width: 'calc(33% - 8px)' }}
            >
              <InputNumber placeholder="数量" min={1} style={{ width: '100%' }} addonAfter="条" />
            </Form.Item>
            <Form.Item
              name="unit_price"
              rules={[{ required: true, message: '请输入单价' }]}
              style={{ display: 'inline-block', width: 'calc(33% - 8px)', marginLeft: 12 }}
            >
              <InputNumber placeholder="单价" min={0} step={0.01} style={{ width: '100%' }} addonBefore="¥" />
            </Form.Item>
            <Form.Item
              name="total_amount"
              rules={[{ required: true, message: '请输入总金额' }]}
              style={{ display: 'inline-block', width: 'calc(33% - 8px)', marginLeft: 12 }}
            >
              <InputNumber placeholder="总金额" min={0} step={0.01} style={{ width: '100%' }} addonBefore="¥" />
            </Form.Item>
          </Form.Item>

          <Form.Item name="invoice_no" label="发票号">
            <Input placeholder="请输入发票号" />
          </Form.Item>

          <Form.Item name="notes" label="备注">
            <TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情弹窗 */}
      <Modal
        title="采购批次详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={700}
      >
        {detailData && (
          <Descriptions column={2} bordered>
            <Descriptions.Item label="批次号" span={2}>{detailData.batch_no}</Descriptions.Item>
            <Descriptions.Item label="供应商">{detailData.supplier_name}</Descriptions.Item>
            <Descriptions.Item label="采购日期">{detailData.purchase_date}</Descriptions.Item>
            <Descriptions.Item label="采购数量">{detailData.total_quantity}条</Descriptions.Item>
            <Descriptions.Item label="单价">¥{detailData.unit_price.toFixed(2)}</Descriptions.Item>
            <Descriptions.Item label="总金额" span={2}>
              <span style={{ fontSize: 18, fontWeight: 'bold', color: '#1890ff' }}>
                ¥{detailData.total_amount.toFixed(2)}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="付款状态">
              <Tag color={paymentStatusMap[detailData.payment_status]?.color}>
                {paymentStatusMap[detailData.payment_status]?.text}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="已付金额">¥{detailData.paid_amount.toFixed(2)}</Descriptions.Item>
            <Descriptions.Item label="未付金额">
              <span style={{ color: '#f5222d' }}>
                ¥{(detailData.total_amount - detailData.paid_amount).toFixed(2)}
              </span>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default TirePurchase;
