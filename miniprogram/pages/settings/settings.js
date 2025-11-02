// pages/settings/settings.js
Page({
  data: {
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
    // 加载统计数据
    this.loadStatistics();
  },

  onShow() {
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

  // 显示关于信息
  showAbout() {
    wx.navigateTo({
      url: '/pages/about/about'
    });
  }
});
