// pages/about/about.js
Page({
  data: {
    version: 'v1.0.0'
  },

  onLoad(options) {
    // 页面加载
  },

  onShareAppMessage() {
    return {
      title: '时间记录小程序 - 让时间管理更简单',
      path: '/pages/index/index'
    }
  }
});
