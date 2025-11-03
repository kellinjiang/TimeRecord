// 登录页面
const app = getApp();

Page({
  /**
   * 页面的初始数据
   */
  data: {
    avatarUrl: '', // 用户选择的头像
    nickName: '',  // 用户输入的昵称
    canLogin: false, // 是否可以登录（头像和昵称都完善后才能登录）
    agreePrivacy: false // 是否同意隐私政策（默认不同意）
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 检查是否已经登录
    this.checkLoginStatus();
  },

  /**
   * 检查登录状态
   */
  checkLoginStatus() {
    const app = getApp();

    // ✅ 如果是游客模式，不自动登录，让用户手动输入
    if (app.globalData.isGuestMode) {
      console.log('游客模式，不自动登录');
      return;
    }

    // 如果是主动退出登录，不自动跳转
    if (app.globalData.isLogout) {
      console.log('用户主动退出登录，停留在登录页');
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
            // ✅ 用户已登录，先设置 globalData，再跳转
            console.log('用户已登录，自动跳转');

            // 先保存用户信息到全局
            app.globalData.userInfo = res.data[0];

            // 再跳转到首页
            wx.reLaunch({
              url: '/pages/index/index'
            });
          } else {
            console.log('用户未登录，显示登录页');
          }
        },
        fail: (err) => {
          console.error('检查登录状态失败', err);
        }
      });
  },

  /**
   * 选择头像
   */
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    console.log('用户选择头像:', avatarUrl);

    this.setData({
      avatarUrl: avatarUrl
    }, () => {
      this.checkCanLogin();
    });
  },

  /**
   * 输入昵称
   */
  onNicknameInput(e) {
    const nickName = e.detail.value;
    console.log('用户输入昵称:', nickName);

    this.setData({
      nickName: nickName
    }, () => {
      this.checkCanLogin();
    });
  },

  /**
   * 昵称输入框失焦
   */
  onNicknameBlur(e) {
    const nickName = e.detail.value.trim();
    console.log('昵称输入框失焦:', nickName);

    this.setData({
      nickName: nickName
    }, () => {
      this.checkCanLogin();
    });
  },

  /**
   * 检查是否可以登录
   */
  checkCanLogin() {
    const { avatarUrl, nickName } = this.data;
    const canLogin = avatarUrl !== '' && nickName.trim() !== '';

    console.log('检查登录条件:', { avatarUrl, nickName, canLogin });

    this.setData({
      canLogin: canLogin
    });
  },

  /**
   * 处理登录
   */
  handleLogin() {
    const { avatarUrl, nickName, canLogin, agreePrivacy } = this.data;

    // 检查是否同意隐私政策
    if (!agreePrivacy) {
      wx.showToast({
        title: '请先同意隐私政策',
        icon: 'none'
      });
      return;
    }

    if (!canLogin) {
      wx.showToast({
        title: '请完善信息',
        icon: 'none'
      });
      return;
    }

    console.log('开始登录流程', { avatarUrl, nickName });

    // 显示加载提示
    wx.showLoading({
      title: '登录中...',
      mask: true
    });

    // ✅ 清除游客模式标志
    app.globalData.isGuestMode = false;

    // 清除退出登录标记
    app.globalData.isLogout = false;

    // 构造用户信息
    const userInfo = {
      nickName: nickName.trim(),
      avatarUrl: avatarUrl
    };

    // 保存用户信息到数据库
    this.saveUserInfo(userInfo);
  },

  /**
   * 保存用户信息到数据库
   */
  saveUserInfo(userInfo) {
    const that = this;
    const db = wx.cloud.database();
    const now = new Date();

    console.log('开始保存用户信息', userInfo);

    // 先查询用户是否已存在
    db.collection('users')
      .where({
        _openid: '{openid}'
      })
      .limit(1)
      .get({
        success: (res) => {
          console.log('查询用户结果', res);

          if (res.data.length > 0) {
            // 用户已存在，更新用户信息
            const userId = res.data[0]._id;
            console.log('用户已存在，更新信息，用户ID:', userId);

            db.collection('users')
              .doc(userId)
              .update({
                data: {
                  nickName: userInfo.nickName,
                  avatarUrl: userInfo.avatarUrl,
                  lastLoginTime: now,
                  updateTime: now
                },
                success: () => {
                  console.log('用户信息更新成功');
                  that.loginSuccess();
                },
                fail: (err) => {
                  console.error('用户信息更新失败', err);
                  wx.hideLoading();
                  wx.showToast({
                    title: '更新失败',
                    icon: 'none'
                  });
                }
              });
          } else {
            // 用户不存在，创建新用户
            console.log('用户不存在，创建新用户');

            db.collection('users').add({
              data: {
                // 用户基础信息
                nickName: userInfo.nickName,
                avatarUrl: userInfo.avatarUrl,
                gender: 0,
                country: '',
                province: '',
                city: '',

                // 使用统计（初始值）
                usageStats: {
                  totalRecords: 0,
                  totalMinutes: 0,
                  activeDays: 0,
                  lastActiveDate: ''
                },

                // 配置项（默认值）
                settings: {
                  blankTimeThreshold: 3,      // 空白时间阈值（小时）
                  dailyReminderTime: '21:00', // 每日提醒时间
                  enableReminder: false       // 是否启用提醒
                },

                // 时间戳
                registerTime: now,
                lastLoginTime: now,
                updateTime: now
              },
              success: (res) => {
                console.log('用户信息创建成功', res);
                that.loginSuccess();
              },
              fail: (err) => {
                console.error('用户信息创建失败', err);
                wx.hideLoading();
                wx.showModal({
                  title: '登录失败',
                  content: '保存用户信息失败，请重试',
                  showCancel: false
                });
              }
            });
          }
        },
        fail: (err) => {
          console.error('查询用户失败', err);
          wx.hideLoading();
          wx.showToast({
            title: '查询失败',
            icon: 'none'
          });
        }
      });
  },

  /**
   * 登录成功处理
   */
  loginSuccess() {
    const app = getApp();
    const db = wx.cloud.database();

    console.log('登录成功，重新查询完整用户信息');

    // 重新从数据库查询完整的用户信息（包含 _id 和 _openid）
    db.collection('users')
      .where({
        _openid: '{openid}'
      })
      .limit(1)
      .get({
        success: (queryRes) => {
          console.log('重新查询用户信息结果', queryRes);

          wx.hideLoading();

          if (queryRes.data.length > 0) {
            // 保存完整的用户数据到全局数据
            const fullUserInfo = queryRes.data[0];
            console.log('✅ 获取完整用户信息成功', fullUserInfo);
            app.globalData.userInfo = fullUserInfo;

            // 显示成功提示
            wx.showToast({
              title: '登录成功',
              icon: 'success',
              duration: 1500
            });

            // 跳转到首页
            setTimeout(() => {
              wx.reLaunch({
                url: '/pages/index/index'
              });
            }, 1500);
          } else {
            console.error('❌ 登录成功但未查询到用户信息');
            wx.showToast({
              title: '登录异常',
              icon: 'none'
            });
          }
        },
        fail: (err) => {
          console.error('❌ 查询用户信息失败', err);
          wx.hideLoading();
          wx.showToast({
            title: '登录异常',
            icon: 'none'
          });
        }
      });
  },

  /**
   * 切换隐私政策同意状态
   */
  togglePrivacy() {
    this.setData({
      agreePrivacy: !this.data.agreePrivacy
    });
  },

  /**
   * 查看用户协议
   */
  viewAgreement(e) {
    e.stopPropagation(); // 阻止事件冒泡
    wx.showModal({
      title: '用户协议',
      content: '欢迎使用时间记录小程序！\n\n本协议内容包括：\n1. 服务条款\n2. 用户权利与义务\n3. 隐私保护\n4. 免责声明\n\n详细内容请访问官网查看。',
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  /**
   * 查看隐私政策
   */
  viewPrivacy(e) {
    e.stopPropagation(); // 阻止事件冒泡
    wx.showModal({
      title: '隐私政策',
      content: '我们非常重视您的隐私保护！\n\n我们收集的信息：\n1. 头像和��称（用于展示）\n2. 时间记录数据（用于统计）\n3. 录音文件（仅用于语音识别）\n\n我们承诺：\n- 不会将您的数据用于其他用途\n- 不会向第三方出售您的数据\n- 您可以随时删除您的数据',
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  /**
   * 跳过登录，直接进入首页体验
   */
  skipLogin() {
    console.log('用户选择跳过登录，进入游客模式');

    // ✅ 设置游客模式标志
    app.globalData.isGuestMode = true;

    // 清除用户信息
    app.globalData.userInfo = null;

    // 清除退出登录标记
    app.globalData.isLogout = false;

    // 跳转到首页
    wx.reLaunch({
      url: '/pages/index/index'
    });
  }
});
