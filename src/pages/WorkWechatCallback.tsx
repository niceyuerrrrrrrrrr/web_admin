import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { message, Spin } from 'antd';
import useAuthStore from '../store/auth';

/**
 * 企业微信授权回调页面
 */
function WorkWechatCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      
      if (!code) {
        message.error('授权失败，未获取到授权码');
        navigate('/login');
        return;
      }

      try {
        // 调用后端登录接口
        const response = await fetch(
          `https://api.hodaruner.cn/api/v1/work-wechat-auth/login?code=${code}`
        );
        const result = await response.json();

        if (result.success) {
          // 保存token和用户信息
          setAuth({
            token: result.data.token,
            user: {
              name: result.data.user.nickname || result.data.user.username,
              role: result.data.user.role,
              email: result.data.user.mobile,
            }
          });
          
          message.success('登录成功');
          navigate('/');
        } else {
          message.error(result.message || '登录失败');
          navigate('/login');
        }
      } catch (error) {
        console.error('登录失败:', error);
        message.error('登录失败，请重试');
        navigate('/login');
      }
    };

    handleCallback();
  }, [searchParams, navigate, setAuth]);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      flexDirection: 'column',
      gap: 16
    }}>
      <Spin size="large" />
      <div style={{ color: '#666' }}>正在登录...</div>
    </div>
  );
}

export default WorkWechatCallback;
