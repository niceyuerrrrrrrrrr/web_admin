import React, { useState } from 'react';
import { Modal, Form, InputNumber, DatePicker, Select, Input, Radio } from 'antd';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

interface PaymentModalProps {
  visible: boolean;
  batch: any;
  accounts: any[];
  form: any;
  onCancel: () => void;
  onSubmit: (values: any) => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({
  visible,
  batch,
  accounts,
  form,
  onCancel,
  onSubmit,
}) => {
  const [paymentType, setPaymentType] = useState<string>('immediate');

  if (!batch) return null;

  const remainingAmount = batch.total_amount - batch.paid_amount;

  return (
    <Modal
      title="采购付款"
      open={visible}
      onCancel={onCancel}
      onOk={() => form.submit()}
      width={600}
    >
      <Form
        form={form}
        onFinish={onSubmit}
        layout="vertical"
        initialValues={{ payment_type: 'immediate' }}
      >
        <Form.Item label="采购批次">
          <Input value={batch.batch_no} disabled />
        </Form.Item>

        <Form.Item label="供应商">
          <Input value={batch.supplier_name} disabled />
        </Form.Item>

        <Form.Item label="采购总额">
          <Input value={`¥${batch.total_amount.toFixed(2)}`} disabled />
        </Form.Item>

        <Form.Item label="已付金额">
          <Input value={`¥${batch.paid_amount.toFixed(2)}`} disabled />
        </Form.Item>

        <Form.Item label="未付金额">
          <Input value={`¥${remainingAmount.toFixed(2)}`} disabled />
        </Form.Item>

        <Form.Item
          label="付款类型"
          name="payment_type"
          rules={[{ required: true, message: '请选择付款类型' }]}
        >
          <Radio.Group onChange={(e) => setPaymentType(e.target.value)}>
            <Radio value="immediate">现付（立即付款）</Radio>
            <Radio value="deferred">分期（记账后续付款）</Radio>
          </Radio.Group>
        </Form.Item>

        {paymentType === 'immediate' && (
          <>
            <Form.Item
              label="付款金额"
              name="pay_amount"
              rules={[
                { required: true, message: '请输入付款金额' },
                {
                  validator: (_, value) => {
                    if (value > remainingAmount) {
                      return Promise.reject(new Error(`付款金额不能超过未付金额 ¥${remainingAmount.toFixed(2)}`));
                    }
                    if (value <= 0) {
                      return Promise.reject(new Error('付款金额必须大于0'));
                    }
                    return Promise.resolve();
                  },
                },
              ]}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                max={remainingAmount}
                step={0.01}
                precision={2}
                placeholder="请输入付款金额"
                addonBefore="¥"
              />
            </Form.Item>

            <Form.Item
              label="付款日期"
              name="pay_date"
              rules={[{ required: paymentType === 'immediate', message: '请选择付款日期' }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              label="付款方式"
              name="pay_method"
              rules={[{ required: paymentType === 'immediate', message: '请选择付款方式' }]}
            >
              <Select placeholder="请选择付款方式">
                <Option value="bank">银行转账</Option>
                <Option value="cash">现金</Option>
                <Option value="wechat">微信</Option>
                <Option value="alipay">支付宝</Option>
                <Option value="other">其他</Option>
              </Select>
            </Form.Item>

            <Form.Item
              label="付款账户"
              name="account_id"
              rules={[{ required: paymentType === 'immediate', message: '请选择付款账户' }]}
            >
              <Select placeholder="请选择付款账户">
                {accounts.map((account) => (
                  <Option key={account.id} value={account.id}>
                    {account.name} {account.type ? `(${account.type})` : ''}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </>
        )}

        {paymentType === 'deferred' && (
          <Form.Item
            label="应付到期日"
            name="due_date"
          >
            <DatePicker style={{ width: '100%' }} placeholder="选择到期日（可选）" />
          </Form.Item>
        )}

        <Form.Item label="备注" name="remark">
          <TextArea rows={3} placeholder="请输入备注信息" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default PaymentModal;
