import test from 'node:test'; import assert from 'node:assert/strict'; import {readFileSync} from 'node:fs';
const app=readFileSync('app.js','utf8');
test('no legacy demo auth',()=>{for(const x of ['x-demo-role','x-demo-user','InMemoryStore'])assert.equal(app.includes(x),false)});
test('no demo customer values',()=>{for(const x of ['Good Morning, Yash','1,250'])assert.equal(app.includes(x),false)});
test('dedicated Supabase project only',()=>assert.match(app,/zdmpcvlmjmsapydaljms\.supabase\.co/));
test('no service-role secret in frontend',()=>assert.equal(app.includes('SUPABASE_SERVICE_ROLE_KEY'),false));
test('verification uses stable idempotency',()=>assert.match(app,/sessionStorage\.getItem\(pendingKey\)/));
test('offer claims use secure edge function',()=>assert.match(app,/customer-claim-offer/));
