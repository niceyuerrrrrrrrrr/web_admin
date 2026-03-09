import React, { useState, useEffect, useMemo } from 'react';
import { Card, Table, Button, Space, Tag, Modal, Form, Input, Select, DatePicker, InputNumber, message, Descriptions, Row, Col, App, Statistic, Checkbox, Drawer } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, DollarOutlined, SettingOutlined, FilterOutlined, HolderOutlined } from '@ant-design/icons';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ColumnsType } from 'antd/es/table';
import client from '../../api/client';
import dayjs from 'dayjs';
import PaymentModal from './PaymentModal';
import useAuthStore from '../../store/auth';
import useCompanyStore from '../../store/company';
import ResizableTitle from '../../components/ResizableTitle';

const { Option } = Select;
const { TextArea } = Input;

interface PurchaseBatch {
  id: number;
  batch_no: string;
  item_name: string;
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
  const { modal } = App.useApp();
  const { user } = useAuthStore();
  const { selectedCompanyId } = useCompanyStore();
  
  const isSuperAdmin = user?.role === 'super_admin';
  const effectiveCompanyId = isSuperAdmin ? selectedCompanyId : user?.companyId;
  
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PurchaseBatch[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [itemNameFilter, setItemNameFilter] = useState<string | undefined>(undefined);
  const [monthFilter, setMonthFilter] = useState<string | undefined>(undefined);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  
  // 列显示设置
  const [columnSettingsVisible, setColumnSettingsVisible] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    batch_no: true,
    item_name: true,
    brand: true,
    model: true,
    specification: true,
    supplier_name: true,
    purchase_date: true,
    total_quantity: true,
    unit_price: true,
    total_amount: true,
    payment_status: true,
    paid_amount: true,
  });
  
  // 列顺序
  const [columnOrder, setColumnOrder] = useState<string[]>([
    'batch_no',
    'item_name',
    'brand',
    'model',
    'specification',
    'supplier_name',
    'purchase_date',
    'total_quantity',
    'unit_price',
    'total_amount',
    'payment_status',
    'paid_amount',
  ]);

  // 创建弹窗
  const [createVisible, setCreateVisible] = useState(false);
  const [createForm] = Form.useForm();
  
  // 列宽状态
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  
  const handleResize = (index: number) => (
    _e: React.SyntheticEvent,
    { size }: { size: { width: number } }
  ) => {
    setColumnWidths((prev) => ({
      ...prev,
      [index]: size.width,
    }))
  }
  
  const mergeColumns = (cols: ColumnsType<any>) => {
    return cols.map((col, index) => ({
      ...col,
      width: col.width ? (columnWidths[index] || col.width) : col.width,
      ...(col.width
        ? {
            onHeaderCell: (column: any) => ({
              width: columnWidths[index] || column.width,
              onResize: handleResize(index),
            }),
          }
        : {}),
    }))
  }

  // 编辑弹窗
  const [editVisible, setEditVisible] = useState(false);
  const [editForm] = Form.useForm();
  const [editingId, setEditingId] = useState<number | null>(null);

  // 详情弹窗
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailData, setDetailData] = useState<PurchaseBatch | null>(null);
  
  // 付款弹窗
  const [paymentVisible, setPaymentVisible] = useState(false);
  const [paymentBatch, setPaymentBatch] = useState<PurchaseBatch | null>(null);
  const [paymentForm] = Form.useForm();
  const [accounts, setAccounts] = useState<any[]>([]);

  // 获取供应商列表
  const fetchSuppliers = async () => {
    try {
      const params: any = { status: 'active' };
      if (effectiveCompanyId) {
        params.company_id = effectiveCompanyId;
      }
      const res = await client.get('/tires/suppliers', {
        params
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
      const params: any = { page: 1, page_size: 10000 }; // 获取全部数据用于前端过滤和统计
      if (effectiveCompanyId) {
        params.company_id = effectiveCompanyId;
      }
      const res = await client.get('/tires/purchases', {
        params
      });

      if (res.data.success) {
        let batches = res.data.data.batches;
        
        // 前端过滤
        if (itemNameFilter) {
          batches = batches.filter((b: PurchaseBatch) => b.item_name === itemNameFilter);
        }
        if (monthFilter) {
          batches = batches.filter((b: PurchaseBatch) => {
            const purchaseMonth = dayjs(b.purchase_date).format('YYYY-MM');
            return purchaseMonth === monthFilter;
          });
        }
        
        setData(batches);
        setTotal(batches.length);
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
      
      await client.post('/tires/purchases', payload, {
        params: effectiveCompanyId ? { company_id: effectiveCompanyId } : undefined,
      });

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
      item_name: record.item_name,
      supplier_id: record.supplier_id,
      purchase_date: dayjs(record.purchase_date),
      brand: record.brand,
      model: record.model,
      specification: record.specification,
      pattern: record.pattern,
      production_date: record.production_date ? dayjs(record.production_date) : null,
      total_quantity: record.total_quantity,
      unit_price: record.unit_price,
      total_amount: record.total_amount,
      invoice_no: record.invoice_no,
      notes: record.notes,
    });
    setEditVisible(true);
  };

  const handleUpdate = async (values: any) => {
    try {
      const selectedSupplier = suppliers.find(s => s.id === values.supplier_id);
      
      await client.put(
        `/tires/purchases/${editingId}`,
        {
          ...values,
          purchase_date: values.purchase_date.format('YYYY-MM-DD'),
          production_date: values.production_date ? values.production_date.format('YYYY-MM-DD') : null,
          supplier_id: selectedSupplier?.id,
          supplier_name: selectedSupplier?.supplier_name
        },
        {
          params: effectiveCompanyId ? { company_id: effectiveCompanyId } : undefined,
        }
      );

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
    modal.confirm({
      title: '确认删除',
      content: '确定要删除这个采购批次吗？此操作不可恢复。',
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await client.delete(`/tires/purchases/${id}`, {
            params: effectiveCompanyId ? { company_id: effectiveCompanyId } : undefined,
          });
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

  // 打开付款弹窗
  const handlePayment = (record: PurchaseBatch) => {
    setPaymentBatch(record);
    const remainingAmount = record.total_amount - record.paid_amount;
    paymentForm.setFieldsValue({
      pay_amount: remainingAmount,
      pay_date: dayjs(),
      pay_method: 'bank',
    });
    setPaymentVisible(true);
  };

  // 提交付款
  const handlePaymentSubmit = async (values: any) => {
    if (!paymentBatch) return;
    
    try {
      const payload: any = {
        batch_id: paymentBatch.id,
        payment_type: values.payment_type,
        remark: values.remark,
      };

      // 现付模式需要提供付款详情
      if (values.payment_type === 'immediate') {
        payload.pay_amount = values.pay_amount;
        payload.pay_date = values.pay_date.format('YYYY-MM-DD');
        payload.pay_method = values.pay_method;
        payload.account_id = values.account_id;
      } else {
        // 分期模式可选择到期日
        if (values.due_date) {
          payload.due_date = values.due_date.format('YYYY-MM-DD');
        }
      }

      await client.post('/tires/payments/create', payload, {
        params: effectiveCompanyId ? { company_id: effectiveCompanyId } : undefined,
      });
      message.success(values.payment_type === 'immediate' ? '现付申请已提交，等待财务审批' : '已创建应付账款，财务可择机付款');
      setPaymentVisible(false);
      paymentForm.resetFields();
      setPaymentBatch(null);
      fetchData();
    } catch (error: any) {
      message.error(error.response?.data?.message || '付款失败');
    }
  };

  useEffect(() => {
    fetchData();
    fetchSuppliers();
    fetchAccounts();
  }, [effectiveCompanyId, itemNameFilter, monthFilter]);

  const fetchAccounts = async () => {
    try {
      const response = await client.get('/fin/accounts');
      setAccounts(response.data.data.records || []);
    } catch (error) {
      console.error('获取账户列表失败:', error);
    }
  };

  const paymentStatusMap: Record<string, { text: string; color: string }> = {
    unpaid: { text: '未付款', color: 'red' },
    partial: { text: '部分付款', color: 'orange' },
    paid: { text: '已付款', color: 'green' },
  };

  // 统计数据
  const statistics = useMemo(() => {
    const totalCost = data.reduce((sum, item) => sum + item.total_amount, 0);
    const totalQuantity = data.reduce((sum, item) => sum + item.total_quantity, 0);
    
    // 按物品分类统计
    const itemStats = data.reduce((acc, item) => {
      if (!acc[item.item_name]) {
        acc[item.item_name] = { quantity: 0, cost: 0 };
      }
      acc[item.item_name].quantity += item.total_quantity;
      acc[item.item_name].cost += item.total_amount;
      return acc;
    }, {} as Record<string, { quantity: number; cost: number }>);
    
    // 按供应商+物品+型号统计
    const supplierItemModelStats = data.reduce((acc, item) => {
      const key = `${item.supplier_name}|${item.item_name}|${item.model || '未知型号'}`;
      if (!acc[key]) {
        acc[key] = {
          supplier: item.supplier_name,
          item: item.item_name,
          model: item.model || '未知型号',
          cost: 0,
          quantity: 0,
        };
      }
      acc[key].cost += item.total_amount;
      acc[key].quantity += item.total_quantity;
      return acc;
    }, {} as Record<string, any>);
    
    return {
      totalCost,
      totalQuantity,
      itemStats,
      supplierItemModelStats: Object.values(supplierItemModelStats).sort((a, b) => b.cost - a.cost),
    };
  }, [data]);

  const allColumnsMap: Record<string, any> = {
    batch_no: {
      title: '批次号',
      dataIndex: 'batch_no',
      key: 'batch_no',
      width: 150,
    },
    item_name: {
      title: '名称',
      dataIndex: 'item_name',
      key: 'item_name',
      width: 120,
      render: (name: string) => (
        <Tag color="blue">{name}</Tag>
      ),
    },
    brand: {
      title: '品牌',
      dataIndex: 'brand',
      key: 'brand',
      width: 100,
    },
    model: {
      title: '型号',
      dataIndex: 'model',
      key: 'model',
      width: 120,
    },
    specification: {
      title: '规格',
      dataIndex: 'specification',
      key: 'specification',
      width: 120,
    },
    supplier_name: {
      title: '供应商',
      dataIndex: 'supplier_name',
      key: 'supplier_name',
      width: 150,
    },
    purchase_date: {
      title: '采购日期',
      dataIndex: 'purchase_date',
      key: 'purchase_date',
      width: 120,
    },
    total_quantity: {
      title: '数量',
      dataIndex: 'total_quantity',
      key: 'total_quantity',
      width: 80,
      render: (qty: number) => `${qty}个`,
    },
    unit_price: {
      title: '单价',
      dataIndex: 'unit_price',
      key: 'unit_price',
      width: 100,
      render: (price: number) => `¥${price.toFixed(2)}`,
    },
    total_amount: {
      title: '总金额',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 120,
      render: (amount: number) => `¥${amount.toFixed(2)}`,
    },
    payment_status: {
      title: '付款状态',
      dataIndex: 'payment_status',
      key: 'payment_status',
      width: 100,
      render: (status: string) => (
        <Tag color={paymentStatusMap[status]?.color}>{paymentStatusMap[status]?.text}</Tag>
      ),
    },
    paid_amount: {
      title: '已付金额',
      dataIndex: 'paid_amount',
      key: 'paid_amount',
      width: 120,
      render: (amount: number) => `¥${amount.toFixed(2)}`,
    },
  };
  
  const actionColumn = {
    title: '操作',
    key: 'action',
    width: 200,
    fixed: 'right' as const,
    render: (_: any, record: PurchaseBatch) => (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' }}>
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)} style={{ padding: 0, height: 'auto' }}>
          详情
        </Button>
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} style={{ padding: 0, height: 'auto' }}>
          编辑
        </Button>
        {record.payment_status !== 'paid' ? (
          <Button type="link" size="small" icon={<DollarOutlined />} onClick={() => handlePayment(record)} style={{ padding: 0, height: 'auto' }}>
            付款
          </Button>
        ) : <div />}
        <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} style={{ padding: 0, height: 'auto' }}>
          删除
        </Button>
      </div>
    ),
  };
  
  const allColumns: ColumnsType<PurchaseBatch> = [
    ...columnOrder.map(key => allColumnsMap[key]),
    actionColumn,
  ];
  
  // 根据可见性过滤列
  const columns = allColumns.filter(col => {
    if (col.key === 'action') return true;
    return visibleColumns[col.key as string] !== false;
  });
  
  // 拖拽传感器
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  // 处理列拖拽结束
  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setColumnOrder((items) => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };
  
  // 可排序列项组件
  const SortableItem = ({ id, children }: { id: string; children: React.ReactNode }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
    } = useSortable({ id });
    
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };
    
    return (
      <div ref={setNodeRef} style={style} {...attributes}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <HolderOutlined {...listeners} style={{ cursor: 'move', marginRight: 8, color: '#999' }} />
          {children}
        </div>
      </div>
    );
  };
  
  // 分页后的数据
  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return data.slice(start, end);
  }, [data, page, pageSize]);

  return (
    <div style={{ padding: 24 }}>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总采购金额"
              value={statistics.totalCost}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总采购数量"
              value={statistics.totalQuantity}
              suffix="个"
            />
          </Card>
        </Col>
        {Object.entries(statistics.itemStats).map(([itemName, stats]) => (
          <Col span={6} key={itemName}>
            <Card>
              <Statistic
                title={`${itemName}总费用`}
                value={stats.cost}
                precision={2}
                prefix="¥"
              />
              <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>数量: {stats.quantity}个</div>
            </Card>
          </Col>
        ))}
      </Row>
      
      {/* 供应商+物品+型号统计 */}
      {statistics.supplierItemModelStats.length > 0 && (
        <Card title="供应商物品型号费用统计" style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]}>
            {statistics.supplierItemModelStats.slice(0, 8).map((stat, idx) => (
              <Col span={6} key={idx}>
                <Card size="small">
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{stat.supplier}</div>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{stat.item} - {stat.model}</div>
                  <div style={{ color: '#1890ff', fontSize: 16 }}>¥{stat.cost.toFixed(2)}</div>
                  <div style={{ fontSize: 12, color: '#999' }}>数量: {stat.quantity}个</div>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      <Card
        title="采购批次管理"
        extra={
          <Space>
            <DatePicker
              picker="month"
              placeholder="选择月份"
              style={{ width: 140 }}
              allowClear
              value={monthFilter ? dayjs(monthFilter) : null}
              onChange={(date) => setMonthFilter(date ? date.format('YYYY-MM') : undefined)}
            />
            <Select
              placeholder="物品筛选"
              style={{ width: 120 }}
              allowClear
              value={itemNameFilter}
              onChange={setItemNameFilter}
            >
              <Option value="轮胎">轮胎</Option>
              <Option value="垫带">垫带</Option>
              <Option value="内胎">内胎</Option>
              <Option value="钢圈">钢圈</Option>
            </Select>
            <Button icon={<SettingOutlined />} onClick={() => setColumnSettingsVisible(true)}>
              列设置
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateVisible(true)}>
              新建采购
            </Button>
          </Space>
        }
      >
        <Table
          columns={mergeColumns(columns)}
          dataSource={paginatedData}
          rowKey="id"
          loading={loading}
          className="resizable-table"
          components={{
            header: {
              cell: ResizableTitle,
            },
          }}
          scroll={{ x: 1490 }}
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
      
      {/* 列设置抽屉 */}
      <Drawer
        title="列显示设置"
        placement="right"
        onClose={() => setColumnSettingsVisible(false)}
        open={columnSettingsVisible}
        width={320}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 12, fontWeight: 'bold', fontSize: 14 }}>选择要显示的列：</div>
          <div style={{ color: '#666', fontSize: 12, marginBottom: 12 }}>拖动图标可调整列顺序</div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={columnOrder}
              strategy={verticalListSortingStrategy}
            >
              {columnOrder.map(key => (
                <SortableItem key={key} id={key}>
                  <Checkbox
                    checked={visibleColumns[key] !== false}
                    onChange={(e) => {
                      setVisibleColumns(prev => ({
                        ...prev,
                        [key]: e.target.checked,
                      }));
                    }}
                  >
                    {allColumnsMap[key]?.title}
                  </Checkbox>
                </SortableItem>
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </Drawer>

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
          <Form.Item name="item_name" label="名称" rules={[{ required: true, message: '请选择名称' }]} initialValue="轮胎">
            <Select placeholder="请选择名称">
              <Option value="轮胎">轮胎</Option>
              <Option value="垫带">垫带</Option>
              <Option value="内胎">内胎</Option>
              <Option value="钢圈">钢圈</Option>
            </Select>
          </Form.Item>

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

          <Form.Item label="物品信息" style={{ marginBottom: 0 }}>
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
              <InputNumber placeholder="数量" min={1} style={{ width: '100%' }} addonAfter="个" />
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
          <Form.Item name="item_name" label="名称" rules={[{ required: true, message: '请选择名称' }]}>
            <Select placeholder="请选择名称">
              <Option value="轮胎">轮胎</Option>
              <Option value="垫带">垫带</Option>
              <Option value="内胎">内胎</Option>
              <Option value="钢圈">钢圈</Option>
            </Select>
          </Form.Item>

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
        width={900}
      >
        {detailData && (
          <>
            <Descriptions bordered column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="批次号" span={2}>
                <Tag color="blue" style={{ fontSize: 14 }}>{detailData.batch_no}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="名称" span={2}>
                <strong style={{ fontSize: 15, color: '#1890ff' }}>{detailData.item_name || '-'}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="品牌">{detailData.brand || '-'}</Descriptions.Item>
              <Descriptions.Item label="型号">{detailData.model || '-'}</Descriptions.Item>
              <Descriptions.Item label="规格">{detailData.specification || '-'}</Descriptions.Item>
              <Descriptions.Item label="花纹">{detailData.pattern || '-'}</Descriptions.Item>
              <Descriptions.Item label="生产日期" span={2}>{detailData.production_date || '-'}</Descriptions.Item>
            </Descriptions>
            
            <Descriptions bordered column={2} style={{ marginBottom: 16 }} title="采购信息">
              <Descriptions.Item label="供应商">{detailData.supplier_name}</Descriptions.Item>
              <Descriptions.Item label="采购日期">{detailData.purchase_date}</Descriptions.Item>
              <Descriptions.Item label="采购数量">{detailData.total_quantity} 个</Descriptions.Item>
              <Descriptions.Item label="单价">¥{detailData.unit_price?.toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="总金额" span={2}>
                <strong style={{ fontSize: 16, color: '#f5222d' }}>¥{detailData.total_amount?.toFixed(2)}</strong>
              </Descriptions.Item>
            </Descriptions>
            
            <Descriptions bordered column={2} title="付款信息">
              <Descriptions.Item label="付款状态">
                <Tag color={paymentStatusMap[detailData.payment_status]?.color}>
                  {paymentStatusMap[detailData.payment_status]?.text}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="已付金额">¥{detailData.paid_amount?.toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="发票号">{detailData.invoice_no || '-'}</Descriptions.Item>
              <Descriptions.Item label="备注" span={2}>{detailData.notes || '2026年1月28日发票已收'}</Descriptions.Item>
            </Descriptions>
          </>
        )}
      </Modal>

      {/* 付款弹窗 */}
      <PaymentModal
        visible={paymentVisible}
        batch={paymentBatch}
        accounts={accounts}
        form={paymentForm}
        onCancel={() => {
          setPaymentVisible(false);
          paymentForm.resetFields();
          setPaymentBatch(null);
        }}
        onSubmit={handlePaymentSubmit}
      />
    </div>
  );
};

export default TirePurchase;
