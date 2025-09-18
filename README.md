# SillyTavernchat v1.13.7

基于SillyTavern 1.13.4的增强版本，集成了用户管理、系统监控、论坛社区等企业级功能。

## 🌟 核心特性

### 📊 基于SillyTavern 1.13.4
- ✅ 支持所有原版SillyTavern功能
- ✅ 集成最新的AI模型和API支持
- ✅ MiniMax TTS语音合成
- ✅ Moonshot、Fireworks、CometAPI等新API源
- ✅ 增强的Story String包装序列
- ✅ 改进的扩展系统和UI/UX

## 🚀 二次开发功能

### 👥 用户管理系统
- **用户注册与登录**：完整的用户认证系统
- **密码恢复**：邮箱验证的密码重置功能
- **用户权限管理**：管理员和普通用户角色分离
- **会话管理**：安全的用户会话控制
- **用户数据隔离**：每个用户独立的数据存储

### 🎫 邀请码系统
- **邀请码生成**：管理员可生成邀请码
- **注册限制**：通过邀请码控制用户注册
- **有效期管理**：支持邀请码过期时间设置
- **使用统计**：邀请码使用情况跟踪

### 📈 系统监控
- **实时系统负载监控**：CPU、内存、磁盘使用率
- **用户活动统计**：消息数量、活跃用户统计
- **历史数据记录**：系统性能历史趋势
- **可视化图表**：直观的数据展示界面
- **性能告警**：系统资源使用异常提醒

### 💬 论坛社区
- **文章发布系统**：支持富文本编辑
- **分类管理**：文章分类和标签系统
- **评论互动**：文章评论和回复功能
- **用户互动**：点赞、收藏、分享功能
- **内容管理**：管理员内容审核功能

### 🎭 公共角色卡库
- **角色卡分享**：用户可分享自己的角色卡
- **角色卡浏览**：公共角色卡库浏览
- **搜索和筛选**：按分类、标签搜索角色卡
- **下载和导入**：一键下载和导入角色卡
- **评分系统**：角色卡评分和评论

### 🎨 界面增强
- **导航链接**：角色卡页面新增快捷导航
  - 欢迎首页链接
  - 共享角色卡库链接  
  - 论坛链接
- **响应式设计**：适配各种屏幕尺寸
- **主题兼容**：与SillyTavern主题系统完美集成

## 🔧 技术架构

### 后端技术栈
- **Node.js + Express**：服务器框架
- **node-persist**：数据持久化存储
- **cookie-session**：会话管理
- **rate-limiter-flexible**：API限流保护
- **multer**：文件上传处理
- **helmet**：安全头设置

### 前端技术栈
- **原生JavaScript**：无额外框架依赖
- **jQuery**：DOM操作和AJAX
- **FontAwesome**：图标系统
- **CSS3**：现代样式和动画
- **响应式布局**：移动端适配

### 安全特性
- **CSRF保护**：跨站请求伪造防护
- **输入验证**：服务器端数据验证
- **SQL注入防护**：参数化查询
- **XSS防护**：内容过滤和转义
- **会话安全**：安全的会话管理

## 📦 安装部署

### 环境要求
- Node.js >= 18.0.0
- npm >= 8.0.0
- 2GB+ RAM
- 10GB+ 磁盘空间

### 快速开始
```bash
# 克隆项目
git clone https://github.com/zhaiiker/SillyTavernchat.git
cd SillyTavernchat

# 安装依赖
npm install

# 启动服务
npm start

# 或使用批处理文件（Windows）
Start.bat
```

### 配置说明
```yaml
# config.yaml 主要配置项
listen: true                    # 监听外部连接
port: 8000                     # 服务端口
whitelist: []                  # IP白名单
basicAuthMode: false           # 基础认证模式
enableExtensions: true        # 启用扩展系统
```

## 🎯 使用指南

### 管理员首次设置
1. 启动系统后访问 `http://localhost:8000`
2. 注册第一个用户（自动获得管理员权限）
3. 进入系统监控页面配置监控参数
4. 在邀请码管理中生成邀请码
5. 配置论坛分类和权限设置

### 普通用户使用
1. 使用邀请码注册账户
2. 登录系统开始使用AI对话功能
3. 在论坛中参与社区讨论
4. 分享和下载公共角色卡
5. 个性化设置和主题配置

## 🔄 版本历史

### v1.13.6 (当前版本)
- 🆕 升级至SillyTavern 1.13.3基础版本
- 🆕 新增MiniMax TTS语音合成支持
- 🆕 添加Moonshot、Fireworks、CometAPI等新API源
- 🆕 角色卡页面增加导航链接
- 🔧 优化Story String包装序列
- 🔧 改进扩展系统兼容性
- 🐛 修复多项已知问题

### v1.13.2 (历史版本)
- 🆕 用户登录注册系统
- 🆕 邀请码管理功能
- 🆕 系统监控面板
- 🆕 论坛社区功能
- 🆕 公共角色卡库

## 🛠️ 开发指南

### 目录结构
```
SillyTavernchat/
├── src/                    # 后端源码
│   ├── endpoints/         # API端点
│   │   ├── users-*.js    # 用户管理API
│   │   ├── forum.js      # 论坛API
│   │   ├── system-load.js # 系统监控API
│   │   └── invitation-codes.js # 邀请码API
│   ├── middleware/        # 中间件
│   ├── system-monitor.js  # 系统监控核心
│   └── users.js          # 用户管理核心
├── public/                # 前端资源
│   ├── login.html        # 登录页面
│   ├── register.html     # 注册页面
│   ├── forum.html        # 论坛页面
│   ├── public-characters.html # 角色卡库
│   └── scripts/          # JavaScript文件
└── data/                 # 数据存储
    ├── default-user/     # 默认用户数据
    ├── system-monitor/   # 监控数据
    └── forum_data/       # 论坛数据
```

### API文档
详细的API文档请参考：`/docs/api.md`

### 扩展开发
支持通过扩展系统添加自定义功能，详见：`/docs/extensions.md`

## 🤝 贡献指南

### 提交代码
1. Fork 项目到您的GitHub账户
2. 创建功能分支：`git checkout -b feature/新功能名称`
3. 提交更改：`git commit -m '添加新功能'`
4. 推送分支：`git push origin feature/新功能名称`
5. 创建Pull Request

### 报告问题
- 使用GitHub Issues报告bug
- 提供详细的错误信息和复现步骤
- 包含系统环境信息

## 📄 许可证
本项目基于 AGPL-3.0 许可证开源，详见 [LICENSE](LICENSE) 文件。

## 🙏 致谢
- [SillyTavern](https://github.com/SillyTavern/SillyTavern) - 提供优秀的基础框架
- 所有贡献者和社区成员的支持

## 📞 联系方式
- 项目主页：https://github.com/zhaiiker/SillyTavernchat
- 问题反馈：https://github.com/zhaiiker/SillyTavernchat/issues
- 讨论社区：https://github.com/zhaiiker/SillyTavernchat/discussions

---

**SillyTavernchat** - 让AI对话更智能，让社区更活跃！ 🎉
