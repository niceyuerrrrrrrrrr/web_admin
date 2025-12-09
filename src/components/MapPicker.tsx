import React, { useEffect, useRef, useState } from 'react'
import { Card, Input, Button, Space, App } from 'antd'
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons'

declare global {
  interface Window {
    AMap: any
  }
}

interface MapPickerProps {
  lng?: number
  lat?: number
  onChange?: (lng: number, lat: number, address?: string) => void
  height?: number
}

const MapPicker: React.FC<MapPickerProps> = ({ lng, lat, onChange, height = 400 }) => {
  const { message } = App.useApp()
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const [address, setAddress] = useState<string>('')
  const [searchKeyword, setSearchKeyword] = useState<string>('')
  const [isMapLoaded, setIsMapLoaded] = useState(false)

  // 加载高德地图API
  useEffect(() => {
    // 使用高德地图API key和安全密钥
    const AMAP_KEY = import.meta.env.VITE_AMAP_KEY || '444d2b89bef78bb8a2a4ab2412f3eb49'
    const AMAP_SECURITY_KEY = import.meta.env.VITE_AMAP_SECURITY_KEY || 'e71b88458a135cd876bda3636c3ae104'
    
    // 配置安全密钥（必须在加载脚本之前配置）
    if (AMAP_SECURITY_KEY && !(window as any)._AMapSecurityConfig) {
      ;(window as any)._AMapSecurityConfig = {
        securityJsCode: AMAP_SECURITY_KEY,
      }
    }
    
    // 如果已经加载过，直接初始化
    if (window.AMap) {
      setIsMapLoaded(true)
      setTimeout(() => {
        initMap()
      }, 100)
      return
    }

    // 检查是否已经加载过脚本
    const existingScript = document.querySelector(`script[src*="webapi.amap.com"]`)
    if (existingScript) {
      // 如果脚本已存在，等待加载完成
      const checkAMap = setInterval(() => {
        if (window.AMap) {
          clearInterval(checkAMap)
          setIsMapLoaded(true)
          setTimeout(() => {
            initMap()
          }, 100)
        }
      }, 100)
      
      // 10秒后超时
      setTimeout(() => {
        clearInterval(checkAMap)
        if (!window.AMap) {
          console.error('高德地图加载超时')
          message.error('地图加载超时，请检查网络连接和API key配置')
        }
      }, 10000)
      
      return () => clearInterval(checkAMap)
    }
    
    // 使用固定的回调函数名，但确保在全局作用域定义
    const callbackName = 'initAMapCallback'
    
    // 先定义回调函数（在全局作用域）
    ;(window as any)[callbackName] = () => {
      console.log('高德地图API加载成功')
      setIsMapLoaded(true)
      // 延迟初始化，确保DOM已渲染
      setTimeout(() => {
        initMap()
      }, 100)
    }
    
    const script = document.createElement('script')
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}&callback=${callbackName}`
    script.async = true
    script.defer = true

    script.onerror = (error) => {
      console.error('高德地图脚本加载失败:', error)
      message.error('地图加载失败，请检查API key配置和域名白名单')
      if ((window as any)[callbackName]) {
        delete (window as any)[callbackName]
      }
    }

    document.head.appendChild(script)

    // 注意：不在这里清理回调函数，因为脚本可能还在加载中
    // 回调函数会在脚本加载完成后自动执行，之后可以清理
    return () => {
      // 只在组件卸载时清理，但要确保脚本已加载完成
      setTimeout(() => {
        if ((window as any)[callbackName] && window.AMap) {
          // 脚本已加载，可以安全清理
          delete (window as any)[callbackName]
        }
      }, 2000)
    }
  }, [])

  // 初始化地图
  const initMap = () => {
    if (!mapRef.current) {
      console.error('地图容器未找到')
      return
    }
    
    if (!window.AMap) {
      console.error('高德地图API未加载')
      message.error('高德地图API未加载，请刷新页面重试')
      return
    }
    
    if (mapInstanceRef.current) {
      console.log('地图已初始化，跳过')
      return
    }

    try {
      const center: [number, number] = lng && lat ? [lng, lat] : [116.397428, 39.90923] // 默认北京天安门

      console.log('初始化地图，中心点:', center)
      
      const map = new window.AMap.Map(mapRef.current, {
        zoom: 13,
        center: center,
        mapStyle: 'amap://styles/normal',
        viewMode: '2D', // 2D视图
      })

      mapInstanceRef.current = map

      // 等待地图加载完成
      map.on('complete', () => {
        console.log('地图加载完成')
        // 添加标记
        if (lng && lat) {
          addMarker(lng, lat)
          reverseGeocode(lng, lat)
        }
      })

      // 地图点击事件
      map.on('click', (e: any) => {
        const { lng: newLng, lat: newLat } = e.lnglat
        console.log('地图点击:', newLng, newLat)
        addMarker(newLng, newLat)
        reverseGeocode(newLng, newLat)
        onChange?.(newLng, newLat, address)
      })
      
      // 错误处理
      map.on('error', (error: any) => {
        console.error('地图错误:', error)
        message.error('地图加载出错，请检查API key和域名白名单配置')
      })
    } catch (error) {
      console.error('初始化地图失败:', error)
      message.error('初始化地图失败: ' + (error as Error).message)
    }
  }

  // 添加标记
  const addMarker = (lng: number, lat: number) => {
    if (!mapInstanceRef.current) return

    // 移除旧标记
    if (markerRef.current) {
      mapInstanceRef.current.remove(markerRef.current)
    }

    // 添加新标记
    markerRef.current = new window.AMap.Marker({
      position: [lng, lat],
      draggable: true,
    })

    mapInstanceRef.current.add(markerRef.current)
    mapInstanceRef.current.setCenter([lng, lat])

    // 标记拖拽事件
    markerRef.current.on('dragend', (e: any) => {
      const { lng: newLng, lat: newLat } = e.lnglat
      reverseGeocode(newLng, newLat)
      onChange?.(newLng, newLat, address)
    })
  }

  // 逆地理编码（根据经纬度获取地址）
  const reverseGeocode = (lng: number, lat: number) => {
    if (!window.AMap || !mapInstanceRef.current) return

    // 使用plugin方式加载Geocoder
    mapInstanceRef.current.plugin('AMap.Geocoder', () => {
      try {
        const geocoder = new window.AMap.Geocoder({
          city: '全国', // 城市设为全国
        })
        geocoder.getAddress([lng, lat], (status: string, result: any) => {
          if (status === 'complete' && result.info === 'OK') {
            const addr = result.regeocode.formattedAddress || result.regeocode.address || ''
            setAddress(addr)
            onChange?.(lng, lat, addr)
          } else {
            // 如果是因为安全密钥问题，显示友好提示
            if (result && result.info === 'INVALID_USER_SCODE') {
              console.warn('逆地理编码需要配置安全密钥，地址显示功能受限')
              // 不显示错误，只是不显示地址
              setAddress('')
            } else {
              console.warn('逆地理编码失败:', status, result)
            }
          }
        })
      } catch (error) {
        console.error('创建Geocoder失败:', error)
      }
    })
  }

  // 搜索地址
  const handleSearch = () => {
    if (!searchKeyword.trim() || !window.AMap || !mapInstanceRef.current) {
      message.warning('请输入搜索关键词')
      return
    }

    // 使用plugin方式加载PlaceSearch
    mapInstanceRef.current.plugin('AMap.PlaceSearch', () => {
      try {
        const placeSearch = new window.AMap.PlaceSearch({
          city: '全国',
        })

        placeSearch.search(searchKeyword, (status: string, result: any) => {
          if (status === 'complete' && result.poiList && result.poiList.pois.length > 0) {
            const poi = result.poiList.pois[0]
            const { lng: newLng, lat: newLat } = poi.location
            addMarker(newLng, newLat)
            setAddress(poi.address || poi.name || '')
            onChange?.(newLng, newLat, poi.address || poi.name || '')
            setSearchKeyword('')
          } else {
            // 检查是否是安全密钥问题
            if (result && (result.info === 'INVALID_USER_SCODE' || result.info === 'INVALID_USER_KEY')) {
              message.error('搜索功能需要配置安全密钥，请在高德开放平台配置')
            } else {
              message.error('未找到相关地址，请尝试其他关键词')
            }
          }
        })
      } catch (error) {
        console.error('创建PlaceSearch失败:', error)
        message.error('搜索功能初始化失败')
      }
    })
  }

  // 定位到当前位置
  const locateCurrentPosition = () => {
    if (!window.AMap || !mapInstanceRef.current) return

    mapInstanceRef.current.plugin('AMap.Geolocation', () => {
      const geolocation = new window.AMap.Geolocation({
        enableHighAccuracy: true,
        timeout: 10000,
      })

      geolocation.getCurrentPosition((status: string, result: any) => {
        if (status === 'complete') {
          const { lng: newLng, lat: newLat } = result.position
          addMarker(newLng, newLat)
          reverseGeocode(newLng, newLat)
          onChange?.(newLng, newLat, address)
        } else {
          message.error('定位失败，请检查浏览器定位权限')
        }
      })
    })
  }

  // 当外部传入的经纬度变化时，更新地图
  useEffect(() => {
    if (isMapLoaded && lng && lat && mapInstanceRef.current) {
      addMarker(lng, lat)
      reverseGeocode(lng, lat)
    }
  }, [lng, lat, isMapLoaded])

  if (!isMapLoaded) {
    return (
      <Card title="选择位置" size="small">
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <div>正在加载地图...</div>
          <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
            如果长时间未加载，请检查高德地图API key配置
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card title="选择位置" size="small">
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        <Space.Compact style={{ width: '100%' }}>
          <Input
            placeholder="搜索地址..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            onPressEnter={handleSearch}
            prefix={<SearchOutlined />}
            style={{ flex: 1 }}
          />
          <Button type="primary" onClick={handleSearch}>
            搜索
          </Button>
          <Button icon={<ReloadOutlined />} onClick={locateCurrentPosition} title="定位到当前位置">
            定位
          </Button>
        </Space.Compact>
        {address && (
          <div style={{ fontSize: '12px', color: '#666', padding: '4px 0' }}>
            地址：{address}
          </div>
        )}
        <div
          ref={mapRef}
          style={{
            width: '100%',
            height: `${height}px`,
            border: '1px solid #d9d9d9',
            borderRadius: '4px',
          }}
        />
        <div style={{ fontSize: '12px', color: '#999', textAlign: 'center' }}>
          提示：点击地图选择位置，或拖动标记调整位置
        </div>
      </Space>
    </Card>
  )
}

export default MapPicker

