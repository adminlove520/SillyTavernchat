import express from 'express';
import {
    createInvitationCode,
    getAllInvitationCodes,
    deleteInvitationCode,
    isInvitationCodesEnabled,
    cleanupExpiredInvitationCodes
} from '../invitation-codes.js';
import { requireAdminMiddleware } from '../users.js';

export const router = express.Router();

// 获取所有邀请码（管理员功能）
router.get('/', requireAdminMiddleware, async (request, response) => {
    try {
        if (!isInvitationCodesEnabled()) {
            return response.json({ enabled: false, codes: [] });
        }

        const codes = await getAllInvitationCodes();
        response.json({ enabled: true, codes });
    } catch (error) {
        console.error('Error getting invitation codes:', error);
        response.status(500).json({ error: 'Failed to get invitation codes' });
    }
});

// 创建邀请码（管理员功能）
router.post('/create', requireAdminMiddleware, async (request, response) => {
    try {
        if (!isInvitationCodesEnabled()) {
            return response.status(400).json({ error: 'Invitation codes are disabled' });
        }

        const { expiresInHours } = request.body;
        const createdBy = request.user?.profile?.handle || request.user?.handle || 'admin';

        const invitation = await createInvitationCode(createdBy, expiresInHours);
        response.json(invitation);
    } catch (error) {
        console.error('Error creating invitation code:', error);
        response.status(500).json({ error: error.message || 'Failed to create invitation code' });
    }
});

// 批量创建邀请码（管理员功能）
router.post('/batch-create', requireAdminMiddleware, async (request, response) => {
    try {
        if (!isInvitationCodesEnabled()) {
            return response.status(400).json({ error: 'Invitation codes are disabled' });
        }

        const { count, expiresInHours } = request.body;
        const createdBy = request.user?.profile?.handle || request.user?.handle || 'admin';

        if (!count || count < 1 || count > 100) {
            return response.status(400).json({ error: 'Count must be between 1 and 100' });
        }

        const invitations = [];
        for (let i = 0; i < count; i++) {
            const invitation = await createInvitationCode(createdBy, expiresInHours);
            invitations.push(invitation);
        }

        response.json({
            success: true,
            count: invitations.length,
            codes: invitations
        });
    } catch (error) {
        console.error('Error batch creating invitation codes:', error);
        response.status(500).json({ error: error.message || 'Failed to batch create invitation codes' });
    }
});

// 删除邀请码（管理员功能）
router.delete('/:code', requireAdminMiddleware, async (request, response) => {
    try {
        if (!isInvitationCodesEnabled()) {
            return response.status(400).json({ error: 'Invitation codes are disabled' });
        }

        const { code } = request.params;
        const success = await deleteInvitationCode(code);

        if (success) {
            response.json({ success: true });
        } else {
            response.status(404).json({ error: 'Invitation code not found' });
        }
    } catch (error) {
        console.error('Error deleting invitation code:', error);
        response.status(500).json({ error: 'Failed to delete invitation code' });
    }
});

// 批量删除邀请码（管理员功能）
router.post('/batch-delete', requireAdminMiddleware, async (request, response) => {
    try {
        if (!isInvitationCodesEnabled()) {
            return response.status(400).json({ error: 'Invitation codes are disabled' });
        }

        const { codes } = request.body;

        if (!codes || !Array.isArray(codes) || codes.length === 0) {
            return response.status(400).json({ error: 'No codes provided for deletion' });
        }

        let deletedCount = 0;
        const errors = [];

        for (const code of codes) {
            try {
                const success = await deleteInvitationCode(code);
                if (success) {
                    deletedCount++;
                } else {
                    errors.push(`Code ${code} not found`);
                }
            } catch (error) {
                errors.push(`Failed to delete code ${code}: ${error.message}`);
            }
        }

        response.json({
            success: true,
            deletedCount,
            totalRequested: codes.length,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        console.error('Error batch deleting invitation codes:', error);
        response.status(500).json({ error: 'Failed to batch delete invitation codes' });
    }
});

// 清理过期邀请码（管理员功能）
router.post('/cleanup', requireAdminMiddleware, async (request, response) => {
    try {
        if (!isInvitationCodesEnabled()) {
            return response.status(400).json({ error: 'Invitation codes are disabled' });
        }

        const cleanedCount = await cleanupExpiredInvitationCodes();
        response.json({ cleanedCount });
    } catch (error) {
        console.error('Error cleaning up invitation codes:', error);
        response.status(500).json({ error: 'Failed to cleanup invitation codes' });
    }
});

// 检查邀请码功能状态
router.get('/status', async (request, response) => {
    try {
        const enabled = isInvitationCodesEnabled();
        response.json({ enabled });
    } catch (error) {
        console.error('Error checking invitation codes status:', error);
        response.status(500).json({ error: 'Failed to check status' });
    }
});
