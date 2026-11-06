const { test } = require('node:test');
const assert = require('node:assert/strict');
const logout = require('../controllers/logoutController');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

test('logout and session-store failures never report success or clear the cookie', () => {
    for (const fail of ['logout', 'destroy']) {
        let cleared = false;
        const res = { code: 200, set() {}, status(code) { this.code=code; return this; }, json() {}, clearCookie() { cleared=true; }, end() { throw Error('unexpected success'); } };
        logout({ isAuthenticated:()=>true, logout: cb=>cb(fail==='logout'?new Error():null), session:{destroy:cb=>cb(new Error())} },res);
        assert.equal(res.code,500);
        assert.equal(cleared,false);
    }
});

for (const mode of ['success','failure','anonymous']) {
    test(`logout interface handles ${mode}`, async () => {
        let handler, redirected=false, calls=0;
        const button={disabled:false,addEventListener:(type,fn)=>{handler=fn;}};
        const status={textContent:''};
        const context=vm.createContext({document:{getElementById:id=>id==='confirm-logout'?button:status},
            window:{location:{replace:()=>{redirected=true;}}},
            getSession:async()=>mode==='anonymous'?null:{user_id:1},
            apiFetch:async(url,options)=>{calls++;assert.equal(options.method,'POST');return {ok:mode==='success',status:500};}
        });
        const source=fs.readFileSync(path.join(__dirname,'../public/js/logout.js'),'utf8').replace(/^import .*;\r?\n/,'').replace('export function','function');
        vm.runInContext(source,context);
        await handler();
        assert.equal(redirected,mode!=='failure');
        assert.equal(calls,mode==='anonymous'?0:1);
        if(mode==='failure') {assert.equal(button.disabled,false);assert.match(status.textContent,/Unable/);}
    });
}
