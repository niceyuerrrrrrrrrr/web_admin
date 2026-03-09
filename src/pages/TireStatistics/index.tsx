import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Select, DatePicker, Space, Spin } from 'antd';
import { CarOutlined, DollarOutlined, ShoppingOutlined, ToolOutlined, LineChartOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import client from '../../api/client';
import useAuthStore from '../../store/auth';
import useCompanyStore from '../../store/company';
import ResizableTitle from '../../components/ResizableTitle';

const { RangePicker } = DatePicker;
const { Option } = Select;

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

interface CostAnalysis {
  total_purchase_amount: number;
  total_purchase_count: number;
  average_unit_price: number;
  total_maintenance_cost: number;
  total_sales_amount: number;
  profit: number;
  item_analysis?: Array<{
    item_name: string;
    total_cost: number;
    count: number;
    avg_cost: number;
  }>;
}

interface BrandStats {
  brand: string;
  count: number;
  in_use: number;
  average_wear: number;
  average_mileage: number;
}

interface MaintenanceStats {
  maintenance_type: string;
  count: number;
  total_cost: number;
  average_cost: number;
}

const TireStatistics: React.FC = () => {
  const { user } = useAuthStore();
  const { selectedCompanyId } = useCompanyStore();
  
  const isSuperAdmin = user?.role === 'super_admin';
  const effectiveCompanyId = isSuperAdmin ? selectedCompanyId : user?.companyId;
  
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<Stats>({ total: 0, in_stock: 0, in_use: 0, sold: 0, scrapped: 0 });
  const [costAnalysis, setCostAnalysis] = useState<CostAnalysis>({
    total_purchase_amount: 0,
    total_purchase_count: 0,
    average_unit_price: 0,
    total_maintenance_cost: 0,
    total_sales_amount: 0,
    profit: 0,
  });
  const [brandStats, setBrandStats] = useState<BrandStats[]>([]);
  const [maintenanceStats, setMaintenanceStats] = useState<MaintenanceStats[]>([]);
  const [itemBreakdown, setItemBreakdown] = useState<NonNullable<Stats['item_breakdown']>>([]);
  const [itemCostAnalysis, setItemCostAnalysis] = useState<NonNullable<CostAnalysis['item_analysis']>>([]);
  
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

  const fetchInventoryStats = async () => {
    try {
      const params: any = {};
      if (effectiveCompanyId) {
        params.company_id = effectiveCompanyId;
      }
      const res = await client.get('/tires/inventory/stats', { params });
      if (res.data.success) {
        setStats(res.data.data);
        setItemBreakdown(res.data.data.item_breakdown || []);
      }
    } catch (error) {
      console.error('获取库存统计失败:', error);
    }
  };

  const fetchCostAnalysis = async () => {
    try {
      const params: any = { page: 1, page_size: 100 };
      if (effectiveCompanyId) {
        params.company_id = effectiveCompanyId;
      }

      const costRes = await client.get('/tires/cost-analysis', { params: { company_id: effectiveCompanyId } });

      // 获取采购统计
      const purchaseRes = await client.get('/tires/purchases', { params });

      // 获取维护统计
      const maintenanceRes = await client.get('/tires/maintenance', { params });

      // 获取销售统计
      const salesRes = await client.get('/tires/sales', { params });

      if (purchaseRes.data.success && maintenanceRes.data.success && salesRes.data.success) {
        const purchases = purchaseRes.data.data.batches || [];
        const maintenances = maintenanceRes.data.data.records || [];
        const sales = salesRes.data.data.sales || [];

        const totalPurchaseAmount = purchases.reduce((sum: number, p: any) => sum + (p.total_amount || 0), 0);
        const totalPurchaseCount = purchases.reduce((sum: number, p: any) => sum + (p.total_quantity || 0), 0);
        const totalMaintenanceCost = maintenances.reduce((sum: number, m: any) => sum + (m.cost || 0), 0);
        const totalSalesAmount = sales.reduce((sum: number, s: any) => sum + (s.total_amount || 0), 0);

        setCostAnalysis({
          total_purchase_amount: totalPurchaseAmount,
          total_purchase_count: totalPurchaseCount,
          average_unit_price: totalPurchaseCount > 0 ? totalPurchaseAmount / totalPurchaseCount : 0,
          total_maintenance_cost: totalMaintenanceCost,
          total_sales_amount: totalSalesAmount,
          profit: totalSalesAmount - totalPurchaseAmount - totalMaintenanceCost,
        });

        // 使用后端按物品成本统计数据
        if (costRes.data.success && Array.isArray(costRes.data.data?.item_analysis)) {
          setItemCostAnalysis(costRes.data.data.item_analysis);
        } else {
          setItemCostAnalysis([]);
        }
      }
    } catch (error) {
      console.error('获取成本分析失败:', error);
    }
  };

  const fetchBrandStats = async () => {
    try {
      const params: any = { page: 1, page_size: 100 };
      if (effectiveCompanyId) {
        params.company_id = effectiveCompanyId;
      }
      const res = await client.get('/tires/inventory', { params });

      if (res.data.success) {
        const tires = res.data.data.tires || [];
        const brandMap = new Map<string, any>();

        tires.forEach((tire: any) => {
          if (!brandMap.has(tire.brand)) {
            brandMap.set(tire.brand, {
              brand: tire.brand,
              count: 0,
              in_use: 0,
              total_wear: 0,
              total_mileage: 0,
              mileage_count: 0,
            });
          }

          const stat = brandMap.get(tire.brand);
          stat.count += 1;
          if (tire.status === 'in_use') {
            stat.in_use += 1;
            stat.total_wear += tire.wear_level || 0;
            if (tire.current_mileage && tire.install_mileage) {
              stat.total_mileage += (tire.current_mileage - tire.install_mileage);
              stat.mileage_count += 1;
            }
          }
        });

        const stats: BrandStats[] = Array.from(brandMap.values()).map(stat => ({
          brand: stat.brand,
          count: stat.count,
          in_use: stat.in_use,
          average_wear: stat.in_use > 0 ? Math.round(stat.total_wear / stat.in_use) : 0,
          average_mileage: stat.mileage_count > 0 ? Math.round(stat.total_mileage / stat.mileage_count) : 0,
        }));

        setBrandStats(stats);
      }
    } catch (error) {
      console.error('获取品牌统计失败:', error);
    }
  };

  const fetchMaintenanceStats = async () => {
    try {
      const params: any = { page: 1, page_size: 100 };
      if (effectiveCompanyId) {
        params.company_id = effectiveCompanyId;
      }
      const res = await client.get('/tires/maintenance', { params });

      if (res.data.success) {
        const records = res.data.data.records || [];
        const typeMap = new Map<string, any>();

        records.forEach((record: any) => {
          if (!typeMap.has(record.maintenance_type)) {
            typeMap.set(record.maintenance_type, {
              maintenance_type: record.maintenance_type,
              count: 0,
              total_cost: 0,
            });
          }

          const stat = typeMap.get(record.maintenance_type);
          stat.count += 1;
          stat.total_cost += record.cost || 0;
        });

        const stats: MaintenanceStats[] = Array.from(typeMap.values()).map(stat => ({
          maintenance_type: stat.maintenance_type,
          count: stat.count,
          total_cost: stat.total_cost,
          average_cost: stat.count > 0 ? stat.total_cost / stat.count : 0,
        }));

        setMaintenanceStats(stats);
      }
    } catch (error) {
      console.error('获取维护统计失败:', error);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchInventoryStats(),
      fetchCostAnalysis(),
      fetchBrandStats(),
      fetchMaintenanceStats(),
    ]).finally(() => {
      setLoading(false);
    });
  }, [effectiveCompanyId]);

  const maintenanceTypeMap: Record<string, string> = {
    repair: '补胎',
    rotation: '换位',
    inflation: '充气',
    inspection: '检查',
    balance: '动平衡',
    alignment: '四轮定位',
  };

  const brandColumns: ColumnsType<BrandStats> = [
    {
      title: '品牌',
      dataIndex: 'brand',
      key: 'brand',
      width: 160,
    },
    {
      title: '总数量',
      dataIndex: 'count',
      key: 'count',
      width: 100,
      render: (count: number) => `${count}条`,
    },
    {
      title: '使用中',
      dataIndex: 'in_use',
      key: 'in_use',
      width: 100,
      render: (count: number) => `${count}条`,
    },
    {
      title: '平均磨损',
      dataIndex: 'average_wear',
      key: 'average_wear',
      width: 120,
      render: (wear: number) => `${wear}%`,
    },
    {
      title: '平均使用里程',
      dataIndex: 'average_mileage',
      key: 'average_mileage',
      width: 160,
      render: (mileage: number) => mileage > 0 ? `${mileage.toLocaleString()} km` : '-',
    },
  ];

  const itemCostColumns: ColumnsType<any> = [
    { title: '物品名称', dataIndex: 'item_name', key: 'item_name', width: 120 },
    { title: '数量', dataIndex: 'count', key: 'count', width: 100, render: (v: number) => `${v}个` },
    { title: '总成本', dataIndex: 'total_cost', key: 'total_cost', width: 140, render: (v: number) => `¥${Number(v || 0).toFixed(2)}` },
    { title: '平均成本', dataIndex: 'avg_cost', key: 'avg_cost', width: 140, render: (v: number) => `¥${Number(v || 0).toFixed(2)}` },
  ];

  const maintenanceColumns: ColumnsType<MaintenanceStats> = [
    {
      title: '维护类型',
      dataIndex: 'maintenance_type',
      key: 'maintenance_type',
      width: 160,
      render: (type: string) => maintenanceTypeMap[type] || type,
    },
    {
      title: '次数',
      dataIndex: 'count',
      key: 'count',
      width: 100,
      render: (count: number) => `${count}次`,
    },
    {
      title: '总费用',
      dataIndex: 'total_cost',
      key: 'total_cost',
      width: 140,
      render: (cost: number) => `¥${cost.toFixed(2)}`,
    },
    {
      title: '平均费用',
      dataIndex: 'average_cost',
      key: 'average_cost',
      width: 140,
      render: (cost: number) => `¥${cost.toFixed(2)}`,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Spin spinning={loading}>
        {/* 库存统计 */}
        <Card title="库存概览" style={{ marginBottom: 24 }}>
          <Row gutter={16}>
            <Col span={4}>
              <Statistic
                title="总库存"
                value={stats.total}
                suffix="条"
                prefix={<CarOutlined />}
              />
            </Col>
            <Col span={5}>
              <Statistic
                title="在库"
                value={stats.in_stock}
                suffix="条"
                valueStyle={{ color: '#1890ff' }}
              />
            </Col>
            <Col span={5}>
              <Statistic
                title="使用中"
                value={stats.in_use}
                suffix="条"
                valueStyle={{ color: '#52c41a' }}
              />
            </Col>
            <Col span={5}>
              <Statistic
                title="已售出"
                value={stats.sold}
                suffix="条"
                valueStyle={{ color: '#faad14' }}
              />
            </Col>
            <Col span={5}>
              <Statistic
                title="已报废"
                value={stats.scrapped}
                suffix="条"
                valueStyle={{ color: '#f5222d' }}
              />
            </Col>
          </Row>
        </Card>

        {/* 物品成本统计 */}
        <Card title="按物品成本统计" style={{ marginBottom: 24 }}>
          <Table
            columns={mergeColumns(itemCostColumns)}
            dataSource={itemCostAnalysis}
            rowKey="item_name"
            className="resizable-table"
            components={{
              header: {
                cell: ResizableTitle,
              },
            }}
            scroll={{ x: 500 }}
            pagination={false}
          />
        </Card>

        {/* 物品分类库存统计 */}
        <Card title="按物品分类库存统计" style={{ marginBottom: 24 }}>
          <Row gutter={16}>
            {itemBreakdown.map((item) => (
              <Col span={6} key={item.item_name} style={{ marginBottom: 12 }}>
                <Card size="small">
                  <Statistic title={item.item_name} value={item.total} suffix="个" />
                  <div style={{ marginTop: 8, color: '#666', fontSize: 12 }}>
                    在库 {item.in_stock} / 使用中 {item.in_use} / 已售 {item.sold}
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>

        {/* 成本分析 */}
        <Card title="成本分析" style={{ marginBottom: 24 }}>
          <Row gutter={16}>
            <Col span={6}>
              <Statistic
                title="采购总额"
                value={costAnalysis.total_purchase_amount}
                precision={2}
                prefix="¥"
                suffix={`(${costAnalysis.total_purchase_count}条)`}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="平均单价"
                value={costAnalysis.average_unit_price}
                precision={2}
                prefix="¥"
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="维护总费用"
                value={costAnalysis.total_maintenance_cost}
                precision={2}
                prefix="¥"
                valueStyle={{ color: '#faad14' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="销售总额"
                value={costAnalysis.total_sales_amount}
                precision={2}
                prefix="¥"
                valueStyle={{ color: '#52c41a' }}
              />
            </Col>
          </Row>
          <Row gutter={16} style={{ marginTop: 24 }}>
            <Col span={24}>
              <Statistic
                title="总利润"
                value={costAnalysis.profit}
                precision={2}
                prefix="¥"
                valueStyle={{ 
                  color: costAnalysis.profit >= 0 ? '#52c41a' : '#f5222d',
                  fontSize: 32,
                }}
              />
              <div style={{ marginTop: 8, color: '#666' }}>
                利润 = 销售额 - 采购成本 - 维护费用
              </div>
            </Col>
          </Row>
        </Card>

        {/* 品牌统计 */}
        <Card title="品牌统计" style={{ marginBottom: 24 }}>
          <Table
            columns={mergeColumns(brandColumns)}
            dataSource={brandStats}
            rowKey="brand"
            className="resizable-table"
            components={{
              header: {
                cell: ResizableTitle,
              },
            }}
            scroll={{ x: 640 }}
            pagination={false}
          />
        </Card>

        {/* 维护统计 */}
        <Card title="维护统计">
          <Table
            columns={mergeColumns(maintenanceColumns)}
            dataSource={maintenanceStats}
            rowKey="maintenance_type"
            className="resizable-table"
            components={{
              header: {
                cell: ResizableTitle,
              },
            }}
            scroll={{ x: 540 }}
            pagination={false}
          />
        </Card>
      </Spin>
    </div>
  );
};

export default TireStatistics;
