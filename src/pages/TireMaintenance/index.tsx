import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Tag, Modal, Form, Input, Select, DatePicker, message, Descriptions, App, Row, Col, InputNumber, Switch } from 'antd';
import { PlusOutlined, ToolOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import client from '../../api/client';
import dayjs from 'dayjs';
import useAuthStore from '../../store/auth';
import useCompanyStore from '../../store/company';
import ResizableTitle from '../../components/ResizableTitle';

const { Option } = Select;
const { TextArea } = Input;

interface MaintenanceRecord {
  id: number;
  tire_code: string;
  vehicle_plate?: string;
  item_name?: string;
  maintenance_type: string;
  maintenance_date: string;
  cost?: number;
  service_provider?: string;
  notes?: string;
}

interface TireOption {
  id: number;
  tire_code: string;
  tire_serial_no?: string;
  brand: string;
  model: string;
  vehicle_plate?: string;
  status: string;
  purpose?: string;
}

const TireMaintenance: React.FC = () => {
  const { modal } = App.useApp();
  const { user } = useAuthStore();
  const { selectedCompanyId } = useCompanyStore();
  
  const isSuperAdmin = user?.role === 'super_admin';
  const effectiveCompanyId = isSuperAdmin ? selectedCompanyId : user?.companyId;
  
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MaintenanceRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  
  const [createVisible, setCreateVisible] = useState(false);
  const [createForm] = Form.useForm();
  const [maintenanceType, setMaintenanceType] = useState<string>('');
  
  const [editVisible, setEditVisible] = useState(false);
  const [editForm] = Form.useForm();
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // 轮胎选项
  const [tireOptions, setTireOptions] = useState<TireOption[]>([]);
  const selectedVehiclePlate = Form.useWatch('vehicle_plate_filter', createForm);
  
  // 筛选条件
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
  const [itemNameFilter, setItemNameFilter] = useState<string>('轮胎');
  
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

  const fetchTireOptions = async () => {
    try {
      const params: any = { status: 'in_use', purpose: 'self_use', page_size: 100 };
      if (effectiveCompanyId) {
        params.company_id = effectiveCompanyId;
      }
      const res = await client.get('/tires/inventory', {
        params
      });
      if (res.data.success) {
        setTireOptions(res.data.data.tires);
      }
    } catch (error) {
      console.error('获取轮胎列表失败:', error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: any = { page, page_size: pageSize };
      if (typeFilter) params.maintenance_type = typeFilter;
      if (itemNameFilter) params.item_name = itemNameFilter;
      if (effectiveCompanyId) params.company_id = effectiveCompanyId;

      const res = await client.get('/tires/maintenance', { params });

      if (res.data.success) {
        setData(res.data.data.records);
        setTotal(res.data.data.total);
      }
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (values: any) => {
    try {
      await client.post(
        '/tires/maintenance',
        {
          ...values,
          maintenance_date: values.maintenance_date.format('YYYY-MM-DD')
        },
        {
          params: effectiveCompanyId ? { company_id: effectiveCompanyId } : undefined,
        }
      );

      message.success('维护记录创建成功');
      setCreateVisible(false);
      createForm.resetFields();
      setMaintenanceType('');
      fetchData();
    } catch (error: any) {
      message.error(error.response?.data?.message || '创建失败');
    }
  };

  const handleEdit = (record: MaintenanceRecord) => {
    setEditingId(record.id);
    editForm.setFieldsValue({
      ...record,
      maintenance_date: dayjs(record.maintenance_date),
    });
    setEditVisible(true);
  };

  const handleUpdate = async (values: any) => {
    try {
      await client.put(
        `/tires/maintenance/${editingId}`,
        {
          ...values,
          maintenance_date: values.maintenance_date.format('YYYY-MM-DD')
        },
        {
          params: effectiveCompanyId ? { company_id: effectiveCompanyId } : undefined,
        }
      );
      message.success('维护记录更新成功');
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
      content: '确定要删除这条维护记录吗？此操作不可恢复。',
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await client.delete(`/tires/maintenance/${id}`, {
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
  }, [page, pageSize, typeFilter, itemNameFilter, effectiveCompanyId]);

  useEffect(() => {
    if (createVisible) {
      fetchTireOptions();
    }
  }, [createVisible]);

  const filteredTireOptions = selectedVehiclePlate
    ? tireOptions.filter((tire) => tire.vehicle_plate === selectedVehiclePlate)
    : tireOptions;

  const vehiclePlateOptions = Array.from(
    new Set(tireOptions.map((tire) => tire.vehicle_plate).filter(Boolean))
  ) as string[];

  const maintenanceTypeMap: Record<string, { text: string; color: string }> = {
    repair: { text: '补胎', color: 'red' },
    rotation: { text: '换位', color: 'blue' },
    inflation: { text: '充气', color: 'green' },
    inspection: { text: '检查', color: 'orange' },
    balance: { text: '动平衡', color: 'purple' },
    alignment: { text: '四轮定位', color: 'cyan' },
  };

  const columns: ColumnsType<MaintenanceRecord> = [
    {
      title: '维护日期',
      dataIndex: 'maintenance_date',
      key: 'maintenance_date',
      width: 120,
    },
    {
      title: '轮胎编号',
      dataIndex: 'tire_code',
      key: 'tire_code',
      width: 180,
    },
    {
      title: '车牌号',
      dataIndex: 'vehicle_plate',
      key: 'vehicle_plate',
      width: 120,
    },
    {
      title: '物品名称',
      dataIndex: 'item_name',
      key: 'item_name',
      width: 100,
      render: (name: string) => name ? <Tag color="blue">{name}</Tag> : '-',
    },
    {
      title: '维护类型',
      dataIndex: 'maintenance_type',
      key: 'maintenance_type',
      width: 120,
      render: (type: string) => (
        <Tag color={maintenanceTypeMap[type]?.color}>{maintenanceTypeMap[type]?.text}</Tag>
      ),
    },
    {
      title: '费用',
      dataIndex: 'cost',
      key: 'cost',
      width: 100,
      render: (cost: number) => cost ? `¥${cost.toFixed(2)}` : '-',
    },
    {
      title: '服务商',
      dataIndex: 'service_provider',
      key: 'service_provider',
      width: 150,
    },
    {
      title: '备注',
      dataIndex: 'notes',
      key: 'notes',
      width: 220,
      ellipsis: true,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="维护管理"
        extra={
          <Space>
            <Select
              placeholder="物品名称"
              style={{ width: 120 }}
              value={itemNameFilter}
              onChange={(val) => setItemNameFilter(val || '轮胎')}
            >
              <Option value="轮胎">轮胎</Option>
              <Option value="垫带">垫带</Option>
              <Option value="内胎">内胎</Option>
              <Option value="钢圈">钢圈</Option>
            </Select>
            <Select
              placeholder="维护类型"
              style={{ width: 120 }}
              allowClear
              value={typeFilter}
              onChange={setTypeFilter}
            >
              <Option value="repair">补胎</Option>
              <Option value="rotation">换位</Option>
              <Option value="inflation">充气</Option>
              <Option value="inspection">检查</Option>
              <Option value="balance">动平衡</Option>
              <Option value="alignment">四轮定位</Option>
            </Select>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateVisible(true)}>
              新建维护记录
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
          scroll={{ x: 1010 }}
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

      {/* 创建维护记录弹窗 */}
      <Modal
        title="新建维护记录"
        open={createVisible}
        onCancel={() => {
          setCreateVisible(false);
          createForm.resetFields();
          setMaintenanceType('');
        }}
        onOk={() => createForm.submit()}
        width={700}
      >
        <Form 
          form={createForm} 
          onFinish={handleCreate} 
          layout="vertical"
          onValuesChange={(changedValues) => {
            if (changedValues.maintenance_type) {
              setMaintenanceType(changedValues.maintenance_type);
            }
            if (Object.prototype.hasOwnProperty.call(changedValues, 'vehicle_plate_filter')) {
              createForm.setFieldValue('tire_id', undefined);
            }
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="vehicle_plate_filter" label="车牌号筛选">
                <Select
                  placeholder="请先选择车牌号"
                  allowClear
                  showSearch
                  optionFilterProp="children"
                >
                  {vehiclePlateOptions.map((plate) => (
                    <Option key={plate} value={plate}>
                      {plate}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="tire_id" label="选择轮胎" rules={[{ required: true, message: '请选择轮胎' }]}>
                <Select
                  placeholder={selectedVehiclePlate ? '请选择该车辆的自用轮胎' : '请先选择车牌号或直接选择自用轮胎'}
                  showSearch
                  optionFilterProp="children"
                  filterOption={(input, option) => {
                    if (!option?.children) return false;
                    const label = String(option.children);
                    return label.toLowerCase().includes(input.toLowerCase());
                  }}
                >
                  {filteredTireOptions.map(tire => (
                    <Option key={tire.id} value={tire.id}>
                      {(tire.tire_serial_no || tire.tire_code)} - {tire.brand} {tire.model} ({tire.vehicle_plate || '未安装'})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="maintenance_type" label="维护类型" rules={[{ required: true, message: '请选择维护类型' }]}>
                <Select placeholder="请选择维护类型">
                  <Option value="repair">补胎</Option>
                  <Option value="rotation">换位</Option>
                  <Option value="inflation">充气</Option>
                  <Option value="inspection">检查</Option>
                  <Option value="balance">动平衡</Option>
                  <Option value="alignment">四轮定位</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="maintenance_date" label="维护日期" rules={[{ required: true, message: '请选择维护日期' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="mileage" label="当前里程(km)">
                <InputNumber style={{ width: '100%' }} min={0} placeholder="请输入当前里程" />
              </Form.Item>
            </Col>
          </Row>

          {/* 补胎专用字段 */}
          {maintenanceType === 'repair' && (
            <>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="repair_location" label="补胎位置">
                    <Input placeholder="如：胎面中部" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="repair_type" label="补胎方式">
                    <Select placeholder="请选择">
                      <Option value="patch">贴片</Option>
                      <Option value="plug">胶条</Option>
                      <Option value="combination">贴片+胶条</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="damage_type" label="损伤类型">
                    <Select placeholder="请选择">
                      <Option value="puncture">扎钉</Option>
                      <Option value="cut">割伤</Option>
                      <Option value="sidewall">侧壁损伤</Option>
                      <Option value="other">其他</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

          {/* 换位专用字段 */}
          {maintenanceType === 'rotation' && (
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="old_position" label="原位置">
                  <Select placeholder="请选择原位置">
                    <Option value="front_left">左前</Option>
                    <Option value="front_right">右前</Option>
                    <Option value="rear_left">左后</Option>
                    <Option value="rear_right">右后</Option>
                    <Option value="spare">备胎</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="new_position" label="新位置">
                  <Select placeholder="请选择新位置">
                    <Option value="front_left">左前</Option>
                    <Option value="front_right">右前</Option>
                    <Option value="rear_left">左后</Option>
                    <Option value="rear_right">右后</Option>
                    <Option value="spare">备胎</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          )}

          {/* 充气专用字段 */}
          {maintenanceType === 'inflation' && (
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="pressure_before" label="充气前压力(bar)">
                  <InputNumber style={{ width: '100%' }} min={0} step={0.1} placeholder="充气前压力" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="pressure_after" label="充气后压力(bar)">
                  <InputNumber style={{ width: '100%' }} min={0} step={0.1} placeholder="充气后压力" />
                </Form.Item>
              </Col>
            </Row>
          )}

          {/* 检查专用字段 */}
          {maintenanceType === 'inspection' && (
            <>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="tread_depth" label="胎纹深度(mm)">
                    <InputNumber style={{ width: '100%' }} min={0} step={0.1} placeholder="胎纹深度" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="wear_level" label="磨损程度(%)">
                    <InputNumber style={{ width: '100%' }} min={0} max={100} placeholder="磨损程度" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="crack_detected" label="是否有裂纹" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="bulge_detected" label="是否有鼓包" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="cost" label="费用">
                <InputNumber style={{ width: '100%' }} min={0} step={0.01} placeholder="请输入费用" addonBefore="¥" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="service_provider" label="服务商">
                <Input placeholder="请输入服务商名称" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="technician" label="技师">
            <Input placeholder="请输入技师姓名" />
          </Form.Item>

          <Form.Item name="notes" label="备注">
            <TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑维护记录弹窗 */}
      <Modal
        title="编辑维护记录"
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
          <Form.Item name="maintenance_date" label="维护日期" rules={[{ required: true, message: '请选择维护日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="maintenance_type" label="维护类型" rules={[{ required: true, message: '请选择维护类型' }]}>
            <Select placeholder="请选择维护类型">
              <Option value="repair">补胎</Option>
              <Option value="rotation">换位</Option>
              <Option value="inflation">充气</Option>
              <Option value="inspection">检查</Option>
              <Option value="balance">动平衡</Option>
              <Option value="alignment">四轮定位</Option>
            </Select>
          </Form.Item>

          <Form.Item name="cost" label="费用" rules={[{ required: true, message: '请输入费用' }]}>
            <InputNumber placeholder="费用" min={0} step={0.01} style={{ width: '100%' }} addonBefore="¥" />
          </Form.Item>

          <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="请输入维护描述" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TireMaintenance;
