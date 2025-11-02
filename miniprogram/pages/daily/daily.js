// pages/daily/daily.js
// 音频管理器
const audioManager = wx.createInnerAudioContext();

Page({
  data: {
    // 当前日期
    currentDate: '',
    currentDateStr: '',
    weekDayStr: '',

    // 记录数据
    records: [],

    // 统计数据
    stats: {
      totalRecords: 0,
      totalHours: 0,
      completedRecords: 0,
      tagStats: []
    },

    // 每日总结
    summary: {
      content: '',
      _id: null
    },

    // 当前播放的录音ID
    currentPlayingId: null
  },

  onLoad(options) {
    // 如果从其他页面跳转过来，options.date 包含指定的日期
    if (options.date) {
      const targetDate = new Date(options.date);
      this.setCurrentDate(targetDate);
    } else {
      // 设置当前日期
      this.setCurrentDate();
    }

    // 加载数据
    this.loadDailyData();
  },

  onShow() {
    // 每次显示页面时刷新数据
    this.loadDailyData();
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadDailyData();
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 1000);
  },

  // 设置当前日期
  setCurrentDate(date) {
    const targetDate = date || new Date();

    // 格式化日期字符串
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');

    const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const weekDay = weekDays[targetDate.getDay()];

    // 判断是否是今天
    const today = new Date();
    const isToday = (
      year === today.getFullYear() &&
      month === String(today.getMonth() + 1).padStart(2, '0') &&
      day === String(today.getDate()).padStart(2, '0')
    );

    this.setData({
      currentDate: `${year}-${month}-${day}`,
      currentDateStr: isToday ? '今天' : `${month}月${day}日`,
      weekDayStr: weekDay
    });
  },

  // 前一天
  prevDay() {
    const current = new Date(this.data.currentDate);
    current.setDate(current.getDate() - 1);
    this.setCurrentDate(current);
    this.loadDailyData();
  },

  // 后一天
  nextDay() {
    const current = new Date(this.data.currentDate);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 不允许查看未来的日期
    if (current >= tomorrow) {
      wx.showToast({
        title: '不能查看未来',
        icon: 'none'
      });
      return;
    }

    current.setDate(current.getDate() + 1);
    this.setCurrentDate(current);
    this.loadDailyData();
  },

  // 显示日期选择器
  showDatePicker() {
    // 触发隐藏的 picker
    wx.showToast({
      title: '长按日期可选择',
      icon: 'none',
      duration: 1500
    });
  },

  // 日期改变
  onDateChange(e) {
    const selectedDate = new Date(e.detail.value);
    this.setCurrentDate(selectedDate);
    this.loadDailyData();
  },

  // 加载当日数据
  loadDailyData() {
    wx.showLoading({
      title: '加载中...',
      mask: true
    });

    // 并行加载记录和总结
    Promise.all([
      this.loadRecords(),
      this.loadSummary()
    ]).then(() => {
      wx.hideLoading();
    }).catch(err => {
      console.error('加载失败', err);
      wx.hideLoading();
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    });
  },

  // 加载记录
  loadRecords() {
    return new Promise((resolve, reject) => {
      const db = wx.cloud.database();
      const _ = db.command;

      // 计算当天的开始和结束时间
      const dateStart = new Date(this.data.currentDate);
      dateStart.setHours(0, 0, 0, 0);

      const dateEnd = new Date(this.data.currentDate);
      dateEnd.setHours(23, 59, 59, 999);

      db.collection('records')
        .where({
          startTime: _.gte(dateStart).and(_.lte(dateEnd)),
          isDeleted: _.neq(true)
        })
        .orderBy('startTime', 'asc')
        .get({
          success: (res) => {
            console.log('查询成功', res);

            // 格式化记录数据
            const records = res.data.map(item => this.formatRecord(item));

            // 计算统计数据
            const stats = this.calculateStats(records);

            this.setData({
              records: records,
              stats: stats
            });

            resolve();
          },
          fail: (err) => {
            console.error('查询失败', err);
            reject(err);
          }
        });
    });
  },

  // 格式化记录
  formatRecord(record) {
    const startTime = new Date(record.startTime);
    const endTime = record.endTime ? new Date(record.endTime) : null;

    // 格式化时间
    const startTimeStr = this.formatTime(startTime);
    const endTimeStr = endTime ? this.formatTime(endTime) : null;

    // 计算时长
    let duration = 0;
    let durationStr = '';
    if (endTime) {
      duration = Math.floor((endTime - startTime) / 60000); // 分钟
      durationStr = this.formatDuration(duration);
    }

    return {
      ...record,
      startTimeStr,
      endTimeStr,
      duration,
      durationStr
    };
  },

  // 格式化时间（HH:MM）
  formatTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  },

  // 格式化时长
  formatDuration(minutes) {
    if (minutes < 60) {
      return `${minutes}分钟`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  },

  // 计算统计数据
  calculateStats(records) {
    const totalRecords = records.length;
    const completedRecords = records.filter(r => r.endTime).length;

    // 计算总时长（分钟）
    const totalMinutes = records.reduce((sum, r) => sum + (r.duration || 0), 0);
    const totalHours = (totalMinutes / 60).toFixed(1);

    // 计算标签分布
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
          tagMap[tag.name].minutes += (record.duration || 0);
        });
      }
    });

    // 转换为数组并排序
    const tagArray = Object.values(tagMap).sort((a, b) => b.minutes - a.minutes);

    // 找出最大时长（用于计算柱状图高度），限制最大为24小时（1440分钟）
    const maxMinutes = tagArray.length > 0 ? Math.min(tagArray[0].minutes, 1440) : 0;
    const maxHours = maxMinutes / 60;

    // 计算Y轴刻度
    const yAxisLabels = this.calculateYAxisLabels(maxHours);

    // 计算百分比和柱状图高度
    const tagStats = tagArray.map(tag => {
      const hours = (tag.minutes / 60).toFixed(1);
      const percentage = totalMinutes > 0 ? ((tag.minutes / totalMinutes) * 100).toFixed(1) : 0;
      // 限制单个标签时长不超过24小时用于显示柱状图
      const displayMinutes = Math.min(tag.minutes, 1440);
      const barHeight = maxMinutes > 0 ? ((displayMinutes / maxMinutes) * 100).toFixed(0) : 0;

      return {
        ...tag,
        hours: parseFloat(hours),
        percentage: parseFloat(percentage),
        barHeight: parseFloat(barHeight)
      };
    });

    return {
      totalRecords,
      totalHours,
      completedRecords,
      tagStats,
      yAxisLabels
    };
  },

  // 计算Y轴刻度标签
  calculateYAxisLabels(maxHours) {
    // 限制最大小时数为24小时
    const limitedMaxHours = Math.min(maxHours, 24);

    if (limitedMaxHours <= 0) {
      return [0];
    }

    // 根据最大值确定刻度间隔
    let interval = 1; // 默认1小时
    if (limitedMaxHours <= 2) {
      interval = 0.5;
    } else if (limitedMaxHours <= 5) {
      interval = 1;
    } else if (limitedMaxHours <= 10) {
      interval = 2;
    } else if (limitedMaxHours <= 15) {
      interval = 3;
    } else if (limitedMaxHours <= 20) {
      interval = 4;
    } else {
      interval = 6;
    }

    // 生成刻度标签（从大到小）
    const labels = [];
    const maxLabel = Math.ceil(limitedMaxHours / interval) * interval;

    for (let i = maxLabel; i >= 0; i -= interval) {
      labels.push(i);
    }

    return labels;
  },

  // 加载每日总结
  loadSummary() {
    return new Promise((resolve, reject) => {
      const db = wx.cloud.database();

      db.collection('summaries')
        .where({
          type: 'daily',
          date: this.data.currentDate
        })
        .get({
          success: (res) => {
            if (res.data.length > 0) {
              this.setData({
                summary: {
                  content: res.data[0].content || '',
                  _id: res.data[0]._id
                }
              });
            } else {
              this.setData({
                summary: {
                  content: '',
                  _id: null
                }
              });
            }
            resolve();
          },
          fail: (err) => {
            console.error('加载总结失败', err);
            resolve(); // 总结加载失败不影响整体
          }
        });
    });
  },

  // 编辑记录
  editRecord(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/record-edit/record-edit?id=${id}`
    });
  },

  // 编辑总结
  editSummary() {
    // 聚焦到输入框
  },

  // 总结输入
  onSummaryInput(e) {
    this.setData({
      'summary.content': e.detail.value
    });
  },

  // 保存总结
  saveSummary() {
    const content = this.data.summary.content.trim();

    if (!content) {
      // 内容为空，如果有记录则删除
      if (this.data.summary._id) {
        this.deleteSummary();
      }
      return;
    }

    wx.showLoading({
      title: '保存中...',
      mask: true
    });

    const db = wx.cloud.database();

    if (this.data.summary._id) {
      // 更新已有总结
      db.collection('summaries')
        .doc(this.data.summary._id)
        .update({
          data: {
            content: content,
            updateTime: new Date()
          },
          success: () => {
            wx.hideLoading();
            wx.showToast({
              title: '保存成功',
              icon: 'success',
              duration: 1500
            });
          },
          fail: (err) => {
            wx.hideLoading();
            wx.showToast({
              title: '保存失败',
              icon: 'none'
            });
            console.error('更新总结失败', err);
          }
        });
    } else {
      // 创建新总结
      db.collection('summaries')
        .add({
          data: {
            type: 'daily',
            date: this.data.currentDate,
            content: content,
            stats: this.data.stats,
            createTime: new Date(),
            updateTime: new Date()
          },
          success: (res) => {
            wx.hideLoading();
            wx.showToast({
              title: '保存成功',
              icon: 'success',
              duration: 1500
            });

            // 更新 _id
            this.setData({
              'summary._id': res._id
            });
          },
          fail: (err) => {
            wx.hideLoading();
            wx.showToast({
              title: '保存失败',
              icon: 'none'
            });
            console.error('创建总结失败', err);
          }
        });
    }
  },

  // 删除总结
  deleteSummary() {
    const db = wx.cloud.database();

    db.collection('summaries')
      .doc(this.data.summary._id)
      .remove({
        success: () => {
          this.setData({
            'summary._id': null
          });
        }
      });
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 空函数，用于阻止冒泡到父元素的点击事件
  },

  // 播放录音
  playAudio(e) {
    const recordId = e.currentTarget.dataset.id;
    const audioPath = e.currentTarget.dataset.path;

    console.log('播放录音', recordId, audioPath);

    // 如果正在播放同一个录音，则停止
    if (this.data.currentPlayingId === recordId) {
      audioManager.stop();
      this.updateRecordPlayingState(recordId, false);
      this.setData({
        currentPlayingId: null
      });
      return;
    }

    // 停止之前的播放
    if (this.data.currentPlayingId) {
      audioManager.stop();
      this.updateRecordPlayingState(this.data.currentPlayingId, false);
    }

    // 获取云文件临时链接
    wx.cloud.getTempFileURL({
      fileList: [audioPath],
      success: (res) => {
        console.log('获取临时链接成功', res);
        if (res.fileList && res.fileList.length > 0) {
          const tempFileURL = res.fileList[0].tempFileURL;

          // 设置音频源
          audioManager.src = tempFileURL;

          // 播放
          audioManager.play();

          // 更新播放状态
          this.updateRecordPlayingState(recordId, true);
          this.setData({
            currentPlayingId: recordId
          });

          // 监听播放结束
          audioManager.onEnded(() => {
            console.log('播放结束');
            this.updateRecordPlayingState(recordId, false);
            this.setData({
              currentPlayingId: null
            });
          });

          // 监听播放错误
          audioManager.onError((error) => {
            console.error('播放错误', error);
            wx.showToast({
              title: '播放失败',
              icon: 'none'
            });
            this.updateRecordPlayingState(recordId, false);
            this.setData({
              currentPlayingId: null
            });
          });
        }
      },
      fail: (err) => {
        console.error('获取临时链接失败', err);
        wx.showToast({
          title: '无法播放录音',
          icon: 'none'
        });
      }
    });
  },

  // 更新记录的播放状态
  updateRecordPlayingState(recordId, isPlaying) {
    const records = this.data.records.map(record => {
      if (record._id === recordId) {
        return {
          ...record,
          isPlaying: isPlaying
        };
      }
      return {
        ...record,
        isPlaying: false
      };
    });

    this.setData({
      records: records
    });
  }
});
