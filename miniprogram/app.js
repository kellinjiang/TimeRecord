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

    // ✅ 移除了启动时的强制登录检查，改为静默检查
    // 用户可以直接进入首页体验功能，需要保存时才提示登录

    // ✅ 暂时禁用睡眠时间自动填充（云函数未部署）
    // 首次启动时检查并填充睡眠时间
    // this.checkAndFillSleepTime();
  },

  // 静默检查登录状态（不跳转，只更新 globalData）
  checkLoginStatusSilent(callback) {
    // ✅ 如果是游客模式，不查询数据库，不自动登录
    if (this.globalData.isGuestMode) {
      console.log('游客模式，跳过自动登录检查');
      callback && callback(false, null);
      return;
    }

    const db = wx.cloud.database();

    db.collection('users')
      .where({
        _openid: '{openid}'  // 云开发会自动替换为当前用户的openid
      })
      .limit(1)
      .get({
        success: (res) => {
          if (res.data.length > 0) {
            // 用户已登录
            console.log('用户已登录', res.data[0]);

            // 保存用户信息到全局变量
            this.globalData.userInfo = res.data[0];

            // 更新最后登录时间
            this.updateLastLoginTime(res.data[0]._id);

            // 执行回调
            callback && callback(true, res.data[0]);
          } else {
            // 用户未登录
            console.log('用户未登录');
            callback && callback(false, null);
          }
        },
        fail: (err) => {
          console.error('检查登录状态失败', err);
          callback && callback(false, null);
        }
      });
  },

  // 更新最后登录时间
  updateLastLoginTime(userId) {
    const db = wx.cloud.database();

    db.collection('users')
      .doc(userId)
      .update({
        data: {
          lastLoginTime: new Date(),
          updateTime: new Date()
        },
        success: () => {
          console.log('最后登录时间更新成功');
        },
        fail: (err) => {
          console.error('最后登录时间更新失败', err);
        }
      });
  },

  onShow() {
    // ✅ 注释掉睡眠时间填充检查（云函数不存在）
    // this.checkAndFillSleepTime();
  },

  // ✅ 暂时禁用睡眠时间自动填充功能（需要先部署云函数）
  // 检查并自动填充睡眠时间
  // checkAndFillSleepTime() {
  //   // 避免频繁调用，使用时间戳控制
  //   const now = Date.now();
  //   const lastCheckTime = this.globalData.lastSleepCheckTime || 0;

  //   // 距离上次检查不足5分钟，跳过
  //   if (now - lastCheckTime < 5 * 60 * 1000) {
  //     console.log('距离上次检查时间太短，跳过睡眠时间填充检查');
  //     return;
  //   }

  //   // 更新检查时间
  //   this.globalData.lastSleepCheckTime = now;

  //   console.log('开始检查睡眠时间填充');

  //   wx.cloud.callFunction({
  //     name: 'auto-fill-sleep',
  //     data: {},
  //     success: (res) => {
  //       console.log('睡眠时间填充检查完成', res.result);
  //       if (res.result.success && (res.result.updated || res.result.created)) {
  //         console.log('✅ ' + res.result.message);
  //       }
  //     },
  //     fail: (err) => {
  //       console.error('睡眠时间填充检查失败', err);
  //     }
  //   });
  // },

  globalData: {
    userInfo: null,
    isLogout: false,  // 退出登录标记
    isGuestMode: false,  // ✅ 游客模式标记
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
