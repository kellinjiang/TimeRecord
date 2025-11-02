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

    // 首次启动时检查并填充睡眠时间
    this.checkAndFillSleepTime();
  },

  onShow() {
    // 每次显示时检查并填充睡眠时间
    this.checkAndFillSleepTime();
  },

  // 检查并自动填充睡眠时间
  checkAndFillSleepTime() {
    // 避免频繁调用，使用时间戳控制
    const now = Date.now();
    const lastCheckTime = this.globalData.lastSleepCheckTime || 0;

    // 距离上次检查不足5分钟，跳过
    if (now - lastCheckTime < 5 * 60 * 1000) {
      console.log('距离上次检查时间太短，跳过睡眠时间填充检查');
      return;
    }

    // 更新检查时间
    this.globalData.lastSleepCheckTime = now;

    console.log('开始检查睡眠时间填充');

    wx.cloud.callFunction({
      name: 'auto-fill-sleep',
      data: {},
      success: (res) => {
        console.log('睡眠时间填充检查完成', res.result);
        if (res.result.success && (res.result.updated || res.result.created)) {
          console.log('✅ ' + res.result.message);
        }
      },
      fail: (err) => {
        console.error('睡眠时间填充检查失败', err);
      }
    });
  },

  globalData: {
    userInfo: null,
    lastSleepCheckTime: 0,  // 上次检查睡眠时间的时间戳
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
