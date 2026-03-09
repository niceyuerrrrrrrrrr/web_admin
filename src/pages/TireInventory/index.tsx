import React, { useState, useEffect, useMemo } from 'react';
import { Card, Table, Button, Space, Tag, Modal, Form, Input, Select, DatePicker, InputNumber, message, Descriptions, Tabs, Row, Col, Statistic, Drawer, Checkbox, Upload } from 'antd';
import { PlusOutlined, EyeOutlined, CarOutlined, SearchOutlined, DollarOutlined, SettingOutlined, HolderOutlined, CameraOutlined } from '@ant-design/icons';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ColumnsType } from 'antd/es/table';
import client from '../../api/client';
import dayjs from 'dayjs';
import SaleModal from './SaleModal';
import useAuthStore from '../../store/auth';
import useCompanyStore from '../../store/company';
import ResizableTitle from '../../components/ResizableTitle';

const { Search } = Input;
const { Option } = Select;
const { TabPane } = Tabs;

interface TireInventory {
  id: number;
  tire_code: string;
  tire_serial_no?: string;
  batch_id?: number;
  batch_no?: string;
  item_name?: string;
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

interface BatchGroup {
  batch_no: string;
  batch_id: number;
  item_name?: string;
  brand: string;
  model: string;
  specification: string;
  count: number;
  tires: TireInventory[];
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
  item_breakdown?: Array<{
    item_name: string;
    total: number;
    in_stock: number;
    in_use: number;
    sold: number;
    scrapped: number;
  }>;
}

const TireInventory: React.FC = () => {
  const { user } = useAuthStore();
  const { selectedCompanyId } = useCompanyStore();
  
  const isSuperAdmin = user?.role === 'super_admin';
  const effectiveCompanyId = isSuperAdmin ? selectedCompanyId : user?.companyId;
  
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TireInventory[]>([]);
  const [groupedData, setGroupedData] = useState<BatchGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [viewMode, setViewMode] = useState<'grouped' | 'list'>('grouped');
  const [stats, setStats] = useState<Stats>({ total: 0, in_stock: 0, in_use: 0, sold: 0, scrapped: 0 });
  
  // 列显示设置
  const [columnSettingsVisible, setColumnSettingsVisible] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    tire_code: true,
    tire_serial_no: true,
    batch_no: true,
    item_name: true,
    brand: true,
    model: true,
    specification: true,
    status: true,
    purpose: true,
    vehicle_plate: true,
    install_position: true,
    wear_level: true,
    purchase_price: true,
  });
  
  // 列顺序
  const [columnOrder, setColumnOrder] = useState<string[]>([
    'tire_code',
    'tire_serial_no',
    'batch_no',
    'item_name',
    'brand',
    'model',
    'specification',
    'status',
    'purpose',
    'vehicle_plate',
    'install_position',
    'wear_level',
    'purchase_price',
  ]);
  
  // 筛选条件
  const [filters, setFilters] = useState({
    status: undefined as string | undefined,
    purpose: undefined as string | undefined,
    item_name: undefined as string | undefined,
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

  // 销售弹窗
  const [saleVisible, setSaleVisible] = useState(false);
  const [saleForm] = Form.useForm();
  const [saleSubmitting, setSaleSubmitting] = useState(false);
  
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

  // 车辆列表
  const [vehicles, setVehicles] = useState<any[]>([]);

  // 获取统计数据
  const fetchStats = async () => {
    try {
      const params: any = {};
      if (effectiveCompanyId) {
        params.company_id = effectiveCompanyId;
      }
      
      const res = await client.get('/tires/inventory/stats', { params });
      if (res.data.success) {
        setStats(res.data.data);
      }
    } catch (error) {
      console.error('获取统计失败:', error);
    }
  };

  // 获取车辆列表
  const fetchVehicles = async () => {
    try {
      const params: any = { page: 1, page_size: 200 };
      if (effectiveCompanyId) {
        params.company_id = effectiveCompanyId;
      }
      
      const res = await client.get('/vehicles/list', { params });
      if (res.data.success) {
        const vehicleList = res.data.data.vehicles || [];
        console.log('获取到的车辆列表:', vehicleList, '公司ID:', effectiveCompanyId);
        setVehicles(vehicleList);
      }
    } catch (error) {
      console.error('获取车辆列表失败:', error);
    }
  };

  // 获取列表数据
  const fetchData = async () => {
    setLoading(true);
    try {
      const params: any = { page, page_size: pageSize };
      if (filters.status) params.status = filters.status;
      if (filters.purpose) params.purpose = filters.purpose;
      if (filters.item_name) params.item_name = filters.item_name;
      if (filters.brand) params.brand = filters.brand;
      if (filters.specification) params.specification = filters.specification;
      if (filters.vehicle_plate) params.vehicle_plate = filters.vehicle_plate;
      
      // 添加公司隔离
      if (effectiveCompanyId) {
        params.company_id = effectiveCompanyId;
      }

      const res = await client.get('/tires/inventory', { params });

      if (res.data.success) {
        const tires = res.data.data.tires;
        setData(tires);
        setTotal(res.data.data.total);
        
        // 按批次分组
        const grouped = tires.reduce((acc: Record<string, BatchGroup>, tire: TireInventory) => {
          const batchKey = tire.batch_no || 'unknown';
          if (!acc[batchKey]) {
            acc[batchKey] = {
              batch_no: tire.batch_no || '未知批次',
              batch_id: tire.batch_id || 0,
              item_name: tire.item_name,
              brand: tire.brand,
              model: tire.model,
              specification: tire.specification,
              count: 0,
              tires: []
            };
          }
          acc[batchKey].count++;
          acc[batchKey].tires.push(tire);
          return acc;
        }, {});
        
        setGroupedData(Object.values(grouped));
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

  // 销售轮胎
  const handleSale = async (values: any) => {
    if (saleSubmitting) return;

    try {
      setSaleSubmitting(true);

      const res = await client.post('/tires/sales', {
        tire_ids: [values.tire_id],
        total_amount: values.sale_price,
        payment_method: values.payment_method || 'cash',
        customer_name: values.customer_name,
        customer_phone: values.customer_phone,
        notes: values.notes,
        sale_date: values.sale_date.format('YYYY-MM-DD')
      });

      if (!res.data?.success) {
        message.error(res.data?.message || '销售失败');
        return;
      }

      message.success('销售成功');
      setSaleVisible(false);
      saleForm.resetFields();
      fetchData();
      fetchStats();
    } catch (error: any) {
      message.error(error.response?.data?.message || '销售失败');
    } finally {
      setSaleSubmitting(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchStats();
    fetchVehicles();
  }, [page, pageSize, filters, effectiveCompanyId]);
  
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

  // 展开行渲染
  const expandedRowRender = (record: BatchGroup) => {
    return (
      <Table
        columns={mergeColumns(columns)}
        dataSource={record.tires}
        pagination={false}
        rowKey="id"
        size="small"
        className="resizable-table"
        components={{
          header: {
            cell: ResizableTitle,
          },
        }}
        style={{ margin: '0 48px' }}
      />
    );
  };

  // 批次分组表格列
  const batchColumns: ColumnsType<BatchGroup> = [
    {
      title: '批次号',
      dataIndex: 'batch_no',
      key: 'batch_no',
      width: 180,
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: '名称',
      dataIndex: 'item_name',
      key: 'item_name',
      width: 100,
      render: (name: string) => name ? <Tag color="blue">{name}</Tag> : '-',
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
      title: '数量',
      dataIndex: 'count',
      key: 'count',
      width: 80,
      render: (count: number) => <Tag color="green">{count} 条</Tag>,
    },
  ];

  // 轮胎详细信息列（展开后显示）
  const allColumnsMap: Record<string, any> = {
    tire_code: {
      title: '采购编号',
      dataIndex: 'tire_code',
      key: 'tire_code',
      width: 200,
    },
    tire_serial_no: {
      title: '轮胎编号',
      dataIndex: 'tire_serial_no',
      key: 'tire_serial_no',
      width: 160,
      render: (text: string, record: TireInventory) => {
        if (record.item_name !== '轮胎') return '-';
        if (record.purpose !== 'self_use') return <Tag color="orange">销售轮胎无编号</Tag>;
        return text ? <Tag color="green">{text}</Tag> : <Tag color="red">未录入</Tag>;
      },
    },
    batch_no: {
      title: '采购批次',
      dataIndex: 'batch_no',
      key: 'batch_no',
      width: 150,
      render: (text: string) => text ? <Tag color="blue">{text}</Tag> : '-',
    },
    item_name: {
      title: '名称',
      dataIndex: 'item_name',
      key: 'item_name',
      width: 120,
      render: (name: string) => name ? <strong style={{ color: '#1890ff' }}>{name}</strong> : '-',
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
    status: {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={statusMap[status]?.color}>{statusMap[status]?.text}</Tag>
      ),
    },
    purpose: {
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
    vehicle_plate: {
      title: '车牌号',
      dataIndex: 'vehicle_plate',
      key: 'vehicle_plate',
      width: 120,
    },
    install_position: {
      title: '安装位置',
      dataIndex: 'install_position',
      key: 'install_position',
      width: 100,
      render: (pos: string) => pos ? positionMap[pos] : '-',
    },
    wear_level: {
      title: '磨损程度',
      dataIndex: 'wear_level',
      key: 'wear_level',
      width: 100,
      render: (level: number) => `${level}%`,
    },
    purchase_price: {
      title: '采购价',
      dataIndex: 'purchase_price',
      key: 'purchase_price',
      width: 100,
      render: (price: number) => `¥${price.toFixed(2)}`,
    },
  };
  
  const actionColumn = {
    title: '操作',
    key: 'action',
    width: 180,
    fixed: 'right' as const,
    render: (_: any, record: TireInventory) => (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' }}>
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => fetchDetail(record.id)} style={{ padding: 0, height: 'auto' }}>
          详情
        </Button>
        {record.status === 'in_stock' && record.item_name === '轮胎' && (
          <Button
            type="link"
            size="small"
            icon={<CarOutlined />}
            onClick={() => {
              setCurrentTireId(record.id);
              setInstallVisible(true);
            }}
            style={{ padding: 0, height: 'auto' }}
          >
            安装
          </Button>
        )}
        {record.status === 'in_stock' && (
          <Button
            type="link"
            size="small"
            icon={<DollarOutlined />}
            onClick={() => {
              setCurrentTireId(record.id);
              saleForm.setFieldsValue({
                tire_id: record.id,
                tire_code: record.tire_code,
                brand: record.brand,
                model: record.model,
                specification: record.specification,
                cost_price: record.purchase_price,
                payment_method: 'cash',
                sale_date: dayjs(),
              });
              setSaleVisible(true);
            }}
            style={{ padding: 0, height: 'auto', gridColumn: record.item_name === '轮胎' ? 'auto' : 'span 2' }}
          >
            出售
          </Button>
        )}
        {record.status === 'in_use' && record.item_name === '轮胎' && (
          <Button
            type="link"
            size="small"
            onClick={() => {
              setCurrentTireId(record.id);
              setRemoveVisible(true);
            }}
            style={{ padding: 0, height: 'auto', gridColumn: 'span 2' }}
          >
            拆卸
          </Button>
        )}
      </div>
    ),
  };
  
  const allColumns: ColumnsType<TireInventory> = [
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
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Card>
            <Statistic title="总库存" value={stats.total} suffix="个" />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic title="在库" value={stats.in_stock} suffix="个" valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic title="使用中" value={stats.in_use} suffix="个" valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic title="已售出" value={stats.sold} suffix="个" valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic title="已报废" value={stats.scrapped} suffix="个" valueStyle={{ color: '#f5222d' }} />
          </Card>
        </Col>
      </Row>
      
      {/* 按物品分类统计 */}
      {stats.item_breakdown && stats.item_breakdown.length > 0 && (
        <Card title="按物品分类库存统计" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            {stats.item_breakdown.map((item) => (
              <Col span={6} key={item.item_name}>
                <Card size="small">
                  <Statistic title={item.item_name} value={item.total} suffix="个" />
                  <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                    在库 {item.in_stock} | 使用中 {item.in_use} | 已售 {item.sold}
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      )}

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
            placeholder="名称"
            style={{ width: 120 }}
            allowClear
            value={filters.item_name}
            onChange={(value) => setFilters({ ...filters, item_name: value })}
          >
            <Option value="轮胎">轮胎</Option>
            <Option value="垫带">垫带</Option>
            <Option value="内胎">内胎</Option>
            <Option value="钢圈">钢圈</Option>
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
          <Button icon={<SettingOutlined />} onClick={() => setColumnSettingsVisible(true)}>
            列设置
          </Button>
        </Space>

        <div style={{ marginTop: 16, marginBottom: 16 }}>
          <Space>
            <span>显示模式：</span>
            <Button 
              type={viewMode === 'grouped' ? 'primary' : 'default'}
              onClick={() => setViewMode('grouped')}
            >
              按批次分组
            </Button>
            <Button 
              type={viewMode === 'list' ? 'primary' : 'default'}
              onClick={() => setViewMode('list')}
            >
              列表视图
            </Button>
          </Space>
        </div>

        {viewMode === 'grouped' ? (
          <Table
            columns={mergeColumns(batchColumns)}
            dataSource={groupedData}
            rowKey="batch_no"
            loading={loading}
            className="resizable-table"
            components={{
              header: {
                cell: ResizableTitle,
              },
            }}
            expandable={{
              expandedRowRender,
              defaultExpandAllRows: false,
            }}
            scroll={{ x: 740 }}
            pagination={{
              current: page,
              pageSize: pageSize,
              total: groupedData.length,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 个批次`,
              onChange: (page, pageSize) => {
                setPage(page);
                setPageSize(pageSize);
              },
            }}
          />
        ) : (
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
            scroll={{ x: 1670 }}
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
        )}
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
                <Descriptions.Item label="采购编号">{detailData.tire_code}</Descriptions.Item>
                <Descriptions.Item label="轮胎编号">{detailData.tire_serial_no || '-'}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={statusMap[detailData.status]?.color}>{statusMap[detailData.status]?.text}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="名称">{detailData.item_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="采购批次">{detailData.batch_no || '-'}</Descriptions.Item>
                <Descriptions.Item label="品牌">{detailData.brand}</Descriptions.Item>
                <Descriptions.Item label="型号">{detailData.model}</Descriptions.Item>
                <Descriptions.Item label="规格">{detailData.specification}</Descriptions.Item>
                <Descriptions.Item label="花纹">{detailData.pattern || '-'}</Descriptions.Item>
                <Descriptions.Item label="采购价">¥{detailData.purchase_price.toFixed(2)}</Descriptions.Item>
                <Descriptions.Item label="磨损程度">{detailData.wear_level}%</Descriptions.Item>
                {detailData.status === 'in_use' && (
                  <>
                    <Descriptions.Item label="用途">自用</Descriptions.Item>
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
                  { title: '轮胎编号', dataIndex: 'tire_serial_no', key: 'tire_serial_no', render: (v: string) => v || detailData.tire_serial_no || '-' },
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
          <Form.Item name="tire_serial_no" label="轮胎编号" rules={[{ required: true, message: '请输入轮胎编号' }]}> 
            <Input 
              placeholder="请输入轮胎上打印的编号" 
              suffix={
                <Button 
                  type="link" 
                  icon={<CameraOutlined />} 
                  size="small"
                  onClick={() => {
                    message.info('拍照识别功能开发中，请先手动输入编号');
                  }}
                >
                  拍照识别
                </Button>
              }
            />
          </Form.Item>
          <div style={{ marginBottom: 16, padding: 8, background: '#f0f2f5', borderRadius: 4, fontSize: 12, color: '#666' }}>
            <strong>说明：</strong>
            <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
              <li>自用轮胎需录入轮胎编号（一胎一编号）</li>
              <li>销售轮胎直接从厂家发出，无需录入编号</li>
              <li>垫带、内胎、钢圈只有型号，无需编号</li>
              <li>可手动输入或使用拍照识别功能</li>
            </ul>
          </div>
          <Form.Item name="vehicle_plate" label="车牌号" rules={[{ required: true, message: '请选择车牌号' }]}> 
            <Select 
              placeholder="请选择车牌号" 
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) => {
                const label = option?.children?.toString() || '';
                return label.toLowerCase().includes(input.toLowerCase());
              }}
            >
              {vehicles.map((vehicle: any, index: number) => (
                <Option key={vehicle.plate_number || index} value={vehicle.plate_number}>
                  {vehicle.plate_number}
                </Option>
              ))}
            </Select>
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

      {/* 销售弹窗 */}
      <SaleModal
        visible={saleVisible}
        onCancel={() => {
          setSaleVisible(false);
          saleForm.resetFields();
        }}
        confirmLoading={saleSubmitting}
        onSuccess={() => {
          fetchData();
          fetchStats();
        }}
        form={saleForm}
        onFinish={handleSale}
      />

      {/* 列设置抽屉 */}
      <Drawer
        title="列设置"
        placement="right"
        onClose={() => setColumnSettingsVisible(false)}
        open={columnSettingsVisible}
        width={400}
      >
        <div style={{ marginBottom: 16 }}>
          <h4>显示列</h4>
          <Space direction="vertical" style={{ width: '100%' }}>
            {Object.entries(allColumnsMap).map(([key, col]) => (
              <Checkbox
                key={key}
                checked={visibleColumns[key]}
                onChange={(e) => setVisibleColumns({ ...visibleColumns, [key]: e.target.checked })}
              >
                {col.title}
              </Checkbox>
            ))}
          </Space>
        </div>

        <div style={{ marginTop: 24 }}>
          <h4>列顺序（拖动调整）</h4>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={columnOrder}
              strategy={verticalListSortingStrategy}
            >
              {columnOrder.map((key) => (
                <SortableItem key={key} id={key}>
                  <Checkbox
                    checked={visibleColumns[key]}
                    onChange={(e) => setVisibleColumns({ ...visibleColumns, [key]: e.target.checked })}
                  >
                    {allColumnsMap[key]?.title}
                  </Checkbox>
                </SortableItem>
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </Drawer>
    </div>
  );
};

export default TireInventory;
