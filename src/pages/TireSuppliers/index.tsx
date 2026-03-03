import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Tag, Modal, Form, Input, Select, message, Descriptions } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import client from '../../api/client';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

interface Supplier {
  id: number;
  supplier_code: string;
  supplier_name: string;
  contact_person?: string;
  contact_phone?: string;
  contact_email?: string;
  address?: string;
  credit_rating?: string;
  payment_terms?: string;
  total_purchase_amount: number;
  total_purchase_count: number;
  status: string;
}

const TireSuppliers: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Supplier[]>([]);
  const [createVisible, setCreateVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailData, setDetailData] = useState<Supplier | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;

      const res = await client.get('/tires/suppliers', { params });

      if (res.data.success) {
        setData(res.data.data.suppliers);
      }
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (values: any) => {
    try {
      await client.post('/tires/suppliers', values);

      message.success('供应商创建成功');
      setCreateVisible(false);
      createForm.resetFields();
      fetchData();
    } catch (error: any) {
      message.error(error.response?.data?.message || '创建失败');
    }
  };

  const handleEdit = (record: Supplier) => {
    setEditingId(record.id);
    editForm.setFieldsValue(record);
    setEditVisible(true);
  };

  const handleUpdate = async (values: any) => {
    try {
      await client.put(`/tires/suppliers/${editingId}`, values);
      message.success('供应商更新成功');
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
      content: '确定要删除这个供应商吗？此操作不可恢复。',
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await client.delete(`/tires/suppliers/${id}`);
          message.success('删除成功');
          fetchData();
        } catch (error: any) {
          message.error(error.response?.data?.message || '删除失败');
        }
      },
    });
  };

  const handleViewDetail = (record: Supplier) => {
    setDetailData(record);
    setDetailVisible(true);
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const statusMap: Record<string, { text: string; color: string }> = {
    active: { text: '合作中', color: 'green' },
    inactive: { text: '已停用', color: 'red' },
  };

  const creditRatingMap: Record<string, { text: string; color: string }> = {
    A: { text: 'A级', color: 'green' },
    B: { text: 'B级', color: 'blue' },
    C: { text: 'C级', color: 'orange' },
    D: { text: 'D级', color: 'red' },
  };

  const columns: ColumnsType<Supplier> = [
    {
      title: '供应商编号',
      dataIndex: 'supplier_code',
      key: 'supplier_code',
      width: 150,
    },
    {
      title: '供应商名称',
      dataIndex: 'supplier_name',
      key: 'supplier_name',
      width: 200,
    },
    {
      title: '联系人',
      dataIndex: 'contact_person',
      key: 'contact_person',
      width: 100,
    },
    {
      title: '联系电话',
      dataIndex: 'contact_phone',
      key: 'contact_phone',
      width: 130,
    },
    {
      title: '信用等级',
      dataIndex: 'credit_rating',
      key: 'credit_rating',
      width: 100,
      render: (rating: string) => rating ? (
        <Tag color={creditRatingMap[rating]?.color}>{creditRatingMap[rating]?.text}</Tag>
      ) : '-',
    },
    {
      title: '累计采购金额',
      dataIndex: 'total_purchase_amount',
      key: 'total_purchase_amount',
      width: 130,
      render: (amount: number) => `¥${amount.toFixed(2)}`,
    },
    {
      title: '累计采购次数',
      dataIndex: 'total_purchase_count',
      key: 'total_purchase_count',
      width: 120,
      render: (count: number) => `${count}次`,
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
      title: '操作',
      key: 'action',
      width: 150,
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
        title="供应商管理"
        extra={
          <Space>
            <Select
              placeholder="状态筛选"
              style={{ width: 120 }}
              allowClear
              value={statusFilter}
              onChange={setStatusFilter}
            >
              <Option value="active">合作中</Option>
              <Option value="inactive">已停用</Option>
            </Select>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateVisible(true)}>
              新建供应商
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={false}
        />
      </Card>

      {/* 创建供应商弹窗 */}
      <Modal
        title="新建供应商"
        open={createVisible}
        onCancel={() => {
          setCreateVisible(false);
          createForm.resetFields();
        }}
        onOk={() => createForm.submit()}
        width={600}
      >
        <Form form={createForm} onFinish={handleCreate} layout="vertical">
          <Form.Item name="supplier_name" label="供应商名称" rules={[{ required: true, message: '请输入供应商名称' }]}>
            <Input placeholder="请输入供应商名称" />
          </Form.Item>

          <Form.Item label="联系信息" style={{ marginBottom: 0 }}>
            <Form.Item
              name="contact_person"
              style={{ display: 'inline-block', width: 'calc(50% - 8px)' }}
            >
              <Input placeholder="联系人" />
            </Form.Item>
            <Form.Item
              name="contact_phone"
              style={{ display: 'inline-block', width: 'calc(50% - 8px)', marginLeft: 16 }}
            >
              <Input placeholder="联系电话" />
            </Form.Item>
          </Form.Item>

          <Form.Item name="contact_email" label="联系邮箱">
            <Input placeholder="请输入联系邮箱" />
          </Form.Item>

          <Form.Item name="address" label="地址">
            <Input placeholder="请输入地址" />
          </Form.Item>

          <Form.Item label="合作信息" style={{ marginBottom: 0 }}>
            <Form.Item
              name="credit_rating"
              style={{ display: 'inline-block', width: 'calc(50% - 8px)' }}
            >
              <Select placeholder="信用等级">
                <Option value="A">A级</Option>
                <Option value="B">B级</Option>
                <Option value="C">C级</Option>
                <Option value="D">D级</Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="payment_terms"
              style={{ display: 'inline-block', width: 'calc(50% - 8px)', marginLeft: 16 }}
            >
              <Input placeholder="付款条款" />
            </Form.Item>
          </Form.Item>

          <Form.Item name="notes" label="备注">
            <TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑供应商弹窗 */}
      <Modal
        title="编辑供应商"
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
          <Form.Item name="supplier_name" label="供应商名称" rules={[{ required: true, message: '请输入供应商名称' }]}>
            <Input placeholder="请输入供应商名称" />
          </Form.Item>

          <Form.Item label="联系信息" style={{ marginBottom: 0 }}>
            <Form.Item
              name="contact_person"
              style={{ display: 'inline-block', width: 'calc(50% - 8px)' }}
            >
              <Input placeholder="联系人" />
            </Form.Item>
            <Form.Item
              name="contact_phone"
              style={{ display: 'inline-block', width: 'calc(50% - 8px)', marginLeft: 16 }}
            >
              <Input placeholder="联系电话" />
            </Form.Item>
          </Form.Item>

          <Form.Item name="contact_email" label="联系邮箱">
            <Input placeholder="请输入联系邮箱" />
          </Form.Item>

          <Form.Item name="address" label="地址">
            <Input placeholder="请输入地址" />
          </Form.Item>

          <Form.Item name="credit_rating" label="信用等级">
            <Select placeholder="请选择信用等级">
              <Option value="A">A级</Option>
              <Option value="B">B级</Option>
              <Option value="C">C级</Option>
              <Option value="D">D级</Option>
            </Select>
          </Form.Item>

          <Form.Item name="payment_terms" label="付款条款">
            <TextArea rows={3} placeholder="请输入付款条款" />
          </Form.Item>

          <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
            <Select placeholder="请选择状态">
              <Option value="active">合作中</Option>
              <Option value="inactive">已停用</Option>
            </Select>
          </Form.Item>

          <Form.Item name="notes" label="备注">
            <TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情弹窗 */}
      <Modal
        title="供应商详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={700}
      >
        {detailData && (
          <Descriptions column={2} bordered>
            <Descriptions.Item label="供应商编号">{detailData.supplier_code}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusMap[detailData.status]?.color}>{statusMap[detailData.status]?.text}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="供应商名称" span={2}>{detailData.supplier_name}</Descriptions.Item>
            <Descriptions.Item label="联系人">{detailData.contact_person || '-'}</Descriptions.Item>
            <Descriptions.Item label="联系电话">{detailData.contact_phone || '-'}</Descriptions.Item>
            <Descriptions.Item label="联系邮箱" span={2}>{detailData.contact_email || '-'}</Descriptions.Item>
            <Descriptions.Item label="地址" span={2}>{detailData.address || '-'}</Descriptions.Item>
            <Descriptions.Item label="信用等级">
              {detailData.credit_rating ? (
                <Tag color={creditRatingMap[detailData.credit_rating]?.color}>
                  {creditRatingMap[detailData.credit_rating]?.text}
                </Tag>
              ) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="付款条款">{detailData.payment_terms || '-'}</Descriptions.Item>
            <Descriptions.Item label="累计采购金额">
              <span style={{ fontSize: 16, fontWeight: 'bold', color: '#1890ff' }}>
                ¥{detailData.total_purchase_amount.toFixed(2)}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="累计采购次数">
              <span style={{ fontSize: 16, fontWeight: 'bold' }}>
                {detailData.total_purchase_count}次
              </span>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default TireSuppliers;
