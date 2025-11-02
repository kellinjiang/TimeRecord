// app.js
App({
  onLaunch() {
    // 初始化云开发环境
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'cloud1-4gghlb7z8c4b3468',  // 请替换为您的云环境ID
        traceUser: true,
      });
    }

    // 获取用户信息
    this.globalData.userInfo = null;
  },

  globalData: {
    userInfo: null,
    // 默认标签配置
    defaultTags: [
      { name: '工作', icon: '💼', color: '#FF5733' },
      { name: '学习', icon: '📖', color: '#3498DB' },
      { name: '休息', icon: '☕', color: '#2ECC71' },
      { name: '通勤', icon: '🚇', color: '#9B59B6' },
      { name: '家庭', icon: '🏠', color: '#E74C3C' },
      { name: '运动', icon: '🏃', color: '#F39C12' }
    ]
  }
});
