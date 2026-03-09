/**
 * 图片URL处理工具
 * 用于修复旧域名图片URL，替换为当前可用的API地址
 */

const OLD_API_DOMAIN = 'https://api.hodaruner.cn'
// 生产环境下，图片通过API域名访问（Nginx反向代理到8100端口）
const BACKEND_API_BASE = 'https://api.hodaruner.cn'
const CURRENT_API_BASE = import.meta.env.VITE_API_BASE_URL || BACKEND_API_BASE

 const LEGACY_HTTP_IP_BASE = 'http://47.108.135.142:8100'
 const LEGACY_HTTP_API_BASE = 'http://api.hodaruner.cn'

/**
 * 修复图片URL：将旧域名替换为当前API地址
 * @param url 原始图片URL
 * @returns 修复后的图片URL
 */
export function fixImageUrl(url: string | null | undefined): string | null {
  if (!url) return null
  
  // 过滤掉微信小程序临时文件路径
  if (url.startsWith('wxfile://') || url.startsWith('file://')) {
    return null
  }
  
  // 如果是旧域名的URL，直接返回（因为现在BACKEND_API_BASE也是https://api.hodaruner.cn）
  if (url.startsWith(OLD_API_DOMAIN)) {
    return url
  }

  // 历史HTTP链接：统一升级为HTTPS，避免 Mixed Content 被浏览器拦截
  if (url.startsWith(LEGACY_HTTP_IP_BASE)) {
    const path = url.slice(LEGACY_HTTP_IP_BASE.length)
    return `${BACKEND_API_BASE}${path}`
  }
  if (url.startsWith(LEGACY_HTTP_API_BASE)) {
    const path = url.slice(LEGACY_HTTP_API_BASE.length)
    return `${BACKEND_API_BASE}${path}`
  }
  
  // 如果已经是完整的http/https URL，直接返回
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  
  // 如果是相对路径，拼接API地址
  if (url.startsWith('/')) {
    return `${CURRENT_API_BASE}${url}`
  }
  
  // 其他情况（包括OSS对象名），拼接完整路径
  // 注意：OSS对象名应该由后端转换为签名URL，但如果后端没有转换，
  // 前端会将其作为API路径访问，这会失败
  return `${CURRENT_API_BASE}/${url}`
}

/**
 * 批量修复图片URL列表
 * @param urls 图片URL列表
 * @returns 修复后的图片URL列表（过滤掉null值）
 */
export function fixImageUrls(urls: (string | null | undefined)[]): string[] {
  return urls.map(fixImageUrl).filter((url): url is string => url !== null)
}
