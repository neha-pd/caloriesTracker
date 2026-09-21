// Explicit deployment acceptance test. Uses a disposable account, never sends email.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { firebaseAccounts } from '../backend/dist/core/firebase.js';
import { openDatabase, migrate } from '../backend/dist/core/database.js';
import { createApp } from '../backend/dist/app.js';
const credentials = JSON.parse(fs.readFileSync('.data/deployment-credentials.json', 'utf8'));
process.env.FIREBASE_API_KEY = credentials.firebase_api_key;
process.env.FIREBASE_PROJECT_ID = credentials.firebase_project_id;
process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify(credentials.firebase_service_account);
const firebase = firebaseAccounts();
const db = await openDatabase(credentials.database_url_pooled);
await migrate(db);
const app = await createApp({ db, firebase, secret: randomBytes(48).toString('hex'), testing: true });
const email = `fitlens-check-${Date.now()}@example.com`;
const password = randomBytes(24).toString('base64url')+'aA1!';
let uid, localId;
const call = async (method, url, payload, token) => {
  const r=await app.inject({method,url,payload,headers:token?{authorization:`Bearer ${token}`}:{}});
  return {status:r.statusCode,body:r.json()};
};
try {
 const registration = await call('POST','/api/auth/register',{email,password,display_name:'Deployment Check',timezone:'Asia/Kolkata'});
 assert.equal(registration.status,201,JSON.stringify(registration.body));
 localId=registration.body.user.id;
 uid=(await db.query('SELECT firebase_uid FROM users WHERE id=$1',[localId]))[0].firebase_uid;
 const token=registration.body.token;
 assert.equal((await call('GET','/api/users/me',undefined,token)).status,200);
 const refresh=await call('POST','/api/auth/refresh',{refresh_token:registration.body.refresh_token});
 assert.equal(refresh.status,200);
 const admin=getAuth(getApps().find(a=>a.name==='fitlens'));
 await new Promise(resolve=>setTimeout(resolve,1100));
 const link=await admin.generatePasswordResetLink(email);
 const reset=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=${credentials.firebase_api_key}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({oobCode:new URL(link).searchParams.get('oobCode'),newPassword:password+'2'})});
 assert.equal(reset.status,200,'Firebase hosted reset action must succeed');
 assert.equal((await call('GET','/api/users/me',undefined,token)).status,401,'Password reset must revoke FitLens access');
 assert.equal((await call('POST','/api/auth/refresh',{refresh_token:refresh.body.refresh_token})).status,401,'Password reset must revoke refresh');
 const login=await call('POST','/api/auth/login',{email,password:password+'2'});
 assert.equal(login.status,200,JSON.stringify(login.body));
 assert.equal(login.body.user.id,localId);
 assert.equal((await call('POST','/api/auth/logout',{refresh_token:login.body.refresh_token})).status,200);
 assert.equal((await call('GET','/api/users/me',undefined,login.body.token)).status,401);
 const finalLogin=await call('POST','/api/auth/login',{email,password:password+'2'});
 assert.equal((await call('DELETE','/api/users/me',{password:password+'2'},finalLogin.body.token)).status,200);
 assert.equal((await db.query('SELECT id FROM users WHERE id=$1',[localId])).length,0);
 console.log('PASS: real Firebase + Neon signup, session refresh, password reset action, access/refresh revocation, login, logout and account deletion. No email sent.');
} finally {
 if(uid) await firebase.remove(uid).catch(e=>{if(e.code!=='auth/user-not-found')throw e;});
 if(localId) await db.query('DELETE FROM users WHERE id=$1',[localId]);
 await app.close();await db.close();
}
