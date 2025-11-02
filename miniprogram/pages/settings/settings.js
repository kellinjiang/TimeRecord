// pages/settings/settings.js
Page({
  data: {
    // 用户信息
    userInfo: {
      nickName: '加载中...',
      avatarUrl: ''
    },

    // 用户使用天数
    usageDays: 0,

    // 总体统计数据
    totalStats: {
      totalRecords: 0,
      totalHours: 0,
      activeDays: 0,
      tagCount: 0
    },

    // 常用标签（Top 5）
    topTags: [],

    // 模板数量
    templateCount: 0,

    // 缓存大小
    cacheSize: '0KB'
  },

  onLoad(options) {
    // 加载用户信息
    this.loadUserInfo();

    // 加载统计数据
    this.loadStatistics();
  },

  onShow() {
    console.log('========== Settings 页面 onShow ==========');

    // 打印调试信息
    const app = getApp();
    console.log('app.globalData.userInfo:', app.globalData.userInfo);

    // 加载用户信息
    this.loadUserInfo();

    // 每次显示页面时刷新数据
    this.loadStatistics();
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadStatistics();
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 1000);
  },

  // 加载用户信息
  loadUserInfo() {
    const app = getApp();

    console.log('========== 开始加载用户信息 ==========');
    console.log('app.globalData.userInfo:', app.globalData.userInfo);

    // 从全局数据获取用户信息
    if (app.globalData.userInfo && app.globalData.userInfo.nickName) {
      console.log('✅ 从 globalData 加载用户信息成功');

      const userInfo = app.globalData.userInfo;
      const displayData = {
        nickName: userInfo.nickName || '未登录',
        avatarUrl: userInfo.avatarUrl || ''
      };

      console.log('设置用户信息:', displayData);

      this.setData({
        userInfo: displayData
      });

      console.log('页面数据已更新，当前 userInfo:', this.data.userInfo);
    } else {
      // 如果全局数据中没有，尝试从数据库加载
      console.log('⚠️ globalData 中无用户信息，从数据库加载...');

      this.loadUserInfoFromDB();
    }
  },

  // 从数据库加载用户信息
  loadUserInfoFromDB() {
    const app = getApp();
    const db = wx.cloud.database();

    console.log('开始从数据库查询用户信息...');

    db.collection('users')
      .where({
        _openid: '{openid}'
      })
      .limit(1)
      .get({
        success: (res) => {
          console.log('✅ 数据库查询成功，结果:', res);

          if (res.data.length > 0) {
            const userData = res.data[0];
            console.log('数据库中找到用户信息:', userData);

            const displayData = {
              nickName: userData.nickName || '未登录',
              avatarUrl: userData.avatarUrl || ''
            };

            console.log('设置用户信息:', displayData);

            this.setData({
              userInfo: displayData
            });

            console.log('页面数据已更新，当前 userInfo:', this.data.userInfo);

            // 同时更新全局数据
            app.globalData.userInfo = userData;
            console.log('已更新 globalData.userInfo');
          } else {
            console.log('❌ 数据库中未找到用户信息');
            this.setData({
              userInfo: {
                nickName: '未登录',
                avatarUrl: ''
              }
            });
          }
        },
        fail: (err) => {
          console.error('❌ 数据库查询失败:', err);
          this.setData({
            userInfo: {
              nickName: '加载失败',
              avatarUrl: ''
            }
          });
        }
      });
  },

  // 头像加载错误处理
  onAvatarError(e) {
    console.error('头像加载失败', e);
    this.setData({
      'userInfo.avatarUrl': ''
    });
  },

  // 加载统计数据
  loadStatistics() {
    wx.showLoading({
      title: '加载中...',
      mask: true
    });

    Promise.all([
      this.loadUsageDays(),
      this.loadTotalStats(),
      this.loadTopTags(),
      this.loadTemplateCount(),
      this.calculateCacheSize()
    ]).then(() => {
      wx.hideLoading();
    }).catch(err => {
      console.error('加载统计数据失败', err);
      wx.hideLoading();
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    });
  },

  // 加载使用天数
  loadUsageDays() {
    return new Promise((resolve, reject) => {
      const db = wx.cloud.database();

      // 查询最早的记录
      db.collection('records')
        .where({
          isDeleted: db.command.neq(true)
        })
        .orderBy('startTime', 'asc')
        .limit(1)
        .get({
          success: (res) => {
            if (res.data.length > 0) {
              const firstRecord = res.data[0];
              const firstDate = new Date(firstRecord.startTime);
              const today = new Date();

              // 计算天数差
              const daysDiff = Math.floor((today - firstDate) / (24 * 60 * 60 * 1000));

              this.setData({
                usageDays: daysDiff > 0 ? daysDiff : 1
              });
            } else {
              this.setData({
                usageDays: 0
              });
            }
            resolve();
          },
          fail: (err) => {
            console.error('加载使用天数失败', err);
            resolve(); // 不影响其他数据加载
          }
        });
    });
  },

  // 加载总体统计数据
  loadTotalStats() {
    return new Promise((resolve, reject) => {
      const db = wx.cloud.database();
      const _ = db.command;

      // 查询所有记录
      db.collection('records')
        .where({
          isDeleted: _.neq(true)
        })
        .get({
          success: (res) => {
            const records = res.data;

            // 计算总记录数
            const totalRecords = records.length;

            // 计算总时长（分钟）
            let totalMinutes = 0;
            records.forEach(record => {
              if (record.endTime) {
                const startTime = new Date(record.startTime);
                const endTime = new Date(record.endTime);
                const duration = Math.floor((endTime - startTime) / 60000);
                totalMinutes += duration;
              }
            });

            const totalHours = (totalMinutes / 60).toFixed(1);

            // 计算活跃天数（有记录的天数）
            const dateSet = new Set();
            records.forEach(record => {
              const date = new Date(record.startTime);
              const dateStr = this.formatDate(date);
              dateSet.add(dateStr);
            });
            const activeDays = dateSet.size;

            // 计算标签数量（默认标签 + 自定义标签）
            const app = getApp();
            const defaultTagCount = app.globalData.defaultTags ? app.globalData.defaultTags.length : 0;

            // 查询自定义标签数量
            db.collection('tags')
              .where({
                isDeleted: _.neq(true)
              })
              .count()
              .then(countRes => {
                const customTagCount = countRes.total || 0;
                const totalTagCount = defaultTagCount + customTagCount;

                this.setData({
                  totalStats: {
                    totalRecords,
                    totalHours,
                    activeDays,
                    tagCount: totalTagCount
                  }
                });

                resolve();
              })
              .catch(err => {
                console.error('查询自定义标签数量失败', err);
                // 即使失败，也使用默认标签数量
                this.setData({
                  totalStats: {
                    totalRecords,
                    totalHours,
                    activeDays,
                    tagCount: defaultTagCount
                  }
                });

                resolve();
              });
          },
          fail: (err) => {
            console.error('加载总体统计失败', err);
            reject(err);
          }
        });
    });
  },

  // 加载常用标签（Top 5）
  loadTopTags() {
    return new Promise((resolve, reject) => {
      const db = wx.cloud.database();
      const _ = db.command;

      // 查询所有记录
      db.collection('records')
        .where({
          isDeleted: _.neq(true)
        })
        .get({
          success: (res) => {
            const records = res.data;

            // 统计标签时长
            const tagMap = {};
            records.forEach(record => {
              if (record.tags && record.tags.length > 0) {
                record.tags.forEach(tag => {
                  if (!tagMap[tag.name]) {
                    tagMap[tag.name] = {
                      name: tag.name,
                      icon: tag.icon,
                      color: tag.color,
                      minutes: 0
                    };
                  }

                  if (record.endTime) {
                    const startTime = new Date(record.startTime);
                    const endTime = new Date(record.endTime);
                    const duration = Math.floor((endTime - startTime) / 60000);
                    tagMap[tag.name].minutes += duration;
                  }
                });
              }
            });

            // 转换为数组并排序，取前5个
            const topTags = Object.values(tagMap)
              .sort((a, b) => b.minutes - a.minutes)
              .slice(0, 5)
              .map(tag => ({
                ...tag,
                hours: (tag.minutes / 60).toFixed(1)
              }));

            this.setData({
              topTags: topTags
            });

            resolve();
          },
          fail: (err) => {
            console.error('加载常用标签失败', err);
            resolve(); // 不影响其他数据加载
          }
        });
    });
  },

  // 加载模板数量
  loadTemplateCount() {
    return new Promise((resolve, reject) => {
      const db = wx.cloud.database();

      // 默认模板数量（系统内置）
      const defaultTemplateCount = 3;

      // 查询自定义模板数量
      db.collection('templates')
        .where({
          isDeleted: db.command.neq(true)
        })
        .count()
        .then(countRes => {
          const customTemplateCount = countRes.total || 0;
          const totalTemplateCount = defaultTemplateCount + customTemplateCount;

          this.setData({
            templateCount: totalTemplateCount
          });

          resolve();
        })
        .catch(err => {
          console.error('查询模板数量失败', err);
          // 即使失败，也使用默认模板数量
          this.setData({
            templateCount: defaultTemplateCount
          });

          resolve();
        });
    });
  },

  // 计算缓存大小
  calculateCacheSize() {
    return new Promise((resolve, reject) => {
      try {
        const res = wx.getStorageInfoSync();
        const sizeKB = res.currentSize;

        let cacheSize = '';
        if (sizeKB < 1024) {
          cacheSize = `${sizeKB}KB`;
        } else {
          const sizeMB = (sizeKB / 1024).toFixed(2);
          cacheSize = `${sizeMB}MB`;
        }

        this.setData({
          cacheSize: cacheSize
        });

        resolve();
      } catch (err) {
        console.error('计算缓存大小失败', err);
        resolve(); // 不影响其他数据加载
      }
    });
  },

  // 格式化日期（YYYY-MM-DD）
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 跳转到标签管理
  goToTagManage() {
    wx.navigateTo({
      url: '/pages/tag-manage/tag-manage'
    });
  },

  // 跳转到模板管理
  goToTemplateManage() {
    wx.navigateTo({
      url: '/pages/template-manage/template-manage'
    });
  },

  // 跳转到数据统计
  goToDataStats() {
    wx.navigateTo({
      url: '/pages/data-stats/data-stats'
    });
  },

  // 数据备份
  backupData() {
    wx.showModal({
      title: '数据备份',
      content: '是否将数据备份到云端？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '备份中...',
            mask: true
          });

          // TODO: 实现数据备份逻辑
          setTimeout(() => {
            wx.hideLoading();
            wx.showToast({
              title: '备份成功',
              icon: 'success'
            });
          }, 1500);
        }
      }
    });
  },

  // 清除缓存
  clearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '确定要清除所有缓存数据吗？',
      success: (res) => {
        if (res.confirm) {
          try {
            wx.clearStorageSync();
            wx.showToast({
              title: '清除成功',
              icon: 'success'
            });

            // 重新计算缓存大小
            this.calculateCacheSize();
          } catch (err) {
            wx.showToast({
              title: '清除失败',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  // 重新授权
  reAuthorize() {
    wx.showModal({
      title: '重新授权',
      content: '将重新获取您的微信头像和昵称等信息',
      success: (res) => {
        if (res.confirm) {
          // 调用微信授权
          wx.getUserProfile({
            desc: '用于刷新用户资料',
            success: (profileRes) => {
              const userInfo = profileRes.userInfo;
              console.log('重新获取用户信息成功', userInfo);

              wx.showLoading({
                title: '更新中...',
                mask: true
              });

              // 更新数据库中的用户信息
              const db = wx.cloud.database();
              db.collection('users')
                .where({
                  _openid: '{openid}'
                })
                .limit(1)
                .get({
                  success: (queryRes) => {
                    if (queryRes.data.length > 0) {
                      const userId = queryRes.data[0]._id;

                      // 更新用户信息
                      db.collection('users')
                        .doc(userId)
                        .update({
                          data: {
                            nickName: userInfo.nickName,
                            avatarUrl: userInfo.avatarUrl,
                            gender: userInfo.gender,
                            language: userInfo.language,
                            country: userInfo.country,
                            province: userInfo.province,
                            city: userInfo.city,
                            updateTime: new Date()
                          },
                          success: () => {
                            console.log('用户信息更新成功');

                            // 更新全局数据
                            const app = getApp();
                            app.globalData.userInfo = {
                              ...app.globalData.userInfo,
                              nickName: userInfo.nickName,
                              avatarUrl: userInfo.avatarUrl,
                              gender: userInfo.gender,
                              language: userInfo.language,
                              country: userInfo.country,
                              province: userInfo.province,
                              city: userInfo.city
                            };

                            // 刷新页面数据
                            this.loadUserInfo();

                            wx.hideLoading();
                            wx.showToast({
                              title: '授权成功',
                              icon: 'success'
                            });
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
                      wx.hideLoading();
                      wx.showToast({
                        title: '用户不存在',
                        icon: 'none'
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
            fail: (err) => {
              console.error('获取用户信息失败', err);
              wx.showToast({
                title: '授权失败',
                icon: 'none'
              });
            }
          });
        }
      }
    });
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      confirmText: '退出',
      confirmColor: '#FF3B30',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '退出中...',
            mask: true
          });

          // 清除全局用户信息
          const app = getApp();
          app.globalData.userInfo = null;

          // 设置退出登录标记，防止自动跳转
          app.globalData.isLogout = true;

          // 清除本地存储（可选）
          try {
            wx.removeStorageSync('userInfo');
          } catch (err) {
            console.error('清除本地存储失败', err);
          }

          wx.hideLoading();

          // 跳转到登录页
          wx.reLaunch({
            url: '/pages/login/login',
            success: () => {
              console.log('已退出登录，跳转到登录页');
            }
          });
        }
      }
    });
  },

  // 显示关于信息
  showAbout() {
    wx.navigateTo({
      url: '/pages/about/about'
    });
  }
});
