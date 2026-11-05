const pool = require('../models/db');
const { unlink } = require('node:fs/promises');

function validId(value) {
    return /^(?:[1-9]\d*)$/.test(String(value)) && Number.isSafeInteger(Number(value));
}

function canReadBoard(board, userId) {
    return Number(board.user_id) === Number(userId) || board.visibility === 'public';
}

function requireAdmin(req, res, next) {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Authentication required' });
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
    next();
}

// Use the same response for missing and inaccessible resources to avoid disclosing them.
function guard(check) {
    return async (req, res, next) => {
        try {
            if (await check(req)) return next();
            if (req.file) await unlink(req.file.path);
            return res.status(404).json({ error: 'Resource not found' });
        } catch (error) {
            if (req.file) {
                try { await unlink(req.file.path); }
                catch (cleanupError) {
                    if (cleanupError.code !== 'ENOENT') console.error('Upload cleanup failed:', cleanupError);
                }
            }
            console.error('Authorization lookup failed:', error);
            return res.status(500).json({ error: 'Unable to check access' });
        }
    };
}

function boardAccess(getId, { ownerOnly = false } = {}) {
    return guard(async req => {
        const id = getId(req);
        if (!validId(id)) return false;
        const [rows] = await pool.query('SELECT board_id, user_id, visibility, name, description FROM boards WHERE board_id = ?', [id]);
        const board = rows[0];
        if (!board) return false;
        const allowed = ownerOnly
            ? Number(board.user_id) === Number(req.user.user_id)
            : canReadBoard(board, req.user.user_id);
        if (allowed) req.accessBoard = board;
        return allowed;
    });
}

async function readablePin(req, id, ownerOnly = false) {
    if (!validId(id)) return false;
    const [rows] = await pool.query(
        `SELECT p.pin_id, p.user_id, b.user_id AS board_owner_id, b.visibility
         FROM pins p JOIN boards b ON b.board_id = p.board_id WHERE p.pin_id = ?`, [id]
    );
    const pin = rows[0];
    if (!pin) return false;
    if (ownerOnly) {
        return Number(pin.user_id) === Number(req.user.user_id)
            && Number(pin.board_owner_id) === Number(req.user.user_id);
    }
    return canReadBoard({ user_id: pin.board_owner_id, visibility: pin.visibility }, req.user.user_id);
}

function pinAccess(getId, { ownerOnly = false } = {}) {
    return guard(req => readablePin(req, getId(req), ownerOnly));
}

const commentAccess = guard(async req => {
    const id = req.params.comment_id;
    if (!validId(id)) return false;
    const [comments] = await pool.query(
        'SELECT pin_id FROM comments WHERE comment_id = ? AND is_deleted = false', [id]
    );
    if (!comments[0] || !await readablePin(req, comments[0].pin_id)) return false;
    const parentId = req.body?.parent_reply_id;
    if (parentId != null) {
        if (!validId(parentId)) return false;
        const [parents] = await pool.query(
            'SELECT reply_id FROM replies WHERE reply_id = ? AND comment_id = ? AND is_deleted = false',
            [parentId, id]
        );
        if (!parents.length) return false;
    }
    return true;
});

const uploadAccess = guard(async req => {
    let relativePath;
    try { relativePath = decodeURIComponent(req.path); }
    catch { return false; }
    // Uploads are flat files; reject alternate path spellings and traversal.
    if (!/^\/uploads\/[A-Za-z0-9_.-]+$/.test(relativePath)) return false;
    const [rows] = await pool.query(
        `SELECT b.user_id, b.visibility FROM pins p
         JOIN boards b ON b.board_id = p.board_id WHERE p.image_url = ?`,
        [relativePath]
    );
    return rows.some(board => canReadBoard(board, req.user.user_id));
});


module.exports = { validId, requireAdmin, boardAccess, pinAccess, commentAccess, uploadAccess };
