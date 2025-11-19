import { Button, Result } from 'antd'
import { useNavigate } from 'react-router-dom'

const NotFoundPage = () => {
  const navigate = useNavigate()

  return (
    <Result
      status="404"
      title="页面不存在"
      subTitle="请检查访问的地址或返回工作台"
      extra={
        <Button type="primary" onClick={() => navigate('/')}>返回首页</Button>
      }
    />
  )
}

export default NotFoundPage
