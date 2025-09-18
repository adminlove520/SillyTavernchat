import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { requireAdminMiddleware } from '../users.js';
import { humanizedISO8601DateTime } from '../util.js';

const ANNOUNCEMENTS_DIR = path.join(process.cwd(), 'data', 'announcements');
const ANNOUNCEMENTS_FILE = path.join(ANNOUNCEMENTS_DIR, 'announcements.json');

export const router = express.Router();

// 确保公告目录存在
function ensureAnnouncementsDirectory() {
    if (!fs.existsSync(ANNOUNCEMENTS_DIR)) {
        fs.mkdirSync(ANNOUNCEMENTS_DIR, { recursive: true });
    }
}

// 读取公告数据
function loadAnnouncements() {
    ensureAnnouncementsDirectory();

    if (!fs.existsSync(ANNOUNCEMENTS_FILE)) {
        return [];
    }

    try {
        const data = fs.readFileSync(ANNOUNCEMENTS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading announcements:', error);
        return [];
    }
}

// 保存公告数据
function saveAnnouncements(announcements) {
    ensureAnnouncementsDirectory();

    try {
        fs.writeFileSync(ANNOUNCEMENTS_FILE, JSON.stringify(announcements, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Error saving announcements:', error);
        return false;
    }
}

// 生成公告ID
function generateAnnouncementId() {
    return `announcement_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 获取所有公告（管理员）
router.get('/', requireAdminMiddleware, async (request, response) => {
    try {
        const announcements = loadAnnouncements();
        response.json(announcements);
    } catch (error) {
        console.error('Error getting announcements:', error);
        response.status(500).json({ error: 'Failed to get announcements' });
    }
});

// 获取当前有效公告（用户）
router.get('/current', async (request, response) => {
    try {
        const announcements = loadAnnouncements();

        // 筛选有效的公告（仅检查启用状态）
        const validAnnouncements = announcements.filter(announcement => {
            return announcement.enabled;
        });

        response.json(validAnnouncements);
    } catch (error) {
        console.error('Error getting current announcements:', error);
        response.status(500).json({ error: 'Failed to get current announcements' });
    }
});

// 创建新公告
router.post('/', requireAdminMiddleware, async (request, response) => {
    try {
        const { title, content, type, enabled } = request.body;

        if (!title || !content) {
            return response.status(400).json({ error: 'Title and content are required' });
        }

        const announcements = loadAnnouncements();
        const now = Date.now();

        const newAnnouncement = {
            id: generateAnnouncementId(),
            title: title.trim(),
            content: content.trim(),
            type: type || 'info', // info, warning, success, error
            enabled: enabled !== false,
            createdAt: now,
            updatedAt: now,
            createdBy: request.user.profile.handle
        };

        announcements.unshift(newAnnouncement);

        if (saveAnnouncements(announcements)) {
            console.log(`Announcement created: "${newAnnouncement.title}" by ${request.user.profile.handle}`);
            response.json(newAnnouncement);
        } else {
            response.status(500).json({ error: 'Failed to save announcement' });
        }
    } catch (error) {
        console.error('Error creating announcement:', error);
        response.status(500).json({ error: 'Failed to create announcement' });
    }
});

// 更新公告
router.put('/:id', requireAdminMiddleware, async (request, response) => {
    try {
        const { id } = request.params;
        const { title, content, type, enabled } = request.body;

        const announcements = loadAnnouncements();
        const announcementIndex = announcements.findIndex(a => a.id === id);

        if (announcementIndex === -1) {
            return response.status(404).json({ error: 'Announcement not found' });
        }

        const announcement = announcements[announcementIndex];

        // 更新字段
        if (title !== undefined) announcement.title = title.trim();
        if (content !== undefined) announcement.content = content.trim();
        if (type !== undefined) announcement.type = type;
        if (enabled !== undefined) announcement.enabled = enabled;

        announcement.updatedAt = Date.now();
        announcement.updatedBy = request.user.profile.handle;

        if (saveAnnouncements(announcements)) {
            console.log(`Announcement updated: "${announcement.title}" by ${request.user.profile.handle}`);
            response.json(announcement);
        } else {
            response.status(500).json({ error: 'Failed to update announcement' });
        }
    } catch (error) {
        console.error('Error updating announcement:', error);
        response.status(500).json({ error: 'Failed to update announcement' });
    }
});

// 删除公告
router.delete('/:id', requireAdminMiddleware, async (request, response) => {
    try {
        const { id } = request.params;

        const announcements = loadAnnouncements();
        const announcementIndex = announcements.findIndex(a => a.id === id);

        if (announcementIndex === -1) {
            return response.status(404).json({ error: 'Announcement not found' });
        }

        const announcement = announcements[announcementIndex];
        announcements.splice(announcementIndex, 1);

        if (saveAnnouncements(announcements)) {
            console.log(`Announcement deleted: "${announcement.title}" by ${request.user.profile.handle}`);
            response.json({ success: true });
        } else {
            response.status(500).json({ error: 'Failed to delete announcement' });
        }
    } catch (error) {
        console.error('Error deleting announcement:', error);
        response.status(500).json({ error: 'Failed to delete announcement' });
    }
});

// 切换公告启用状态
router.post('/:id/toggle', requireAdminMiddleware, async (request, response) => {
    try {
        const { id } = request.params;

        const announcements = loadAnnouncements();
        const announcement = announcements.find(a => a.id === id);

        if (!announcement) {
            return response.status(404).json({ error: 'Announcement not found' });
        }

        announcement.enabled = !announcement.enabled;
        announcement.updatedAt = Date.now();
        announcement.updatedBy = request.user.profile.handle;

        if (saveAnnouncements(announcements)) {
            console.log(`Announcement ${announcement.enabled ? 'enabled' : 'disabled'}: "${announcement.title}" by ${request.user.profile.handle}`);
            response.json(announcement);
        } else {
            response.status(500).json({ error: 'Failed to toggle announcement' });
        }
    } catch (error) {
        console.error('Error toggling announcement:', error);
        response.status(500).json({ error: 'Failed to toggle announcement' });
    }
});
