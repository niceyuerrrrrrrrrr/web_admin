import { App as AntdApp, Button, Card, Form, Input, Typography, Divider } from 'antd'
import { LockOutlined, UserOutlined, WechatOutlined } from '@ant-design/icons'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { login } from '../api/services/auth'
import useAuthStore from '../store/auth'

const { Title, Paragraph } = Typography

const LoginPage = () => {
  const [form] = Form.useForm()
  const { message } = AntdApp.useApp()
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      setAuth({
        token: data.token,
        user: {
          name: data.user.name || data.user.nickname || data.user.phone || '管理员',
          role: data.user.role || data.user.positionType || '管理员',
          positionType: data.user.positionType || data.user.position_type,
          email: data.user.phone,
          companyId: data.user.companyId,
          companyBusinessType: data.user.companyBusinessType,
        },
      })
      message.success('登录成功')
      navigate('/dashboard', { replace: true })
    },
    onError: (error) => {
      message.error((error as Error).message || '登录失败，请稍后重试')
    },
  })

  const handleFinish = (values: { phone: string; password: string }) => {
    loginMutation.mutate({
      phone: values.phone,
      password: values.password,
    })
  }

  const handleWorkWechatLogin = async () => {
    try {
      const redirectUri = encodeURIComponent(
        `${window.location.origin}/work-wechat-callback`
      )
      
      const response = await fetch(
        `/api/v1/work-wechat-auth/get-auth-url?redirect_uri=${redirectUri}`
      )
      const result = await response.json()
      
      if (result.success) {
        window.location.href = result.data.auth_url
      } else {
        message.error('获取授权URL失败')
      }
    } catch (error) {
      console.error('获取授权URL失败:', error)
      message.error('网络错误，请重试')
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #e1f0ff 0%, #f5f7fb 100%)',
        padding: 24,
      }}
    >
      <Card style={{ width: 360 }}>
        <Title level={3} style={{ textAlign: 'center' }}>
          后台登录
        </Title>
        <Paragraph style={{ textAlign: 'center' }} type="secondary">
          使用总经理/财务等账号从 PC 端接入业务能力
        </Paragraph>
        <Form form={form} layout="vertical" onFinish={handleFinish}>
          <Form.Item label="手机号" name="phone" rules={[{ required: true, message: '请输入手机号' }]}>
            <Input prefix={<UserOutlined />} placeholder="请输入手机号" />
          </Form.Item>
          <Form.Item label="密码" name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="登录密码" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loginMutation.isPending}>
            登录
          </Button>
          
          <Divider plain style={{ margin: '16px 0' }}>或</Divider>
          
          <Button
            type="default"
            icon={<WechatOutlined style={{ color: '#07C160' }} />}
            onClick={handleWorkWechatLogin}
            block
            style={{ 
              borderColor: '#07C160',
              color: '#07C160'
            }}
          >
            企业微信登录
          </Button>
        </Form>
      </Card>
    </div>
  )
}

export default LoginPage
