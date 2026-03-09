import React, { useState, useEffect, useMemo } from 'react';
import { Card, Table, Button, Space, Tag, Modal, Form, Input, Select, DatePicker, InputNumber, message, Descriptions, App, Drawer, Checkbox, Row, Col } from 'antd';
import { PlusOutlined, EyeOutlined, DollarOutlined, EditOutlined, DeleteOutlined, SettingOutlined, HolderOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ColumnsType } from 'antd/es/table';
import client from '../../api/client';
import dayjs from 'dayjs';
import useAuthStore from '../../store/auth';
import useCompanyStore from '../../store/company';
import ResizableTitle from '../../components/ResizableTitle';

const { Option } = Select;
const { TextArea } = Input;

interface SaleRecord {
  id: number;
  sale_no: string;
  sale_date: string;
  item_name?: string;
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
  const { modal } = App.useApp();
  const { user } = useAuthStore();
  const { selectedCompanyId } = useCompanyStore();
  
  const isSuperAdmin = user?.role === 'super_admin';
  const effectiveCompanyId = isSuperAdmin ? selectedCompanyId : user?.companyId;
  
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SaleRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [itemNameFilter, setItemNameFilter] = useState<string | undefined>(undefined);
  
  // 列显示设置
  const [columnSettingsVisible, setColumnSettingsVisible] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    sale_no: true,
    sale_date: true,
    item_name: true,
    customer_name: true,
    total_quantity: true,
    total_amount: true,
    payment_method: true,
    payment_status: true,
    salesperson_name: true,
  });
  
  // 列顺序
  const [columnOrder, setColumnOrder] = useState<string[]>([
    'sale_no',
    'sale_date',
    'item_name',
    'customer_name',
    'total_quantity',
    'total_amount',
    'payment_method',
    'payment_status',
    'salesperson_name',
  ]);
  
  // 轮胎型号配置选项
  const [tireModels, setTireModels] = useState<Array<{ brand: string; model: string; specification: string }>>([]);
  
  // 销售轮胎项
  interface SaleItem {
    id: string;
    brand: string;
    model: string;
    specification: string;
    quantity: number;
    unit_price: number;
  }
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  
  const [createVisible, setCreateVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailData, setDetailData] = useState<SaleRecord | null>(null);
  const [createForm] = Form.useForm();
  
  const [editVisible, setEditVisible] = useState(false);
  const [editForm] = Form.useForm();
  const [editingId, setEditingId] = useState<number | null>(null);
  
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
  
  // 获取轮胎型号配置
  const fetchTireModels = async () => {
    try {
      const params: any = { 
        status: 'in_stock',
        page: 1,
        page_size: 1000
      };
      
      if (effectiveCompanyId) {
        params.company_id = effectiveCompanyId;
      }
      
      const res = await client.get('/tires/inventory', { params });
      
      if (res.data.success) {
        const tires = res.data.data.tires || [];
        // 提取唯一的品牌+型号+规格组合
        const uniqueModels = Array.from(
          new Set(tires.map((t: any) => JSON.stringify({ brand: t.brand, model: t.model, specification: t.specification })))
        ).map(str => JSON.parse(str as string));
        setTireModels(uniqueModels);
      }
    } catch (error: any) {
      console.error('获取轮胎型号失败:', error);
      message.error(error.response?.data?.message || '获取轮胎型号失败');
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: any = { page, page_size: pageSize };
      if (itemNameFilter) {
        params.item_name = itemNameFilter;
      }
      if (effectiveCompanyId) {
        params.company_id = effectiveCompanyId;
      }
      const res = await client.get('/tires/sales', {
        params
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
    if (saleItems.length === 0) {
      message.error('请至少添加一项销售物品');
      return;
    }

    try {
      // 根据型号和数量查找库存轮胎
      const tireIdsToSell: number[] = [];
      
      for (const item of saleItems) {
        const params: any = {
          status: 'in_stock',
          page: 1,
          page_size: item.quantity,
        };
        if (effectiveCompanyId) {
          params.company_id = effectiveCompanyId;
        }
        
        const res = await client.get('/tires/inventory', { params });
        if (res.data.success) {
          const matchingTires = res.data.data.tires.filter((t: any) => 
            t.brand === item.brand && 
            t.model === item.model && 
            t.specification === item.specification
          ).slice(0, item.quantity);
          
          if (matchingTires.length < item.quantity) {
            message.error(`${item.brand} ${item.model} 库存不足，需要 ${item.quantity} 个，仅有 ${matchingTires.length} 个`);
            return;
          }
          
          tireIdsToSell.push(...matchingTires.map((t: any) => t.id));
        }
      }

      await client.post(
        '/tires/sales',
        {
          ...values,
          sale_date: values.sale_date.format('YYYY-MM-DD'),
          tire_ids: tireIdsToSell,
          total_quantity: tireIdsToSell.length,
        },
        {
          params: effectiveCompanyId ? { company_id: effectiveCompanyId } : undefined,
        }
      );

      message.success('销售记录创建成功');
      setCreateVisible(false);
      createForm.resetFields();
      setSaleItems([]);
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
      await client.put(
        `/tires/sales/${editingId}`,
        {
          sale_date: values.sale_date.format('YYYY-MM-DD'),
          total_amount: values.total_amount,
          customer_name: values.customer_name,
          customer_phone: values.customer_phone,
          payment_method: values.payment_method,
          notes: values.notes,
        },
        {
          params: effectiveCompanyId ? { company_id: effectiveCompanyId } : undefined,
        }
      );
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
    modal.confirm({
      title: '确认删除',
      content: '确定要删除这条销售记录吗？关联的轮胎将恢复为库存状态。',
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await client.delete(`/tires/sales/${id}`, {
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

  useEffect(() => {
    fetchData();
  }, [page, pageSize, effectiveCompanyId, itemNameFilter]);

  useEffect(() => {
    if (createVisible) {
      fetchTireModels();
    }
  }, [createVisible, effectiveCompanyId]);
  
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
  
  // 添加销售项
  const handleAddSaleItem = () => {
    setSaleItems([...saleItems, {
      id: Date.now().toString(),
      brand: '',
      model: '',
      specification: '',
      quantity: 1,
      unit_price: 0,
    }]);
  };
  
  // 删除销售项
  const handleRemoveSaleItem = (id: string) => {
    setSaleItems(saleItems.filter(item => item.id !== id));
  };
  
  // 更新销售项
  const handleUpdateSaleItem = (id: string, field: string, value: any) => {
    setSaleItems(saleItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

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

  const allColumnsMap: Record<string, any> = {
    sale_no: {
      title: '销售单号',
      dataIndex: 'sale_no',
      key: 'sale_no',
      width: 150,
    },
    sale_date: {
      title: '销售日期',
      dataIndex: 'sale_date',
      key: 'sale_date',
      width: 120,
    },
    item_name: {
      title: '物品名称',
      dataIndex: 'item_name',
      key: 'item_name',
      width: 100,
      render: (name: string) => name ? <Tag color="blue">{name}</Tag> : '-',
    },
    customer_name: {
      title: '客户姓名',
      dataIndex: 'customer_name',
      key: 'customer_name',
      width: 140,
    },
    total_quantity: {
      title: '轮胎数量',
      dataIndex: 'total_quantity',
      key: 'total_quantity',
      width: 100,
      render: (qty: number) => `${qty}条`,
    },
    total_amount: {
      title: '总金额',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 120,
      render: (amount: number) => `¥${amount.toFixed(2)}`,
    },
    payment_method: {
      title: '付款方式',
      dataIndex: 'payment_method',
      key: 'payment_method',
      width: 120,
      render: (method: string) => paymentMethodMap[method] || method,
    },
    payment_status: {
      title: '付款状态',
      dataIndex: 'payment_status',
      key: 'payment_status',
      width: 100,
      render: (status: string) => <Tag color={paymentStatusMap[status]?.color}>{paymentStatusMap[status]?.text}</Tag>,
    },
    salesperson_name: {
      title: '销售员',
      dataIndex: 'salesperson_name',
      key: 'salesperson_name',
      width: 120,
    },
  };
  
  const actionColumn = {
    title: '操作',
    key: 'action',
    width: 180,
    fixed: 'right' as const,
    render: (_: any, record: SaleRecord) => (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' }}>
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)} style={{ padding: 0, height: 'auto' }}>
          详情
        </Button>
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} style={{ padding: 0, height: 'auto' }}>
          编辑
        </Button>
        <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} style={{ padding: 0, height: 'auto', gridColumn: 'span 2' }}>
          删除
        </Button>
      </div>
    ),
  };
  
  const allColumns: ColumnsType<SaleRecord> = [
    ...columnOrder.map(key => allColumnsMap[key]),
    actionColumn,
  ];
  
  // 根据可见性过滤列
  const columns = allColumns.filter(col => {
    if (col.key === 'action') return true;
    return visibleColumns[col.key as string] !== false;
  });

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="销售管理"
        extra={
          <Space>
            <Select
              placeholder="物品名称"
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
              新建销售单
            </Button>
          </Space>
        }
      >
        <Table
          columns={mergeColumns(columns)}
          dataSource={data}
          rowKey="id"
          loading={loading}
          className="resizable-table"
          components={{
            header: {
              cell: ResizableTitle,
            },
          }}
          scroll={{ x: 1270 }}
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

      {/* 创建销售单弹窗 */}
      <Modal
        title="新建销售单"
        open={createVisible}
        onCancel={() => {
          setCreateVisible(false);
          createForm.resetFields();
          setSaleItems([]);
        }}
        onOk={() => {
          console.log('点击确定按钮');
          createForm.submit();
        }}
        width={800}
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
          <Form.Item name="sale_date" label="销售日期" rules={[{ required: true, message: '请选择销售日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item label="销售物品" required>
            <div style={{ marginBottom: 8 }}>
              <Button type="dashed" onClick={handleAddSaleItem} block icon={<PlusOutlined />}>
                添加物品
              </Button>
            </div>
            {saleItems.map((item) => (
              <Card key={item.id} size="small" style={{ marginBottom: 8 }}>
                <Row gutter={8} align="middle">
                  <Col span={10}>
                    <Select
                      placeholder="选择型号"
                      style={{ width: '100%' }}
                      value={item.model ? `${item.brand}|${item.model}|${item.specification}` : undefined}
                      onChange={(value) => {
                        const [brand, model, specification] = value.split('|');
                        handleUpdateSaleItem(item.id, 'brand', brand);
                        handleUpdateSaleItem(item.id, 'model', model);
                        handleUpdateSaleItem(item.id, 'specification', specification);
                      }}
                      showSearch
                      filterOption={(input, option) => {
                        const label = option?.label || option?.children;
                        return String(label).toLowerCase().includes(input.toLowerCase());
                      }}
                    >
                      {tireModels.map((tm, idx) => (
                        <Option key={idx} value={`${tm.brand}|${tm.model}|${tm.specification}`}>
                          {tm.brand} {tm.model} ({tm.specification})
                        </Option>
                      ))}
                    </Select>
                  </Col>
                  <Col span={6}>
                    <InputNumber
                      placeholder="数量"
                      min={1}
                      style={{ width: '100%' }}
                      value={item.quantity}
                      onChange={(value) => handleUpdateSaleItem(item.id, 'quantity', value || 1)}
                      addonAfter="个"
                    />
                  </Col>
                  <Col span={6}>
                    <InputNumber
                      placeholder="单价"
                      min={0}
                      step={0.01}
                      style={{ width: '100%' }}
                      value={item.unit_price}
                      onChange={(value) => handleUpdateSaleItem(item.id, 'unit_price', value || 0)}
                      addonBefore="¥"
                    />
                  </Col>
                  <Col span={2}>
                    <Button
                      type="text"
                      danger
                      icon={<MinusCircleOutlined />}
                      onClick={() => handleRemoveSaleItem(item.id)}
                    />
                  </Col>
                </Row>
              </Card>
            ))}
            <div style={{ marginTop: 8, color: '#666', fontSize: 12 }}>
              总数量: {saleItems.reduce((sum, item) => sum + item.quantity, 0)} 个 | 
              预估金额: ¥{saleItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0).toFixed(2)}
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
