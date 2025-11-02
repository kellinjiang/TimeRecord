// 标签管理页面
const app = getApp();

Page({
  data: {
    defaultTags: [],      // 默认标签列表
    customTags: [],       // 自定义标签列表
    showDialog: false,    // 是否显示弹窗
    isEditMode: false,    // 是否为编辑模式
    currentTagId: null,   // 当前编辑的标签ID

    // 表单数据
    formData: {
      name: '',
      icon: '📌',
      color: '#1AAD19'
    },

    // 图标选项
    iconOptions: [
      '💼', '📚', '🏃', '🎯', '💡', '🎨',
      '🎵', '🎮', '☕', '🍔', '✈️', '🏠',
      '💻', '📱', '🚗', '🎬', '📷', '⚽',
      '🏋️', '🧘', '🛒', '💰', '📖', '✍️'
    ],

    // 颜色选项
    colorOptions: [
      '#1AAD19', '#1296db', '#f43530', '#fa9d3b',
      '#fa3534', '#8b572a', '#c5000f', '#e54256',
      '#f76260', '#ff6600', '#ffc300', '#44ce42',
      '#07c160', '#10aeff', '#6467f0', '#6689d8',
      '#745399', '#b0a4e3', '#ea80fc', '#e91e63'
    ]
  },

  onLoad() {
    this.loadAllTags();
  },

  onShow() {
    // 每次显示页面时重新加载标签
    this.loadAllTags();
  },

  onPullDownRefresh() {
    this.loadAllTags().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 加载所有标签
  loadAllTags() {
    return Promise.all([
      this.loadDefaultTags(),
      this.loadCustomTags()
    ]);
  },

  // 加载默认标签（从全局数据）
  loadDefaultTags() {
    return new Promise((resolve, reject) => {
      const defaultTags = app.globalData.defaultTags || [];

      // 统计每个默认标签的使用次数
      this.calculateTagUsage(defaultTags).then(tagsWithUsage => {
        this.setData({
          defaultTags: tagsWithUsage
        });
        resolve();
      });
    });
  },

  // 加载自定义标签（从数据库）
  loadCustomTags() {
    return new Promise((resolve, reject) => {
      const db = wx.cloud.database();

      db.collection('tags')
        .where({
          isDeleted: db.command.neq(true)
        })
        .orderBy('createTime', 'desc')
        .get({
          success: (res) => {
            console.log('加载自定义标签成功', res.data);

            // 统计每个自定义标签的使用次数
            this.calculateTagUsage(res.data).then(tagsWithUsage => {
              this.setData({
                customTags: tagsWithUsage
              });
              resolve();
            });
          },
          fail: (err) => {
            console.error('加载自定义标签失败', err);
            wx.showToast({
              title: '加载失败',
              icon: 'none'
            });
            reject(err);
          }
        });
    });
  },

  // 计算标签使用次数
  calculateTagUsage(tags) {
    return new Promise((resolve, reject) => {
      const db = wx.cloud.database();

      // 查询所有记录中的标签使用情况
      db.collection('records')
        .where({
          isDeleted: db.command.neq(true)
        })
        .field({
          tags: true
        })
        .get({
          success: (res) => {
            const records = res.data;

            // 统计每个标签的使用次数
            const tagUsageMap = {};
            records.forEach(record => {
              if (record.tags && record.tags.length > 0) {
                record.tags.forEach(tag => {
                  if (!tagUsageMap[tag.name]) {
                    tagUsageMap[tag.name] = 0;
                  }
                  tagUsageMap[tag.name]++;
                });
              }
            });

            // 为标签添加使用次数
            const tagsWithUsage = tags.map(tag => ({
              ...tag,
              usageCount: tagUsageMap[tag.name] || 0
            }));

            resolve(tagsWithUsage);
          },
          fail: (err) => {
            console.error('统计标签使用失败', err);
            // 即使统计失败，也返回原始标签列表
            resolve(tags.map(tag => ({...tag, usageCount: 0})));
          }
        });
    });
  },

  // 显示添加标签弹窗
  showAddDialog() {
    this.setData({
      showDialog: true,
      isEditMode: false,
      currentTagId: null,
      formData: {
        name: '',
        icon: '📌',
        color: '#1AAD19'
      }
    });
  },

  // 编辑标签
  editTag(e) {
    const tag = e.currentTarget.dataset.tag;
    console.log('编辑标签', tag);

    this.setData({
      showDialog: true,
      isEditMode: true,
      currentTagId: tag._id,
      formData: {
        name: tag.name,
        icon: tag.icon,
        color: tag.color
      }
    });
  },

  // 删除标签
  deleteTag(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;

    wx.showModal({
      title: '确认删除',
      content: `确定要删除标签"${name}"吗？删除后不影响已有记录中的该标签。`,
      confirmText: '删除',
      confirmColor: '#f43530',
      success: (res) => {
        if (res.confirm) {
          this.doDeleteTag(id);
        }
      }
    });
  },

  // 执行删除标签
  doDeleteTag(tagId) {
    wx.showLoading({ title: '删除中...', mask: true });

    const db = wx.cloud.database();

    // 软删除
    db.collection('tags')
      .doc(tagId)
      .update({
        data: {
          isDeleted: true,
          deleteTime: new Date()
        },
        success: () => {
          wx.hideLoading();
          wx.showToast({
            title: '删除成功',
            icon: 'success',
            duration: 1500
          });

          // 重新加载标签列表
          this.loadCustomTags();
        },
        fail: (err) => {
          wx.hideLoading();
          console.error('删除标签失败', err);
          wx.showToast({
            title: '删除失败',
            icon: 'none'
          });
        }
      });
  },

  // 保存标签（新建或更新）
  saveTag() {
    const { name, icon, color } = this.data.formData;

    // 验证标签名称
    if (!name || name.trim() === '') {
      wx.showToast({
        title: '请输入标签名称',
        icon: 'none'
      });
      return;
    }

    // 检查标签名称是否重复
    this.checkTagNameExists(name.trim()).then(exists => {
      if (exists) {
        wx.showToast({
          title: '标签名称已存在',
          icon: 'none'
        });
        return;
      }

      // 执行保存
      if (this.data.isEditMode) {
        this.updateTag();
      } else {
        this.createTag();
      }
    });
  },

  // 检查标签名称是否已存在
  checkTagNameExists(name) {
    return new Promise((resolve, reject) => {
      // 检查默认标签中是否存在
      const existsInDefault = this.data.defaultTags.some(tag => tag.name === name);
      if (existsInDefault) {
        resolve(true);
        return;
      }

      // 检查自定义标签中是否存在（排除当前编辑的标签）
      const existsInCustom = this.data.customTags.some(tag => {
        return tag.name === name && tag._id !== this.data.currentTagId;
      });

      resolve(existsInCustom);
    });
  },

  // 创建新标签
  createTag() {
    wx.showLoading({ title: '添加中...', mask: true });

    const db = wx.cloud.database();

    db.collection('tags')
      .add({
        data: {
          name: this.data.formData.name.trim(),
          icon: this.data.formData.icon,
          color: this.data.formData.color,
          createTime: new Date(),
          updateTime: new Date(),
          isDeleted: false
        },
        success: (res) => {
          wx.hideLoading();
          console.log('添加标签成功', res);

          wx.showToast({
            title: '添加成功',
            icon: 'success',
            duration: 1500
          });

          // 隐藏弹窗
          this.hideDialog();

          // 重新加载标签列表
          this.loadCustomTags();
        },
        fail: (err) => {
          wx.hideLoading();
          console.error('添加标签失败', err);

          wx.showToast({
            title: '添加失败',
            icon: 'none'
          });
        }
      });
  },

  // 更新标签
  updateTag() {
    wx.showLoading({ title: '保存中...', mask: true });

    const db = wx.cloud.database();

    db.collection('tags')
      .doc(this.data.currentTagId)
      .update({
        data: {
          name: this.data.formData.name.trim(),
          icon: this.data.formData.icon,
          color: this.data.formData.color,
          updateTime: new Date()
        },
        success: (res) => {
          wx.hideLoading();
          console.log('更新标签成功', res);

          wx.showToast({
            title: '保存成功',
            icon: 'success',
            duration: 1500
          });

          // 隐藏弹窗
          this.hideDialog();

          // 重新加载标签列表
          this.loadCustomTags();
        },
        fail: (err) => {
          wx.hideLoading();
          console.error('更新标签失败', err);

          wx.showToast({
            title: '保存失败',
            icon: 'none'
          });
        }
      });
  },

  // 隐藏弹窗
  hideDialog() {
    this.setData({
      showDialog: false
    });
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 空函数，用于阻止点击弹窗内容时关闭
  },

  // 阻止滚动穿透
  preventMove() {
    // 空函数，用于阻止滚动穿透
  },

  // 标签名称输入
  onNameInput(e) {
    this.setData({
      'formData.name': e.detail.value
    });
  },

  // 选择图标
  selectIcon(e) {
    const icon = e.currentTarget.dataset.icon;
    this.setData({
      'formData.icon': icon
    });
  },

  // 选择颜色
  selectColor(e) {
    const color = e.currentTarget.dataset.color;
    this.setData({
      'formData.color': color
    });
  }
});
