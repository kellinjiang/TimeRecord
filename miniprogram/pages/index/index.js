// pages/index/index.js
const app = getApp();
const recorderManager = wx.getRecorderManager();

Page({
  data: {
    currentTime: '',
    currentDate: '',
    isRecording: false,
    recordText: '按住录音',
    statusTip: '',
    recentRecords: [],
    tempFilePath: '',    // 录音文件路径

    // 备忘录相关
    todayMemos: [],          // 今日待办
    memoCardExpanded: false, // 卡片是否展开
    displayMemos: []         // 显示的备忘录（前3条）
  },

  onLoad() {
    // ✅ 静默检查登录状态（不跳转）
    const app = getApp();
    if (app.checkLoginStatusSilent) {
      app.checkLoginStatusSilent((isLoggedIn, userInfo) => {
        console.log('首页登录状态:', isLoggedIn);
        if (isLoggedIn) {
          // 已登录，可以加载用户数据
          this.loadRecentRecords();
          this.loadTodayMemos();
        } else {
          // 未登录，游客模式，不加载数据
          console.log('游客模式，可体验录音功能');
        }
      });
    }

    this.updateTime();
    this.timeInterval = setInterval(() => {
      this.updateTime();
    }, 1000);

    // 初始化录音管理器
    this.initRecorder();
  },

  onUnload() {
    if (this.timeInterval) {
      clearInterval(this.timeInterval);
    }
  },

  onShow() {
    // ✅ 只在登录状态下刷新数据
    const app = getApp();
    if (app.globalData.userInfo) {
      // 每次显示页面时刷新最近记录
      this.loadRecentRecords();

      // 刷新今日待办
      this.loadTodayMemos();
    } else {
      console.log('游客模式，不加载数据');
    }
  },

  // 更新时间显示
  updateTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    const weekDay = weekDays[now.getDay()];

    this.setData({
      currentTime: `${hours}:${minutes}:${seconds}`,
      currentDate: `${year}年${month}月${day}日 星期${weekDay}`
    });
  },

  // 初始化录音器
  initRecorder() {
    const that = this;

    recorderManager.onStart(() => {
      console.log('录音开始');
      that.setData({
        statusTip: '正在录音...'
      });
    });

    recorderManager.onStop((res) => {
      console.log('录音结束', res);
      const tempFilePath = res.tempFilePath;

      that.setData({
        tempFilePath: tempFilePath,
        statusTip: '上传录音中...'
      });

      // 上传录音到云存储
      that.uploadVoiceFile(tempFilePath);
    });

    recorderManager.onError((err) => {
      console.error('录音错误', err);
      wx.showToast({
        title: '录音失败',
        icon: 'none'
      });
      that.setData({
        isRecording: false,
        recordText: '按住录音',
        statusTip: ''
      });
    });
  },

  // 上传录音文件到云存储
  uploadVoiceFile(tempFilePath) {
    const that = this;
    const fileName = `voice_${Date.now()}.pcm`;  // 使用.pcm扩展名
    const cloudPath = `voice/${fileName}`;

    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: tempFilePath,
      success: (uploadRes) => {
        console.log('录音上传成功', uploadRes);
        const fileID = uploadRes.fileID;

        // 调用语音识别
        that.setData({
          statusTip: '正在识别语音...'
        });

        that.recognizeSpeech(fileID);
      },
      fail: (err) => {
        console.error('录音上传失败', err);
        that.setData({
          statusTip: ''
        });

        wx.showModal({
          title: '上传失败',
          content: '录音文件上传失败，是否继续编辑？',
          confirmText: '继续',
          cancelText: '重录',
          success(res) {
            if (res.confirm) {
              // 不带录音继续编辑
              wx.navigateTo({
                url: `/pages/record-edit/record-edit`
              });
            }
          }
        });
      }
    });
  },

  // 调用云函数进行语音识别
  recognizeSpeech(fileID) {
    const that = this;

    wx.cloud.callFunction({
      name: 'speech-recognition',
      data: {
        fileID: fileID
      },
      success: (res) => {
        console.log('云函数调用成功', res);

        that.setData({
          statusTip: ''
        });

        if (res.result.success) {
          const recognizedText = res.result.text;
          console.log('识别结果:', recognizedText);

          // 跳转到编辑页，带上录音和识别的文字
          wx.navigateTo({
            url: `/pages/record-edit/record-edit?audioPath=${encodeURIComponent(fileID)}&content=${encodeURIComponent(recognizedText)}&voiceMode=true`
          });
        } else {
          // 识别失败，仍然跳转但不带文字
          console.error('识别失败:', res.result.error);

          wx.showToast({
            title: '识别失败，请手动输入',
            icon: 'none',
            duration: 2000
          });

          wx.navigateTo({
            url: `/pages/record-edit/record-edit?audioPath=${encodeURIComponent(fileID)}&voiceMode=true`
          });
        }
      },
      fail: (err) => {
        console.error('云函数调用失败', err);

        that.setData({
          statusTip: ''
        });

        wx.showToast({
          title: '识别失败，请手动输入',
          icon: 'none',
          duration: 2000
        });

        // 识别失败也跳转到编辑页
        wx.navigateTo({
          url: `/pages/record-edit/record-edit?audioPath=${encodeURIComponent(fileID)}&voiceMode=true`
        });
      }
    });
  },

  // 切换录音状态
  toggleRecord() {
    if (this.data.isRecording) {
      // 停止录音
      recorderManager.stop();
      this.setData({
        isRecording: false,
        recordText: '按住录音'
      });
    } else {
      // 开始录音
      this.startRecord();
    }
  },

  // 开始录音
  startRecord() {
    const that = this;

    // 请求录音权限
    wx.authorize({
      scope: 'scope.record',
      success() {
        // 开始录音 - 使用pcm格式（无损原始音频）
        recorderManager.start({
          duration: 60000,      // 最长60秒
          sampleRate: 16000,    // 采样率16000
          numberOfChannels: 1,  // 单声道
          format: 'pcm'         // pcm格式（无损）
        });

        that.setData({
          isRecording: true,
          recordText: '录音中...'
        });
      },
      fail() {
        wx.showModal({
          title: '需要录音权限',
          content: '请在设置中开启录音权限',
          confirmText: '去设置',
          success(res) {
            if (res.confirm) {
              wx.openSetting();
            }
          }
        });
      }
    });
  },

  // 加载最近记录
  loadRecentRecords() {
    const that = this;
    const db = wx.cloud.database();

    wx.showLoading({
      title: '加载中...'
    });

    db.collection('records')
      .where({
        _openid: '{openid}' // 云数据库会自动替换为当前用户的openid
      })
      .orderBy('startTime', 'desc')
      .limit(3)
      .get({
        success(res) {
          console.log('查询成功', res);

          const records = res.data.map(item => {
            return {
              ...item,
              startTimeStr: that.formatTime(item.startTime),
              endTimeStr: item.endTime ? that.formatTime(item.endTime) : '进行中'
            };
          });

          that.setData({
            recentRecords: records
          });

          wx.hideLoading();
        },
        fail(err) {
          console.error('查询失败', err);
          wx.hideLoading();

          // 如果是首次使用，数据库可能还没创建，不显示错误
          if (err.errCode !== -1) {
            wx.showToast({
              title: '加载失败',
              icon: 'none'
            });
          }
        }
      });
  },

  // 格式化时间
  formatTime(date) {
    const d = new Date(date);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  },

  // 查看详情
  viewDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/daily/daily?recordId=${id}`
    });
  },

  // ========== 备忘录相关方法 ==========

  // 加载今日待办
  loadTodayMemos() {
    const db = wx.cloud.database();
    const _ = db.command;

    // 获取今天的开始和结束时间
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    db.collection('memos')
      .where({
        isDeleted: _.neq(true),
        isCompleted: false,  // 只显示未完成的
        reminderTime: _.gte(today).and(_.lt(tomorrow))
      })
      .orderBy('reminderTime', 'asc')
      .get({
        success: (res) => {
          console.log('加载今日待办成功', res);

          const memos = res.data.map(memo => {
            return {
              ...memo,
              reminderTimeStr: this.formatTime(memo.reminderTime)
            };
          });

          // 只显示前3条
          const displayMemos = memos.slice(0, 3);

          this.setData({
            todayMemos: memos,
            displayMemos: displayMemos
          });
        },
        fail: (err) => {
          console.error('加载今日待办失败', err);
          // 不显示错误提示，避免影响用户体验
          this.setData({
            todayMemos: [],
            displayMemos: []
          });
        }
      });
  },

  // 折叠/展开卡片
  toggleMemoCard() {
    this.setData({
      memoCardExpanded: !this.data.memoCardExpanded
    });
  },

  // 跳转到备忘录列表
  goToMemoList() {
    wx.navigateTo({
      url: '/pages/memo-list/memo-list'
    });
  },

  // 跳转到备忘录编辑页
  goToMemoEdit(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/memo-edit/memo-edit?id=${id}`
    });
  },

  // 快速完成
  quickComplete(e) {
    const id = e.currentTarget.dataset.id;
    const isCompleted = e.currentTarget.dataset.completed;

    console.log('快速完成', id, isCompleted);

    const db = wx.cloud.database();

    wx.showLoading({
      title: '处理中...',
      mask: true
    });

    db.collection('memos')
      .doc(id)
      .update({
        data: {
          isCompleted: !isCompleted,
          completedTime: !isCompleted ? new Date() : null,
          updateTime: new Date()
        },
        success: () => {
          wx.hideLoading();
          wx.showToast({
            title: !isCompleted ? '已完成' : '已取消',
            icon: 'success',
            duration: 1500
          });

          // 刷新今日待办
          this.loadTodayMemos();
        },
        fail: (err) => {
          console.error('操作失败', err);
          wx.hideLoading();
          wx.showToast({
            title: '操作失败',
            icon: 'none'
          });
        }
      });
  }
});
