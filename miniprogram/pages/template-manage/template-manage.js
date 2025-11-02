// 模板管理页面
Page({
  data: {
    // 分类列表
    categories: ['工作', '生活', '学习', '运动', '其他'],
    currentCategory: 'all', // 当前选中的分类

    // 默认模板列表
    defaultTemplates: [
      {
        name: '工作日志',
        category: '工作',
        content: '今天完成了以下工作：\n1. \n2. \n3. \n\n明天计划：\n1. \n2. ',
        usageCount: 0
      },
      {
        name: '会议记录',
        category: '工作',
        content: '会议主题：\n参与人员：\n会议时间：\n\n会议内容：\n\n待办事项：',
        usageCount: 0
      },
      {
        name: '学习笔记',
        category: '学习',
        content: '学习内容：\n学习时长：\n\n重点笔记：\n\n心得体会：',
        usageCount: 0
      }
    ],

    // 自定义模板列表
    customTemplates: [],

    // 筛选后的模板列表
    filteredDefaultTemplates: [],
    filteredCustomTemplates: [],

    // 弹窗相关
    showDialog: false,
    isEditMode: false,
    currentTemplateId: null,

    // 表单数据
    formData: {
      name: '',
      category: '工作',
      content: ''
    }
  },

  onLoad() {
    this.loadAllTemplates();
  },

  onShow() {
    // 每次显示页面时重新加载模板
    this.loadAllTemplates();
  },

  onPullDownRefresh() {
    this.loadAllTemplates().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 加载所有模板
  loadAllTemplates() {
    return Promise.all([
      this.loadDefaultTemplates(),
      this.loadCustomTemplates()
    ]).then(() => {
      // 加载完成后执行筛选
      this.filterTemplates();
    });
  },

  // 加载默认模板
  loadDefaultTemplates() {
    return new Promise((resolve, reject) => {
      const defaultTemplates = [
        {
          name: '工作日志',
          category: '工作',
          content: '今天完成了以下工作：\n1. \n2. \n3. \n\n明天计划：\n1. \n2. ',
          usageCount: 0
        },
        {
          name: '会议记录',
          category: '工作',
          content: '会议主题：\n参与人员：\n会议时间：\n\n会议内容：\n\n待办事项：',
          usageCount: 0
        },
        {
          name: '学习笔记',
          category: '学习',
          content: '学习内容：\n学习时长：\n\n重点笔记：\n\n心得体会：',
          usageCount: 0
        }
      ];

      // TODO: 从数据库统计默认模板的使用次数
      this.setData({
        defaultTemplates: defaultTemplates
      });

      resolve();
    });
  },

  // 加载自定义模板
  loadCustomTemplates() {
    return new Promise((resolve, reject) => {
      const db = wx.cloud.database();

      db.collection('templates')
        .where({
          isDeleted: db.command.neq(true)
        })
        .orderBy('createTime', 'desc')
        .get({
          success: (res) => {
            console.log('加载自定义模板成功', res.data);

            // 格式化时间
            const templates = res.data.map(item => ({
              ...item,
              createTime: this.formatTime(new Date(item.createTime))
            }));

            this.setData({
              customTemplates: templates
            });

            resolve();
          },
          fail: (err) => {
            console.error('加载自定义模板失败', err);
            wx.showToast({
              title: '加载失败',
              icon: 'none'
            });
            reject(err);
          }
        });
    });
  },

  // 格式化时间
  formatTime(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 分类筛选
  filterCategory(e) {
    const category = e.currentTarget.dataset.category;
    this.setData({
      currentCategory: category
    });
    this.filterTemplates();
  },

  // 筛选模板
  filterTemplates() {
    const { currentCategory, defaultTemplates, customTemplates } = this.data;

    let filteredDefault = defaultTemplates;
    let filteredCustom = customTemplates;

    if (currentCategory !== 'all') {
      filteredDefault = defaultTemplates.filter(t => t.category === currentCategory);
      filteredCustom = customTemplates.filter(t => t.category === currentCategory);
    }

    this.setData({
      filteredDefaultTemplates: filteredDefault,
      filteredCustomTemplates: filteredCustom
    });
  },

  // 显示添加模板弹窗
  showAddDialog() {
    this.setData({
      showDialog: true,
      isEditMode: false,
      currentTemplateId: null,
      formData: {
        name: '',
        category: '工作',
        content: ''
      }
    });
  },

  // 编辑模板
  editTemplate(e) {
    const template = e.currentTarget.dataset.template;
    console.log('编辑模板', template);

    this.setData({
      showDialog: true,
      isEditMode: true,
      currentTemplateId: template._id,
      formData: {
        name: template.name,
        category: template.category,
        content: template.content
      }
    });
  },

  // 删除模板
  deleteTemplate(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;

    wx.showModal({
      title: '确认删除',
      content: `确定要删除模板"${name}"吗？`,
      confirmText: '删除',
      confirmColor: '#f43530',
      success: (res) => {
        if (res.confirm) {
          this.doDeleteTemplate(id);
        }
      }
    });
  },

  // 执行删除模板
  doDeleteTemplate(templateId) {
    wx.showLoading({ title: '删除中...', mask: true });

    const db = wx.cloud.database();

    // 软删除
    db.collection('templates')
      .doc(templateId)
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

          // 重新加载模板列表
          this.loadCustomTemplates().then(() => {
            this.filterTemplates();
          });
        },
        fail: (err) => {
          wx.hideLoading();
          console.error('删除模板失败', err);
          wx.showToast({
            title: '删除失败',
            icon: 'none'
          });
        }
      });
  },

  // 保存模板（新建或更新）
  saveTemplate() {
    const { name, category, content } = this.data.formData;

    // 验证模板名称
    if (!name || name.trim() === '') {
      wx.showToast({
        title: '请输入模板名称',
        icon: 'none'
      });
      return;
    }

    // 验证模板内容
    if (!content || content.trim() === '') {
      wx.showToast({
        title: '请输入模板内容',
        icon: 'none'
      });
      return;
    }

    // 检查模板名称是否重复
    this.checkTemplateNameExists(name.trim()).then(exists => {
      if (exists) {
        wx.showToast({
          title: '模板名称已存在',
          icon: 'none'
        });
        return;
      }

      // 执行保存
      if (this.data.isEditMode) {
        this.updateTemplate();
      } else {
        this.createTemplate();
      }
    });
  },

  // 检查模板名称是否已存在
  checkTemplateNameExists(name) {
    return new Promise((resolve, reject) => {
      // 检查默认模板中是否存在
      const existsInDefault = this.data.defaultTemplates.some(t => t.name === name);
      if (existsInDefault) {
        resolve(true);
        return;
      }

      // 检查自定义模板中是否存在（排除当前编辑的模板）
      const existsInCustom = this.data.customTemplates.some(t => {
        return t.name === name && t._id !== this.data.currentTemplateId;
      });

      resolve(existsInCustom);
    });
  },

  // 创建新模板
  createTemplate() {
    wx.showLoading({ title: '添加中...', mask: true });

    const db = wx.cloud.database();

    db.collection('templates')
      .add({
        data: {
          name: this.data.formData.name.trim(),
          category: this.data.formData.category,
          content: this.data.formData.content.trim(),
          createTime: new Date(),
          updateTime: new Date(),
          isDeleted: false
        },
        success: (res) => {
          wx.hideLoading();
          console.log('添加模板成功', res);

          wx.showToast({
            title: '添加成功',
            icon: 'success',
            duration: 1500
          });

          // 隐藏弹窗
          this.hideDialog();

          // 重新加载模板列表
          this.loadCustomTemplates().then(() => {
            this.filterTemplates();
          });
        },
        fail: (err) => {
          wx.hideLoading();
          console.error('添加模板失败', err);

          wx.showToast({
            title: '添加失败',
            icon: 'none'
          });
        }
      });
  },

  // 更新模板
  updateTemplate() {
    wx.showLoading({ title: '保存中...', mask: true });

    const db = wx.cloud.database();

    db.collection('templates')
      .doc(this.data.currentTemplateId)
      .update({
        data: {
          name: this.data.formData.name.trim(),
          category: this.data.formData.category,
          content: this.data.formData.content.trim(),
          updateTime: new Date()
        },
        success: (res) => {
          wx.hideLoading();
          console.log('更新模板成功', res);

          wx.showToast({
            title: '保存成功',
            icon: 'success',
            duration: 1500
          });

          // 隐藏弹窗
          this.hideDialog();

          // 重新加载模板列表
          this.loadCustomTemplates().then(() => {
            this.filterTemplates();
          });
        },
        fail: (err) => {
          wx.hideLoading();
          console.error('更新模板失败', err);

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

  // 模板名称输入
  onNameInput(e) {
    this.setData({
      'formData.name': e.detail.value
    });
  },

  // 模板内容输入
  onContentInput(e) {
    this.setData({
      'formData.content': e.detail.value
    });
  },

  // 选择分类
  selectCategory(e) {
    const category = e.currentTarget.dataset.category;
    this.setData({
      'formData.category': category
    });
  }
});
