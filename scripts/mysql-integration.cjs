// Opt-in only: never discovered by node --test.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
  const name = `savvit_test_${randomUUID().replaceAll('-', '')}`;
  const options = {
    host: process.env.TEST_DB_HOST || process.env.DB_HOST || 'localhost',
    port: Number(process.env.TEST_DB_PORT || process.env.DB_PORT || 3306),
    user: process.env.TEST_DB_USER || process.env.DB_USER,
    password: process.env.TEST_DB_PASSWORD ?? process.env.DB_PASSWORD,
    connectTimeout: 10000
  };
  let admin, database, pool, created = false;
  try {
    admin = await mysql.createConnection(options);
    // No IF NOT EXISTS: an existing database is never adopted or cleaned up.
    await admin.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
    created = true;
    database = await mysql.createConnection({ ...options, database: name, multipleStatements: true });
    const schema = fs.readFileSync(path.join(__dirname, '../database.sql'), 'utf8');
    assert.ok(!/\b(?:USE|CREATE\s+DATABASE|DROP\s+DATABASE)\s/i.test(schema), 'Schema must not switch databases');
    await database.query(schema);
    const migration = fs.readFileSync(path.join(__dirname, '../migrations/008_board_viewers.sql'), 'utf8');
    await database.query(migration);
    await database.query(migration); // Verify interruption-safe reruns on MySQL.
    console.log('PASS schema import and migration rerun');

    process.env.DB_HOST = options.host;
    process.env.DB_PORT = String(options.port);
    process.env.DB_USER = options.user;
    process.env.DB_PASSWORD = options.password || '';
    process.env.DB_NAME = name;
    pool = require('../models/db');
    const boards = require('../controllers/boardController');
    const sharing = require('../controllers/boardSharingController');
    const boardWrite = require('../models/boardWrite');
    const { boardAccess, pinAccess, uploadAccess } = require('../middleware/authorization');
    const invoke = async (handler, req) => {
      const res = { code: 200, body: undefined, status(code) { this.code = code; return this; },
        json(body) { this.body = body; return this; }, end() { return this; }, set() { return this; } };
      await handler(req, res, () => { res.allowed = true; });
      return res;
    };
    const [owner] = await database.query("INSERT INTO users (email, username, password_hash) VALUES ('owner@integration.test','integration_owner','unused')");
    const [viewer] = await database.query("INSERT INTO users (email, username, password_hash) VALUES ('viewer@integration.test','integration_viewer','unused')");
    const uid = owner.insertId, vid = viewer.insertId;
    const [original] = await database.query("INSERT INTO boards (user_id,name,visibility) VALUES (?,'Original','semi-private')", [uid]);
    const [destination] = await database.query("INSERT INTO boards (user_id,name,visibility) VALUES (?,'Saved','private')", [vid]);
    const bid = original.insertId, did = destination.insertId;
    const [pin] = await database.query("INSERT INTO pins (user_id,board_id,title,image_url) VALUES (?,?,'Original','/uploads/integration.png')", [uid,bid]);
    const pid = pin.insertId;
    await database.query('INSERT INTO board_pins (board_id,pin_id) VALUES (?,?)', [did,pid]);
    const req = (user, board = bid) => ({ user: { user_id: user }, params: { board_id: String(board) }, query: {} });
    const access = () => invoke(boardAccess(r => r.params.board_id), req(vid));
    assert.equal((await access()).code,404);
    for (let i=0;i<2;i++) assert.equal((await invoke(sharing.addViewer,{...req(uid),body:{username:'integration_viewer'}})).code,204);
    assert.equal((await access()).allowed,true);
    const shared = user => invoke(boards.getSharedBoards, req(user));
    assert.deepEqual((await shared(vid)).body.boards.map(b => b.board_id), [bid]);
    assert.deepEqual((await shared(uid)).body.boards, []);
    for (const visibility of ['private', 'public']) {
      await database.query('UPDATE boards SET visibility = ? WHERE board_id = ?', [visibility, bid]);
      assert.deepEqual((await shared(vid)).body.boards, []);
    }
    await database.query("UPDATE boards SET visibility = 'semi-private' WHERE board_id = ?", [bid]);
    assert.equal((await shared(vid)).body.boards[0].owner_name, 'integration_owner');

    assert.equal((await invoke(pinAccess(r=>r.params.id),{...req(vid),params:{id:String(pid)}})).allowed,true);
    assert.equal((await invoke(uploadAccess,{...req(vid),path:'/uploads/integration.png'})).allowed,true);
    const contents = () => invoke(boards.getPinsForBoard,req(vid,did));
    assert.ok((await contents()).body.some(p=>p.pin_id===pid));
    const listing = () => invoke(boards.getBoardsForUser,{...req(vid),params:{user_id:String(vid)}});
    assert.equal((await listing()).body.find(b=>b.board_id===did).thumbnail,'/uploads/integration.png');
    assert.equal((await invoke(boards.deleteBoard,req(uid))).code,409);
    assert.equal((await invoke(sharing.removeViewer,{...req(uid),params:{board_id:String(bid),user_id:String(vid)}})).code,204);
    assert.equal((await access()).code,404);
    assert.equal((await invoke(pinAccess(r=>r.params.id),{...req(vid),params:{id:String(pid)}})).code,404);
    assert.equal((await invoke(uploadAccess,{...req(vid),path:'/uploads/integration.png'})).code,404);
    assert.equal((await contents()).body.length,0);
    assert.equal((await listing()).body.find(b=>b.board_id===did).thumbnail,null);
    assert.equal(Number((await listing()).body.find(b=>b.board_id===did).pin_count),0);
    assert.deepEqual((await shared(vid)).body.boards, []);
    console.log('PASS shared discovery grants, ownership, visibility changes and revocation');
    console.log('PASS real SQL sharing, duplicate grants, revocation, thumbnails, counts and original blocking');

    await database.query('INSERT INTO board_viewers (board_id,user_id) VALUES (?,?)',[did,uid]);
    await database.query('INSERT INTO board_follows (board_id,user_id) VALUES (?,?)',[did,uid]);
    assert.equal((await invoke(boards.deleteBoard,req(vid,did))).code,204);
    for (const table of ['board_pins','board_follows','board_viewers']) {
      const [rows]=await database.query(`SELECT * FROM ${table} WHERE board_id = ?`,[did]);
      assert.equal(rows.length,0);
    }
    assert.equal((await database.query('SELECT pin_id FROM pins WHERE pin_id = ?',[pid]))[0].length,1);
    console.log('PASS reference-only deletion and foreign-key cascade');

    // Hold the exact destination lock used by deletion, queue a write, then delete.
    // Either scheduling order is safe: the helper must recheck after acquiring the lock.
    const [empty]=await database.query("INSERT INTO boards (user_id,name,visibility) VALUES (?,'Race','private')",[uid]);
    const raceId=empty.insertId;
    await database.beginTransaction();
    await database.query('SELECT board_id FROM boards WHERE board_id = ? FOR UPDATE',[raceId]);
    const pending=boardWrite(raceId,uid,'INSERT INTO pins (user_id,board_id,title) VALUES (?,?,?)',[uid,raceId,'Must not exist']);
    await database.query('DELETE FROM boards WHERE board_id = ?',[raceId]);
    await database.commit();
    assert.equal(await pending,null);
    assert.equal((await database.query('SELECT pin_id FROM pins WHERE board_id = ?',[raceId]))[0].length,0);
    await assert.rejects(boardWrite(bid,uid,'INSERT INTO nonexistent_integration_table VALUES (?)',[1]));
    assert.equal((await database.query('SELECT board_id FROM boards WHERE board_id = ?',[bid]))[0].length,1);
    console.log('PASS deleted-destination write recheck and write-failure rollback');

    // Exercise all original-pin dependencies, including a real self-referencing FK.
    const pinController = require('../controllers/pinController');
    const [target] = await database.query("INSERT INTO pins (user_id,board_id,title,image_url) VALUES (?,?,'Delete target','/uploads/delete-target.png')", [uid,bid]);
    const targetId = target.insertId;
    const [comment] = await database.query("INSERT INTO comments (user_id,pin_id,content) VALUES (?,?,'Target comment')", [uid,targetId]);
    const [parent] = await database.query("INSERT INTO replies (user_id,comment_id,content) VALUES (?,?,'Parent')", [uid,comment.insertId]);
    await database.query("INSERT INTO replies (user_id,comment_id,parent_reply_id,content) VALUES (?,?,?,'Child')", [uid,comment.insertId,parent.insertId]);
    const [category] = await database.query("INSERT INTO categories (name) VALUES ('integration_delete_category')");
    const [tag] = await database.query("INSERT INTO tags (name) VALUES ('integration_delete_tag')");
    await database.query('INSERT INTO pin_categories (pin_id,category_id) VALUES (?,?)', [targetId,category.insertId]);
    await database.query('INSERT INTO pin_tags (pin_id,tag_id) VALUES (?,?)', [targetId,tag.insertId]);
    await database.query('INSERT INTO image_metadata (pin_id) VALUES (?)', [targetId]);
    await database.query('INSERT INTO pin_views (pin_id,user_id) VALUES (?,?)', [targetId,vid]);
    await database.query("INSERT INTO engagements (pin_id,user_id,type) VALUES (?,?,'like')", [targetId,vid]);
    await database.query('INSERT INTO board_pins (pin_id,board_id) VALUES (?,?)', [targetId,bid]);
    const dependentTables = ['comments','engagements','board_pins','image_metadata','pin_categories','pin_tags','pin_views'];
    const snapshot = async () => {
      const result = {};
      for (const table of dependentTables) result[table] = (await database.query(`SELECT * FROM ${table} WHERE pin_id = ?`, [targetId]))[0];
      result.replies = (await database.query('SELECT * FROM replies WHERE comment_id = ? ORDER BY reply_id', [comment.insertId]))[0];
      result.pin = (await database.query('SELECT * FROM pins WHERE pin_id = ?', [targetId]))[0];
      return result;
    };
    const deleteTarget = user => invoke(pinController.deletePin, { user: { user_id: user }, params: { id: String(targetId) } });
    assert.equal((await deleteTarget(vid)).code,404);
    const beforeDelete = await snapshot();
    // Legacy inconsistent cross-comment children must block deletion, not be erased.
    const [otherComment] = await database.query("INSERT INTO comments (user_id,pin_id,content) VALUES (?,?,'Keep comment')", [uid,pid]);
    const [externalChild] = await database.query("INSERT INTO replies (user_id,comment_id,parent_reply_id,content) VALUES (?,?,?,'Keep reply')", [uid,otherComment.insertId,parent.insertId]);
    const failedDelete = await deleteTarget(uid);
    assert.equal(failedDelete.code,500);
    assert.deepEqual(failedDelete.body,{error:'Failed to delete pin'});
    assert.deepEqual(await snapshot(),beforeDelete);
    assert.equal((await database.query('SELECT reply_id FROM replies WHERE reply_id = ?', [externalChild.insertId]))[0].length,1);
    // Repair only the disposable test's deliberately inconsistent relationship.
    await database.query('UPDATE replies SET parent_reply_id = NULL WHERE reply_id = ?', [externalChild.insertId]);
    assert.equal((await deleteTarget(uid)).code,200);
    for (const rows of Object.values(await snapshot())) assert.equal(rows.length,0);
    assert.equal((await deleteTarget(uid)).code,404);
    for (const [table,column,id] of [['pins','pin_id',pid],['boards','board_id',bid],
      ['categories','category_id',category.insertId],['tags','tag_id',tag.insertId],
      ['replies','reply_id',externalChild.insertId]]) {
      assert.equal((await database.query(`SELECT * FROM ${table} WHERE ${column} = ?`, [id]))[0].length,1);
    }
    assert.equal((await invoke(uploadAccess,{...req(uid),path:'/uploads/delete-target.png'})).code,404);
    console.log('PASS original-pin dependency deletion, nested replies, FK-failure rollback and retained unrelated records');

  } finally {
    if (pool) await pool.end();
    if (database) await database.end();
    if (admin) {
      try {
        if (created) {
          assert.match(name,/^savvit_test_[a-f0-9]{32}$/);
          await admin.query(`DROP DATABASE \`${name}\``);
          console.log('Removed disposable integration database');
        }
      } finally { await admin.end(); }
    }
  }
}
main().catch(error => {
  // Avoid printing connection settings, SQL parameters or credentials.
  console.error('MySQL integration failed:', error.code || error.name);
  if (error.name === 'AssertionError') console.error(error.message);
  process.exitCode = 1;
});
