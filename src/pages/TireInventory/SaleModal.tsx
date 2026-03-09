import React from 'react';
import { Modal, Form, Input, InputNumber, DatePicker, Select, message } from 'antd';
import dayjs from 'dayjs';

interface SaleModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  form: any;
  onFinish: (values: any) => void;
  confirmLoading?: boolean;
}

const SaleModal: React.FC<SaleModalProps> = ({ visible, onCancel, form, onFinish, confirmLoading = false }) => {
  const handleConfirm = async () => {
    try {
      const values = await form.validateFields();
      if (!values?.tire_id) {
        message.error('轮胎ID丢失，请关闭弹窗后重新点击出售');
        return;
      }
      await Promise.resolve(onFinish(values));
    } catch (error: any) {
      if (error?.errorFields?.length) {
        const firstMessage = error.errorFields[0]?.errors?.[0] || '请完善销售信息后再提交';
        message.warning(firstMessage);
        return;
      }

      console.error('[SaleModal] 点击确定提交异常:', error);
      message.error('提交失败，请刷新页面后重试');
    }
  };

  return (
    <Modal
      title="销售轮胎"
      open={visible}
      onCancel={onCancel}
      onOk={handleConfirm}
      confirmLoading={confirmLoading}
      width={600}
    >
      <Form
        form={form}
        onFinish={onFinish}
        onFinishFailed={({ errorFields }) => {
          const firstMessage = errorFields?.[0]?.errors?.[0] || '请完善销售信息后再提交';
          message.warning(firstMessage);
        }}
        layout="vertical"
      >
        <Form.Item name="tire_id" hidden rules={[{ required: true, message: '轮胎ID缺失，请重新打开出售弹窗' }]}>
          <Input />
        </Form.Item>
        
        <Form.Item label="轮胎信息">
          <Input.Group compact>
            <Form.Item name="tire_code" noStyle>
              <Input style={{ width: '33%' }} disabled placeholder="轮胎编号" />
            </Form.Item>
            <Form.Item name="brand" noStyle>
              <Input style={{ width: '33%' }} disabled placeholder="品牌" />
            </Form.Item>
            <Form.Item name="model" noStyle>
              <Input style={{ width: '34%' }} disabled placeholder="型号" />
            </Form.Item>
          </Input.Group>
        </Form.Item>

        <Form.Item name="specification" label="规格">
          <Input disabled />
        </Form.Item>

        <Form.Item name="customer_name" label="客户名称" rules={[{ required: true, message: '请输入客户名称' }]}>
          <Input placeholder="请输入客户名称" />
        </Form.Item>

        <Form.Item name="customer_phone" label="客户电话">
          <Input placeholder="请输入客户电话" />
        </Form.Item>

        <Form.Item
          name="payment_method"
          label="付款方式"
          rules={[{ required: true, message: '请选择付款方式' }]}
          initialValue="cash"
        >
          <Select placeholder="请选择付款方式">
            <Select.Option value="cash">现金</Select.Option>
            <Select.Option value="wechat">微信</Select.Option>
            <Select.Option value="alipay">支付宝</Select.Option>
            <Select.Option value="bank">银行转账</Select.Option>
            <Select.Option value="credit">赊账</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item name="sale_date" label="销售日期" rules={[{ required: true, message: '请选择销售日期' }]} initialValue={dayjs()}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item label="价格信息">
          <Input.Group compact>
            <Form.Item name="cost_price" label="成本价" style={{ display: 'inline-block', width: '50%' }}>
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                step={0.01}
                disabled
                addonBefore="¥"
                placeholder="成本价"
              />
            </Form.Item>
            <Form.Item 
              name="sale_price" 
              label="销售价" 
              rules={[{ required: true, message: '请输入销售价格' }]}
              style={{ display: 'inline-block', width: '50%', marginLeft: 0 }}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                step={0.01}
                addonBefore="¥"
                placeholder="销售价"
              />
            </Form.Item>
          </Input.Group>
        </Form.Item>

        <Form.Item name="notes" label="备注">
          <Input.TextArea rows={3} placeholder="请输入备注信息" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default SaleModal;
